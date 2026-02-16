"use server";

import { prisma } from "@/lib/prisma";

export async function getSavingsTransactions(year: number) {
  const transactions = await prisma.transaction.findMany({
    where: {
      year,
      OR: [
        { account: { type: { in: ["SAVINGS", "INVESTMENT"] } } },
        { destinationAccount: { type: { in: ["SAVINGS", "INVESTMENT"] } } },
      ],
    },
    include: {
      account: true,
      category: true,
      subCategory: true,
      bucket: true,
      destinationAccount: { select: { name: true, color: true } },
    },
    orderBy: [{ date: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }, { label: "asc" }],
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

export async function getSavingsTotals(year: number) {
  const savingsAccounts = await prisma.account.findMany({
    where: { type: { in: ["SAVINGS", "INVESTMENT"] } },
    select: { id: true },
  });
  const savingsIds = savingsAccounts.map((a) => a.id);

  // Transactions dont le compte source est un compte épargne
  // + virements entrants vers un compte épargne (amount négatif → inversé = crédit)
  const [completed, pending, incomingCompleted, incomingPending] = await Promise.all([
    prisma.transaction.aggregate({
      where: { year, status: "COMPLETED", accountId: { in: savingsIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { year, status: "PENDING", accountId: { in: savingsIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { year, status: "COMPLETED", destinationAccountId: { in: savingsIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { year, status: "PENDING", destinationAccountId: { in: savingsIds } },
      _sum: { amount: true },
    }),
  ]);

  // Virements entrants : amount est négatif (quitte la source), on inverse pour le crédit sur épargne
  const realTotal = (completed._sum.amount?.toNumber() ?? 0) + -(incomingCompleted._sum.amount?.toNumber() ?? 0);
  const pendingTotal = (pending._sum.amount?.toNumber() ?? 0) + -(incomingPending._sum.amount?.toNumber() ?? 0);

  return {
    real: realTotal,
    pending: pendingTotal,
    forecast: realTotal + pendingTotal,
  };
}
