"use server";

import { db, transactions, accounts, buckets, budgets } from "@/lib/db";
import { eq, and, inArray, sql, desc, asc, isNotNull } from "drizzle-orm";
import { toNumber, toISOString, round2 } from "@/lib/db/helpers";
import { getCarryOver } from "@/lib/monthly-balance";

export async function getDashboardData(year: number, month: number) {
  const checkingAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.type, "CHECKING"));
  const checkingIds = checkingAccounts.map((a) => a.id);

  const [totals, income, expenses, carryOver, accountList, overBudget, recent, recentXfers] =
    await Promise.all([
      getTotals(year, month, checkingIds),
      getIncomeExpenses(year, month, "income"),
      getIncomeExpenses(year, month, "expenses"),
      getCarryOver(year, month),
      getAccountsWithBalance(),
      getOverBudgetCategories(year, month),
      getRecentTransactions(year, month),
      getRecentTransfers(year, month),
    ]);

  return { totals, income, expenses, carryOver, accounts: accountList, overBudgetCategories: overBudget, recentTransactions: recent, recentTransfers: recentXfers };
}

async function getTotals(year: number, month: number, checkingIds: string[]) {
  if (checkingIds.length === 0) return { real: 0, pending: 0, forecast: 0 };

  const [completed, pending, incomingCompleted, incomingPending] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month), eq(transactions.status, "COMPLETED"), inArray(transactions.accountId, checkingIds))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month), eq(transactions.status, "PENDING"), inArray(transactions.accountId, checkingIds))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month), eq(transactions.status, "COMPLETED"), inArray(transactions.destinationAccountId, checkingIds))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.year, year), eq(transactions.month, month), eq(transactions.status, "PENDING"), inArray(transactions.destinationAccountId, checkingIds))),
  ]);

  const realTotal = round2(toNumber(completed[0].total) + -(toNumber(incomingCompleted[0].total)));
  const pendingTotal = round2(toNumber(pending[0].total) + -(toNumber(incomingPending[0].total)));

  return {
    real: realTotal,
    pending: pendingTotal,
    forecast: round2(realTotal + pendingTotal),
  };
}

async function getIncomeExpenses(year: number, month: number, type: "income" | "expenses") {
  const condition = type === "income" ? sql`${transactions.amount} > 0` : sql`${transactions.amount} < 0`;
  const [result] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.year, year),
        eq(transactions.month, month),
        inArray(transactions.status, ["COMPLETED", "PENDING"]),
        condition
      )
    );
  return toNumber(result.total);
}

async function getAccountsWithBalance() {
  const allAccounts = await db.query.accounts.findMany({
    orderBy: [asc(accounts.sortOrder)],
  });

  const balances = await Promise.all(
    allAccounts.map(async (a) => {
      const isSavingsType = a.type === "SAVINGS" || a.type === "INVESTMENT";

      const [outgoing, incoming, baseAmounts] = await Promise.all([
        db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
          .from(transactions)
          .where(and(eq(transactions.accountId, a.id), eq(transactions.status, "COMPLETED"))),
        db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
          .from(transactions)
          .where(and(eq(transactions.destinationAccountId, a.id), eq(transactions.status, "COMPLETED"))),
        isSavingsType
          ? db.select({ total: sql<string>`coalesce(sum(${buckets.baseAmount}), 0)` })
              .from(buckets)
              .where(eq(buckets.accountId, a.id))
          : Promise.resolve([{ total: "0" }]),
      ]);

      const outgoingTotal = toNumber(outgoing[0].total);
      const incomingTotal = toNumber(incoming[0].total);
      const baseTotal = toNumber(baseAmounts[0].total);
      const balance = isSavingsType
        ? round2(baseTotal + -(outgoingTotal) + -(incomingTotal))
        : round2(outgoingTotal + -(incomingTotal));

      return {
        id: a.id,
        name: a.name,
        type: a.type,
        color: a.color,
        balance,
      };
    })
  );

  return balances;
}

async function getOverBudgetCategories(year: number, month: number) {
  const allCategories = await db.query.categories.findMany({
    with: {
      budgets: {
        where: and(eq(budgets.year, year), eq(budgets.month, month)),
      },
    },
  });

  const spent = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.year, year),
        eq(transactions.month, month),
        inArray(transactions.status, ["COMPLETED", "PENDING"])
      )
    )
    .groupBy(transactions.categoryId);

  const spentMap = new Map<string, number>(
    spent.filter((s) => s.categoryId != null).map((s) => {
      const net = toNumber(s.total);
      return [s.categoryId as string, net < 0 ? round2(Math.abs(net)) : 0];
    })
  );

  return allCategories
    .map((cat) => {
      const budgeted = round2(cat.budgets[0] ? toNumber(cat.budgets[0].amount) : 0);
      const spentAmount = spentMap.get(cat.id) ?? 0;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        budgeted,
        spent: spentAmount,
        remaining: round2(budgeted - spentAmount),
      };
    })
    .filter((c) => c.spent > c.budgeted && c.spent > 0)
    .sort((a, b) => a.remaining - b.remaining);
}

async function getRecentTransactions(year: number, month: number) {
  const result = await db.query.transactions.findMany({
    where: and(eq(transactions.year, year), eq(transactions.month, month)),
    with: {
      category: true,
      account: true,
    },
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    limit: 5,
  });

  return result.map((t) => ({
    id: t.id,
    label: t.label,
    amount: toNumber(t.amount),
    date: t.date ? toISOString(t.date) : null,
    status: t.status,
    category: t.category ? { name: t.category.name, color: t.category.color } : null,
    account: t.account ? { name: t.account.name, color: t.account.color } : null,
  }));
}

async function getRecentTransfers(year: number, month: number) {
  const result = await db.query.transactions.findMany({
    where: and(
      eq(transactions.year, year),
      eq(transactions.month, month),
      isNotNull(transactions.destinationAccountId)
    ),
    with: {
      account: true,
      destinationAccount: true,
    },
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    limit: 5,
  });

  return result.map((t) => ({
    id: t.id,
    label: t.label,
    amount: toNumber(t.amount),
    date: t.date ? toISOString(t.date) : null,
    status: t.status,
    account: t.account ? { name: t.account.name, color: t.account.color } : null,
    destinationAccount: t.destinationAccount
      ? { name: t.destinationAccount.name, color: t.destinationAccount.color }
      : null,
  }));
}
