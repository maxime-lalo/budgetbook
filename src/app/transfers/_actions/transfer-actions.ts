"use server";

import { db, transactions, accounts, buckets } from "@/lib/db";
import { eq, and, isNotNull, asc, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { transactionSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";
import { toNumber, toISOString, toDbDate } from "@/lib/db/helpers";

export async function getTransfers(year: number, month: number) {
  const result = await db.query.transactions.findMany({
    where: and(
      eq(transactions.year, year),
      eq(transactions.month, month),
      isNotNull(transactions.destinationAccountId)
    ),
    with: {
      account: true,
      category: true,
      subCategory: true,
      bucket: true,
      destinationAccount: true,
    },
    orderBy: [desc(transactions.date), asc(transactions.createdAt)],
  });

  return result.map((t) => ({
    id: t.id,
    label: t.label,
    amount: toNumber(t.amount),
    date: t.date ? toISOString(t.date) : null,
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
    account: t.account ? { name: t.account.name, color: t.account.color, type: t.account.type } : null,
    destinationAccount: t.destinationAccount
      ? { name: t.destinationAccount.name, color: t.destinationAccount.color, type: t.destinationAccount.type }
      : null,
    category: t.category ? { name: t.category.name, color: t.category.color } : null,
    subCategory: t.subCategory ? { name: t.subCategory.name } : null,
    bucket: t.bucket ? { name: t.bucket.name } : null,
  }));
}

export async function getTransferFormData() {
  const [accountList, categoryList] = await Promise.all([
    db.query.accounts.findMany({
      with: {
        buckets: { orderBy: [asc(buckets.sortOrder)] },
      },
      orderBy: [asc(accounts.sortOrder)],
    }),
    db.query.categories.findMany({
      with: { subCategories: true },
    }),
  ]);

  return {
    accounts: accountList.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      color: a.color,
      buckets: a.buckets.map((b) => ({
        id: b.id,
        name: b.name,
      })),
    })),
    categories: categoryList
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

function revalidateAll() {
  revalidatePath("/transfers");
  revalidatePath("/transactions");
  revalidatePath("/savings");
}

export async function createTransfer(data: Record<string, unknown>) {
  const transferData = {
    ...data,
    amount: -Math.abs(Number(data.amount)),
    isAmex: false,
  };

  const parsed = transactionSchema.safeParse(transferData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.insert(transactions).values({
    id: createId(),
    label: parsed.data.label,
    amount: parsed.data.amount.toString(),
    date: parsed.data.date ? toDbDate(parsed.data.date) : null,
    month: parsed.data.month,
    year: parsed.data.year,
    status: parsed.data.status,
    note: parsed.data.note || null,
    accountId: parsed.data.accountId,
    categoryId: parsed.data.categoryId,
    subCategoryId: parsed.data.subCategoryId || null,
    bucketId: parsed.data.bucketId || null,
    isAmex: false,
    destinationAccountId: parsed.data.destinationAccountId || null,
  });

  await recomputeMonthlyBalance(parsed.data.year, parsed.data.month);
  revalidateAll();
  return { success: true };
}

export async function updateTransfer(id: string, data: Record<string, unknown>) {
  const transferData = {
    ...data,
    amount: -Math.abs(Number(data.amount)),
    isAmex: false,
  };

  const parsed = transactionSchema.safeParse(transferData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const oldTransaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
    columns: { year: true, month: true },
  });

  await db.update(transactions).set({
    label: parsed.data.label,
    amount: parsed.data.amount.toString(),
    date: parsed.data.date ? toDbDate(parsed.data.date) : null,
    month: parsed.data.month,
    year: parsed.data.year,
    status: parsed.data.status,
    note: parsed.data.note || null,
    accountId: parsed.data.accountId,
    categoryId: parsed.data.categoryId,
    subCategoryId: parsed.data.subCategoryId || null,
    bucketId: parsed.data.bucketId || null,
    isAmex: false,
    destinationAccountId: parsed.data.destinationAccountId || null,
  }).where(eq(transactions.id, id));

  await recomputeMonthlyBalance(parsed.data.year, parsed.data.month);
  if (oldTransaction && (oldTransaction.year !== parsed.data.year || oldTransaction.month !== parsed.data.month)) {
    await recomputeMonthlyBalance(oldTransaction.year, oldTransaction.month);
  }

  revalidateAll();
  return { success: true };
}

export async function deleteTransfer(id: string) {
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
    columns: { year: true, month: true },
  });

  await db.delete(transactions).where(eq(transactions.id, id));

  if (transaction) {
    await recomputeMonthlyBalance(transaction.year, transaction.month);
  }

  revalidateAll();
  return { success: true };
}
