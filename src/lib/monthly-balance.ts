import { db, transactions, budgets, monthlyBalances } from "@/lib/db";
import { eq, and, or, lt, inArray, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { toNumber, round2 } from "@/lib/db/helpers";

export async function recomputeMonthlyBalance(year: number, month: number) {
  // 1. Forecast = somme de toutes les transactions COMPLETED + PENDING
  const [forecastResult] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.year, year),
        eq(transactions.month, month),
        inArray(transactions.status, ["COMPLETED", "PENDING"])
      )
    );
  const totalForecast = toNumber(forecastResult.total);

  // 2. Dépenses par catégorie (montant < 0)
  const spentByCategory = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.year, year),
        eq(transactions.month, month),
        inArray(transactions.status, ["COMPLETED", "PENDING"]),
        lt(transactions.amount, "0")
      )
    )
    .groupBy(transactions.categoryId);

  // 3. Budgets du mois
  const monthBudgets = await db.query.budgets.findMany({
    where: and(eq(budgets.year, year), eq(budgets.month, month)),
  });

  // 4. committed = Σ max(0, budgété - dépensé) par catégorie
  const budgetMap = new Map(monthBudgets.map((b) => [b.categoryId, toNumber(b.amount)]));
  const spentMap = new Map(
    spentByCategory.map((s) => [s.categoryId, Math.abs(toNumber(s.total))])
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
