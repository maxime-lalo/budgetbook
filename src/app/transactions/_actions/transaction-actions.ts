"use server";

import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { recomputeMonthlyBalance, getCarryOver } from "@/lib/monthly-balance";

export async function getTransactions(year: number, month: number) {
  const transactions = await prisma.transaction.findMany({
    where: { year, month },
    include: {
      account: true,
      category: true,
      subCategory: true,
      bucket: true,
      destinationAccount: { select: { name: true, color: true } },
    },
    orderBy: [{ date: { sort: "asc", nulls: "first" } }, { label: "asc" }],
  });

  return transactions.map((t) => ({
    id: t.id,
    label: t.label,
    amount: t.amount.toNumber(),
    date: t.date ? t.date.toISOString() : null,
    month: t.month,
    year: t.year,
    status: t.status,
    note: t.note,
    accountId: t.accountId,
    categoryId: t.categoryId,
    subCategoryId: t.subCategoryId,
    bucketId: t.bucketId,
    isAmex: t.isAmex,
    destinationAccountId: t.destinationAccountId,
    account: { name: t.account.name, color: t.account.color },
    destinationAccount: t.destinationAccount ? { name: t.destinationAccount.name, color: t.destinationAccount.color } : null,
    category: { name: t.category.name, color: t.category.color },
    subCategory: t.subCategory ? { name: t.subCategory.name } : null,
    bucket: t.bucket ? { name: t.bucket.name } : null,
  }));
}

export async function getTransactionTotals(year: number, month: number) {
  const checkingAccounts = await prisma.account.findMany({
    where: { type: "CHECKING" },
    select: { id: true },
  });
  const checkingIds = checkingAccounts.map((a) => a.id);

  // Transactions dont le compte source est un compte courant (dépenses, revenus, virements sortants)
  // + virements entrants vers un compte courant (amount négatif → inversé = crédit)
  const [completed, pending, incomingCompleted, incomingPending] = await Promise.all([
    prisma.transaction.aggregate({
      where: { year, month, status: "COMPLETED", accountId: { in: checkingIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { year, month, status: "PENDING", accountId: { in: checkingIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { year, month, status: "COMPLETED", destinationAccountId: { in: checkingIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { year, month, status: "PENDING", destinationAccountId: { in: checkingIds } },
      _sum: { amount: true },
    }),
  ]);

  // Virements entrants : amount est négatif (quitte la source), on inverse pour le crédit sur checking
  const realTotal = (completed._sum.amount?.toNumber() ?? 0) + -(incomingCompleted._sum.amount?.toNumber() ?? 0);
  const pendingTotal = (pending._sum.amount?.toNumber() ?? 0) + -(incomingPending._sum.amount?.toNumber() ?? 0);

  return {
    real: realTotal,
    pending: pendingTotal,
    forecast: realTotal + pendingTotal,
  };
}

export async function createTransaction(data: Record<string, unknown>) {
  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.transaction.create({
    data: {
      label: parsed.data.label,
      amount: new Prisma.Decimal(parsed.data.amount),
      date: parsed.data.date,
      month: parsed.data.month,
      year: parsed.data.year,
      status: parsed.data.status,
      note: parsed.data.note || null,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId,
      subCategoryId: parsed.data.subCategoryId || null,
      bucketId: parsed.data.bucketId || null,
      isAmex: parsed.data.isAmex,
      destinationAccountId: parsed.data.destinationAccountId || null,
    },
  });
  await recomputeMonthlyBalance(parsed.data.year, parsed.data.month);
  revalidatePath("/transactions");
  return { success: true };
}

export async function updateTransaction(id: string, data: Record<string, unknown>) {
  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const oldTransaction = await prisma.transaction.findUnique({
    where: { id },
    select: { year: true, month: true },
  });

  await prisma.transaction.update({
    where: { id },
    data: {
      label: parsed.data.label,
      amount: new Prisma.Decimal(parsed.data.amount),
      date: parsed.data.date,
      month: parsed.data.month,
      year: parsed.data.year,
      status: parsed.data.status,
      note: parsed.data.note || null,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId,
      subCategoryId: parsed.data.subCategoryId || null,
      bucketId: parsed.data.bucketId || null,
      isAmex: parsed.data.isAmex,
      destinationAccountId: parsed.data.destinationAccountId || null,
    },
  });

  await recomputeMonthlyBalance(parsed.data.year, parsed.data.month);
  if (oldTransaction && (oldTransaction.year !== parsed.data.year || oldTransaction.month !== parsed.data.month)) {
    await recomputeMonthlyBalance(oldTransaction.year, oldTransaction.month);
  }

  revalidatePath("/transactions");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: { year: true, month: true },
  });

  await prisma.transaction.delete({ where: { id } });

  if (transaction) {
    await recomputeMonthlyBalance(transaction.year, transaction.month);
  }

  revalidatePath("/transactions");
  return { success: true };
}

export async function markTransactionCompleted(id: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: { year: true, month: true },
  });

  await prisma.transaction.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  if (transaction) {
    await recomputeMonthlyBalance(transaction.year, transaction.month);
  }

  revalidatePath("/transactions");
  return { success: true };
}

export async function completeAmexTransactions(year: number, month: number) {
  const result = await prisma.transaction.updateMany({
    where: {
      year,
      month,
      status: "PENDING",
      isAmex: true,
    },
    data: { status: "COMPLETED" },
  });

  await recomputeMonthlyBalance(year, month);
  revalidatePath("/transactions");
  return { count: result.count };
}

export async function cancelTransaction(id: string, note: string) {
  if (!note.trim()) return { error: "Une note est requise pour annuler" };

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: { year: true, month: true },
  });

  await prisma.transaction.update({
    where: { id },
    data: { status: "CANCELLED", note },
  });

  if (transaction) {
    await recomputeMonthlyBalance(transaction.year, transaction.month);
  }

  revalidatePath("/transactions");
  return { success: true };
}

export async function updateTransactionField(
  id: string,
  fields: Partial<{
    label: string;
    amount: number;
    date: string | null;
    month: number;
    year: number;
    accountId: string;
    categoryId: string;
    subCategoryId: string | null;
    bucketId: string | null;
    status: string;
    note: string | null;
    isAmex: boolean;
    destinationAccountId: string | null;
  }>
) {
  const oldTransaction = await prisma.transaction.findUnique({
    where: { id },
    select: { year: true, month: true },
  });

  const data: Record<string, unknown> = {};

  if (fields.label !== undefined) data.label = fields.label;
  if (fields.amount !== undefined) data.amount = new Prisma.Decimal(fields.amount);
  if (fields.date !== undefined) {
    if (fields.date === null) {
      data.date = null;
    } else {
      const d = new Date(fields.date);
      data.date = d;
      data.month = d.getMonth() + 1;
      data.year = d.getFullYear();
    }
  }
  if (fields.month !== undefined) data.month = fields.month;
  if (fields.year !== undefined) data.year = fields.year;
  if (fields.accountId !== undefined) data.accountId = fields.accountId;
  if (fields.categoryId !== undefined) data.categoryId = fields.categoryId;
  if (fields.subCategoryId !== undefined) data.subCategoryId = fields.subCategoryId;
  if (fields.bucketId !== undefined) data.bucketId = fields.bucketId;
  if (fields.status !== undefined) data.status = fields.status;
  if (fields.note !== undefined) data.note = fields.note;
  if (fields.isAmex !== undefined) data.isAmex = fields.isAmex;
  if (fields.destinationAccountId !== undefined) data.destinationAccountId = fields.destinationAccountId;

  const updated = await prisma.transaction.update({
    where: { id },
    data,
    select: { year: true, month: true },
  });

  await recomputeMonthlyBalance(updated.year, updated.month);
  if (oldTransaction && (oldTransaction.year !== updated.year || oldTransaction.month !== updated.month)) {
    await recomputeMonthlyBalance(oldTransaction.year, oldTransaction.month);
  }

  revalidatePath("/transactions");
  return { success: true };
}

export async function copyRecurringTransactions(year: number, month: number) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const previousRecurring = await prisma.transaction.findMany({
    where: { year: prevYear, month: prevMonth, date: null },
  });

  if (previousRecurring.length === 0) {
    return { error: "Aucune transaction récurrente trouvée pour le mois précédent" };
  }

  // Supprimer les récurrentes existantes du mois cible
  await prisma.transaction.deleteMany({
    where: { year, month, date: null },
  });

  // Copier avec status PENDING et sans note
  for (const t of previousRecurring) {
    await prisma.transaction.create({
      data: {
        label: t.label,
        amount: t.amount,
        date: null,
        month,
        year,
        status: "PENDING",
        note: null,
        accountId: t.accountId,
        categoryId: t.categoryId,
        subCategoryId: t.subCategoryId,
        bucketId: t.bucketId,
        isAmex: t.isAmex,
        destinationAccountId: t.destinationAccountId,
      },
    });
  }

  await recomputeMonthlyBalance(year, month);
  revalidatePath("/transactions");
  return { success: true, count: previousRecurring.length };
}

export async function getPreviousMonthBudgetRemaining(year: number, month: number) {
  return getCarryOver(year, month);
}

export async function getFormData() {
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      include: {
        buckets: { orderBy: { sortOrder: "asc" } },
        linkedCards: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.category.findMany({
      include: { subCategories: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      buckets: a.buckets.map((b) => ({
        id: b.id,
        name: b.name,
      })),
      linkedCards: a.linkedCards.map((c) => ({
        id: c.id,
        name: c.name,
      })),
    })),
    categories: categories
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        subCategories: c.subCategories
          .sort((a, b) => a.name.localeCompare(b.name, "fr"))
          .map((s) => ({
            id: s.id,
            name: s.name,
          })),
      })),
  };
}
