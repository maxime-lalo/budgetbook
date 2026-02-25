import { db, transactions, budgets, monthlyBalances } from "@/lib/db";
import { eq, and, or, inArray, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { toNumber, round2, getCheckingAccountIds } from "@/lib/db/helpers";

export async function recomputeMonthlyBalance(year: number, month: number) {
  // 1. Forecast = même logique que getTransactionTotals (comptes CHECKING uniquement + virements entrants)
  const checkingIds = await getCheckingAccountIds();

  let totalForecast = 0;
  if (checkingIds.length > 0) {
    const statusFilter = inArray(transactions.status, ["COMPLETED", "PENDING", "PLANNED"]);
    const monthFilter = and(eq(transactions.year, year), eq(transactions.month, month));

    const [onChecking, incomingToChecking] = await Promise.all([
      db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(and(monthFilter, statusFilter, inArray(transactions.accountId, checkingIds))),
      db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(and(monthFilter, statusFilter, inArray(transactions.destinationAccountId, checkingIds))),
    ]);

    totalForecast = round2(toNumber(onChecking[0].total) + -(toNumber(incomingToChecking[0].total)));
  }

  // 2. Montant NET par catégorie (inclut remboursements)
  // Même logique que getBudgetsWithSpent : net < 0 → dépense, sinon 0
  // Filtré sur comptes CHECKING uniquement (cohérent avec le forecast)
  const netByCategory = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.year, year),
        eq(transactions.month, month),
        inArray(transactions.status, ["COMPLETED", "PENDING", "PLANNED"]),
        checkingIds.length > 0 ? inArray(transactions.accountId, checkingIds) : undefined
      )
    )
    .groupBy(transactions.categoryId);

  // 3. Budgets du mois
  const monthBudgets = await db.query.budgets.findMany({
    where: and(eq(budgets.year, year), eq(budgets.month, month)),
  });

  // 4. committed = Σ max(0, budgété - dépensé_net) par catégorie
  const budgetMap = new Map(monthBudgets.map((b) => [b.categoryId, toNumber(b.amount)]));
  const spentMap = new Map(
    netByCategory.filter((s) => s.categoryId != null).map((s) => {
      const net = toNumber(s.total);
      return [s.categoryId as string, net < 0 ? round2(Math.abs(net)) : 0];
    })
  );

  const allCategoryIds = new Set([...budgetMap.keys(), ...spentMap.keys()]);
  let totalCommitted = 0;
  for (const id of allCategoryIds) {
    const budgeted = budgetMap.get(id) ?? 0;
    const spent = spentMap.get(id) ?? 0;
    totalCommitted += Math.max(0, round2(budgeted - spent));
  }
  totalCommitted = round2(totalCommitted);

  // 5. surplus = forecast - committed
  const surplus = round2(totalForecast - totalCommitted);

  // 6. Upsert dans monthly_balances
  const existing = await db.query.monthlyBalances.findFirst({
    where: and(eq(monthlyBalances.year, year), eq(monthlyBalances.month, month)),
  });

  if (existing) {
    await db
      .update(monthlyBalances)
      .set({
        forecast: totalForecast.toString(),
        committed: totalCommitted.toString(),
        surplus: surplus.toString(),
      })
      .where(eq(monthlyBalances.id, existing.id));
  } else {
    await db.insert(monthlyBalances).values({
      id: createId(),
      year,
      month,
      forecast: totalForecast.toString(),
      committed: totalCommitted.toString(),
      surplus: surplus.toString(),
    });
  }
}

export async function getCarryOver(year: number, month: number) {
  const balances = await db.query.monthlyBalances.findMany({
    where: or(
      lt(monthlyBalances.year, year),
      and(eq(monthlyBalances.year, year), lt(monthlyBalances.month, month))
    ),
    columns: { surplus: true },
  });
  return round2(balances.reduce((sum: number, b: { surplus: string | number }) => sum + toNumber(b.surplus), 0));
}

export async function backfillAllMonthlyBalances() {
  const distinctMonths = await db
    .selectDistinct({ year: transactions.year, month: transactions.month })
    .from(transactions)
    .orderBy(transactions.year, transactions.month);

  for (const { year, month } of distinctMonths) {
    await recomputeMonthlyBalance(year, month);
  }
}
