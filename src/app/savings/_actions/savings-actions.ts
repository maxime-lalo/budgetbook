"use server";

import { db, transactions, accounts, buckets } from "@/lib/db";
import { eq, and, or, inArray, isNotNull, sql, asc } from "drizzle-orm";
import { toNumber, toISOString, round2 } from "@/lib/db/helpers";

export async function getSavingsTransactions(year: number) {
  const savingsAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.type, ["SAVINGS", "INVESTMENT"]));
  const savingsIds = savingsAccounts.map((a) => a.id);

  if (savingsIds.length === 0) return [];

  const result = await db.query.transactions.findMany({
    where: and(
      eq(transactions.year, year),
      or(
        inArray(transactions.accountId, savingsIds),
        inArray(transactions.destinationAccountId, savingsIds)
      )
    ),
    with: {
      account: true,
      category: true,
      subCategory: true,
      bucket: true,
      destinationAccount: { columns: { name: true, color: true } },
    },
    orderBy: [
      sql`CASE WHEN ${transactions.recurring} THEN 0 ELSE 1 END`,
      asc(transactions.date),
      asc(transactions.createdAt),
      asc(transactions.label),
    ],
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
    recurring: t.recurring,
    destinationAccountId: t.destinationAccountId,
    account: t.account ? { name: t.account.name, color: t.account.color } : null,
    destinationAccount: t.destinationAccount ? { name: t.destinationAccount.name, color: t.destinationAccount.color } : null,
    category: t.category ? { name: t.category.name, color: t.category.color } : null,
    subCategory: t.subCategory ? { name: t.subCategory.name } : null,
    bucket: t.bucket ? { name: t.bucket.name } : null,
  }));
}

export async function getSavingsTotals(year: number) {
  const savingsAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.type, ["SAVINGS", "INVESTMENT"]));
  const savingsIds = savingsAccounts.map((a) => a.id);

  if (savingsIds.length === 0) {
    return { real: 0, pending: 0, forecast: 0 };
  }

  const statusFilter = ["COMPLETED", "PENDING"] as const;

  const [completed, pending, incomingCompleted, incomingPending, baseAmounts] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.status, "COMPLETED"), inArray(transactions.accountId, savingsIds))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.status, "PENDING"), inArray(transactions.accountId, savingsIds))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.status, "COMPLETED"), inArray(transactions.destinationAccountId, savingsIds))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.status, "PENDING"), inArray(transactions.destinationAccountId, savingsIds))),
    db.select({ total: sql<string>`coalesce(sum(${buckets.baseAmount}), 0)` })
      .from(buckets)
      .where(inArray(buckets.accountId, savingsIds)),
  ]);

  const baseTotal = toNumber(baseAmounts[0].total);

  const realTotal = round2(baseTotal + toNumber(completed[0].total) + -(toNumber(incomingCompleted[0].total)));
  const pendingTotal = round2(toNumber(pending[0].total) + -(toNumber(incomingPending[0].total)));

  return {
    real: realTotal,
    pending: pendingTotal,
    forecast: round2(realTotal + pendingTotal),
  };
}
