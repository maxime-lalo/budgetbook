import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function recomputeMonthlyBalance(year: number, month: number) {
  // 1. Forecast = somme de toutes les transactions COMPLETED + PENDING
  const forecast = await prisma.transaction.aggregate({
    where: {
      year,
      month,
      status: { in: ["COMPLETED", "PENDING"] },
    },
    _sum: { amount: true },
  });

  const totalForecast = forecast._sum.amount?.toNumber() ?? 0;

  // 2. Dépenses par catégorie (montant < 0)
  const spentByCategory = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      year,
      month,
      status: { in: ["COMPLETED", "PENDING"] },
      amount: { lt: 0 },
    },
    _sum: { amount: true },
  });

  // 3. Budgets du mois
  const budgets = await prisma.budget.findMany({
    where: { year, month },
  });

  // 4. committed = Σ max(0, budgété - dépensé) par catégorie
  //    = réservation de budget non encore consommée
  //    (les dépenses sont déjà incluses dans le forecast, pas de double-comptage)
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount.toNumber()]));
  const spentMap = new Map(
    spentByCategory.map((s) => [s.categoryId, Math.abs(s._sum.amount?.toNumber() ?? 0)])
  );

  const allCategoryIds = new Set([...budgetMap.keys(), ...spentMap.keys()]);
  let totalCommitted = 0;
  for (const id of allCategoryIds) {
    const budgeted = budgetMap.get(id) ?? 0;
    const spent = spentMap.get(id) ?? 0;
    totalCommitted += Math.max(0, budgeted - spent);
  }

  // 5. surplus = forecast - committed
  const surplus = totalForecast - totalCommitted;

  // 6. Upsert dans monthly_balances
  await prisma.monthlyBalance.upsert({
    where: { year_month: { year, month } },
    update: {
      forecast: new Prisma.Decimal(totalForecast),
      committed: new Prisma.Decimal(totalCommitted),
      surplus: new Prisma.Decimal(surplus),
    },
    create: {
      year,
      month,
      forecast: new Prisma.Decimal(totalForecast),
      committed: new Prisma.Decimal(totalCommitted),
      surplus: new Prisma.Decimal(surplus),
    },
  });
}

export async function getCarryOver(year: number, month: number) {
  const balances = await prisma.monthlyBalance.findMany({
    where: {
      OR: [
        { year: { lt: year } },
        { year, month: { lt: month } },
      ],
    },
    select: { surplus: true },
  });
  return balances.reduce((sum, b) => sum + b.surplus.toNumber(), 0);
}

export async function backfillAllMonthlyBalances() {
  const distinctMonths = await prisma.transaction.findMany({
    select: { year: true, month: true },
    distinct: ["year", "month"],
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  for (const { year, month } of distinctMonths) {
    await recomputeMonthlyBalance(year, month);
  }
}
