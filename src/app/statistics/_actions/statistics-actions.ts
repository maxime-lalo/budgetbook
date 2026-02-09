"use server";

import { prisma } from "@/lib/prisma";

export async function getYearlyOverview(year: number, accountId?: string) {
  // Exclure les comptes épargne/investissement pour avoir les vrais revenus vs dépenses
  const realAccounts = accountId
    ? undefined
    : await prisma.account.findMany({
        where: { type: { in: ["CHECKING", "CREDIT_CARD"] } },
        select: { id: true },
      });
  const accountFilter = accountId
    ? { accountId }
    : realAccounts
      ? { accountId: { in: realAccounts.map((a) => a.id) } }
      : {};

  const data = [];

  for (let month = 1; month <= 12; month++) {
    const where = {
      year,
      month,
      status: { in: ["COMPLETED" as const, "PENDING" as const] },
      destinationAccountId: null,
      ...accountFilter,
    };

    const [income, expenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...where, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
    ]);

    data.push({
      month,
      monthLabel: new Date(year, month - 1).toLocaleDateString("fr-FR", { month: "short" }),
      income: income._sum.amount?.toNumber() ?? 0,
      expenses: Math.abs(expenses._sum.amount?.toNumber() ?? 0),
    });
  }

  return data;
}

export async function getCategoryBreakdown(year: number, month: number, accountId?: string) {
  const realAccounts = accountId
    ? undefined
    : await prisma.account.findMany({
        where: { type: { in: ["CHECKING", "CREDIT_CARD"] } },
        select: { id: true },
      });
  const accountFilter = accountId
    ? { accountId }
    : realAccounts
      ? { accountId: { in: realAccounts.map((a) => a.id) } }
      : {};

  const result = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      year,
      month: { lte: month },
      status: { in: ["COMPLETED", "PENDING"] },
      ...accountFilter,
    },
    _sum: { amount: true },
  });

  const categories = await prisma.category.findMany({
    where: { id: { in: result.map((r) => r.categoryId) } },
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));

  return result
    .map((r) => {
      const cat = catMap.get(r.categoryId);
      return {
        category: cat?.name ?? "Sans catégorie",
        color: cat?.color ?? "#6b7280",
        amount: -(r._sum.amount?.toNumber() ?? 0),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export async function getSubCategoryBreakdown(year: number, month: number, accountId?: string) {
  const realAccounts = accountId
    ? undefined
    : await prisma.account.findMany({
        where: { type: { in: ["CHECKING", "CREDIT_CARD"] } },
        select: { id: true },
      });
  const accountFilter = accountId
    ? { accountId }
    : realAccounts
      ? { accountId: { in: realAccounts.map((a) => a.id) } }
      : {};

  const result = await prisma.transaction.groupBy({
    by: ["categoryId", "subCategoryId"],
    where: {
      year,
      month: { lte: month },
      status: { in: ["COMPLETED", "PENDING"] },
      subCategoryId: { not: null },
      ...accountFilter,
    },
    _sum: { amount: true },
  });

  const categoryIds = [...new Set(result.map((r) => r.categoryId))];
  const subCategoryIds = result.map((r) => r.subCategoryId).filter((id): id is string => id !== null);

  const [categories, subCategories] = await Promise.all([
    prisma.category.findMany({ where: { id: { in: categoryIds } } }),
    prisma.subCategory.findMany({ where: { id: { in: subCategoryIds } } }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const subMap = new Map(subCategories.map((s) => [s.id, s]));

  const items = result.map((r) => {
    const cat = catMap.get(r.categoryId);
    const sub = subMap.get(r.subCategoryId!);
    return {
      categoryId: r.categoryId,
      subCategory: sub?.name ?? "?",
      color: cat?.color ?? "#6b7280",
      amount: -(r._sum.amount?.toNumber() ?? 0),
    };
  });

  const availableCategories = [...catMap.values()]
    .map((c) => ({ id: c.id, name: c.name, color: c.color }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return { items, categories: availableCategories };
}

export async function getCategoryYearComparison(
  year: number,
  month: number,
  accountId?: string
) {
  // Exclure les comptes épargne/investissement pour éviter le double comptage des transferts
  const realAccounts = accountId
    ? undefined
    : await prisma.account.findMany({
        where: { type: { in: ["CHECKING", "CREDIT_CARD"] } },
        select: { id: true },
      });
  const accountFilter = accountId
    ? { accountId }
    : realAccounts
      ? { accountId: { in: realAccounts.map((a) => a.id) } }
      : {};

  const baseWhere = {
    status: { in: ["COMPLETED" as const, "PENDING" as const] },
    ...accountFilter,
  };

  const [currentMonthData, currentYearData, prevYearData] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...baseWhere, year, month },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...baseWhere, year, month: { lte: month } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...baseWhere, year: year - 1 },
      _sum: { amount: true },
    }),
  ]);

  const allCatIds = [
    ...new Set([
      ...currentMonthData.map((r) => r.categoryId),
      ...currentYearData.map((r) => r.categoryId),
      ...prevYearData.map((r) => r.categoryId),
    ]),
  ];

  const categories = await prisma.category.findMany({
    where: { id: { in: allCatIds } },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Négation : dépenses (négatif en BDD) → positif, rentrées (positif en BDD) → négatif
  const currentMonthMap = new Map(
    currentMonthData.map((r) => [r.categoryId, -(r._sum.amount?.toNumber() ?? 0)])
  );
  const currentYearMap = new Map(
    currentYearData.map((r) => [r.categoryId, -(r._sum.amount?.toNumber() ?? 0)])
  );
  const prevYearMap = new Map(
    prevYearData.map((r) => [r.categoryId, -(r._sum.amount?.toNumber() ?? 0)])
  );

  // Totaux en valeur absolue pour les pourcentages
  const currentYearAbsTotal = [...currentYearMap.values()].reduce((a, b) => a + Math.abs(b), 0);
  const currentMonthAbsTotal = [...currentMonthMap.values()].reduce((a, b) => a + Math.abs(b), 0);

  const rows = categories.map((c) => c.id)
    .map((catId) => {
      const cat = catMap.get(catId);
      const thisMonth = currentMonthMap.get(catId) ?? 0;
      const thisYear = currentYearMap.get(catId) ?? 0;
      const prevYear = prevYearMap.get(catId) ?? 0;
      const currentAvg = thisYear / 12;
      const currentPeriodAvg = thisYear / month;
      const prevAvg = prevYear / 12;
      const diffPercent = prevAvg === 0 ? (currentPeriodAvg !== 0 ? 100 : 0) : ((currentPeriodAvg - prevAvg) / Math.abs(prevAvg)) * 100;

      return {
        category: cat?.name ?? "Sans catégorie",
        color: cat?.color ?? "#6b7280",
        currentMonth: thisMonth,
        currentAvg,
        yearlyTotal: thisYear,
        percentOfMonthTotal: currentMonthAbsTotal > 0 ? (Math.abs(thisMonth) / currentMonthAbsTotal) * 100 : 0,
        percentOfYearTotal: currentYearAbsTotal > 0 ? (Math.abs(thisYear) / currentYearAbsTotal) * 100 : 0,
        prevYearAvg: prevAvg,
        diffPercent,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category, "fr"));

  // Totaux : uniquement les catégories de dépenses (valeurs > 0), pas les revenus
  const sumPositive = (values: IterableIterator<number>) =>
    [...values].filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const totals = {
    currentMonth: sumPositive(currentMonthMap.values()),
    yearlyTotal: sumPositive(currentYearMap.values()),
    prevYearTotal: sumPositive(prevYearMap.values()),
  };

  return { rows, totals, month };
}

export async function getSavingsOverview(year: number) {
  const savingsAccounts = await prisma.account.findMany({
    where: { type: { in: ["SAVINGS", "INVESTMENT"] } },
    select: { id: true },
  });

  const accountIds = savingsAccounts.map((a) => a.id);
  if (accountIds.length === 0) {
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthLabel: new Date(year, i).toLocaleDateString("fr-FR", { month: "short" }),
      total: 0,
    }));
  }

  const statusFilter = { in: ["COMPLETED" as const, "PENDING" as const] };

  // Cumul des années précédentes
  const [prevStandalone, prevIncoming, prevOutgoing, totalBaseAmount] = await Promise.all([
    // Transactions standalone sur comptes épargne (pas de destination) → signe inversé
    prisma.transaction.aggregate({
      where: {
        accountId: { in: accountIds },
        destinationAccountId: null,
        status: statusFilter,
        year: { lt: year },
      },
      _sum: { amount: true },
    }),
    // Virements entrants vers comptes épargne → negate (négatif → crédit positif)
    prisma.transaction.aggregate({
      where: {
        destinationAccountId: { in: accountIds },
        status: statusFilter,
        year: { lt: year },
      },
      _sum: { amount: true },
    }),
    // Virements sortants depuis comptes épargne → montant direct (négatif = débit)
    prisma.transaction.aggregate({
      where: {
        accountId: { in: accountIds },
        destinationAccountId: { not: null },
        status: statusFilter,
        year: { lt: year },
      },
      _sum: { amount: true },
    }),
    prisma.bucket.aggregate({
      where: { accountId: { in: accountIds } },
      _sum: { baseAmount: true },
    }),
  ]);

  let cumulative =
    -(prevStandalone._sum.amount?.toNumber() ?? 0) +
    -(prevIncoming._sum.amount?.toNumber() ?? 0) +
    (prevOutgoing._sum.amount?.toNumber() ?? 0) +
    (totalBaseAmount._sum.baseAmount?.toNumber() ?? 0);

  const data = [];

  for (let month = 1; month <= 12; month++) {
    const [standalone, incoming, outgoing] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          accountId: { in: accountIds },
          destinationAccountId: null,
          status: statusFilter,
          year,
          month,
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          destinationAccountId: { in: accountIds },
          status: statusFilter,
          year,
          month,
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          accountId: { in: accountIds },
          destinationAccountId: { not: null },
          status: statusFilter,
          year,
          month,
        },
        _sum: { amount: true },
      }),
    ]);

    cumulative +=
      -(standalone._sum.amount?.toNumber() ?? 0) +
      -(incoming._sum.amount?.toNumber() ?? 0) +
      (outgoing._sum.amount?.toNumber() ?? 0);

    data.push({
      month,
      monthLabel: new Date(year, month - 1).toLocaleDateString("fr-FR", { month: "short" }),
      total: cumulative,
    });
  }

  return data;
}

export async function getAccounts() {
  return prisma.account.findMany({ orderBy: { sortOrder: "asc" } });
}
