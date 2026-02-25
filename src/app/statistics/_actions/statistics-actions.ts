"use server";

import { db, transactions, accounts, categories, subCategories, buckets } from "@/lib/db";
import { eq, and, inArray, lt, lte, isNull, isNotNull, sql, asc } from "drizzle-orm";
import { toNumber } from "@/lib/db/helpers";
import { DEFAULT_COLOR } from "@/lib/formatters";

async function getAccountFilter(accountId?: string) {
  if (accountId) return [accountId];
  const realAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.type, ["CHECKING", "CREDIT_CARD"]));
  return realAccounts.map((a) => a.id);
}

export async function getYearlyOverview(year: number, accountId?: string) {
  const accountIds = await getAccountFilter(accountId);

  const result = await db
    .select({
      month: transactions.month,
      income: sql<string>`coalesce(sum(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END), 0)`,
      expenses: sql<string>`coalesce(sum(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.year, year),
        inArray(transactions.status, ["COMPLETED", "PENDING"]),
        isNull(transactions.destinationAccountId),
        inArray(transactions.accountId, accountIds)
      )
    )
    .groupBy(transactions.month);

  const resultMap = new Map(result.map((r) => [r.month, r]));

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const row = resultMap.get(month);
    return {
      month,
      monthLabel: new Date(year, i).toLocaleDateString("fr-FR", { month: "short" }),
      income: row ? toNumber(row.income) : 0,
      expenses: row ? Math.abs(toNumber(row.expenses)) : 0,
    };
  });
}

export async function getCategoryBreakdown(year: number, month: number, accountId?: string) {
  const accountIds = await getAccountFilter(accountId);

  const result = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.year, year),
        lte(transactions.month, month),
        inArray(transactions.status, ["COMPLETED", "PENDING"]),
        inArray(transactions.accountId, accountIds)
      )
    )
    .groupBy(transactions.categoryId);

  const catIds = result.map((r) => r.categoryId).filter((id): id is string => id != null);
  if (catIds.length === 0) return [];

  const cats = await db.query.categories.findMany({
    where: inArray(categories.id, catIds),
  });
  const catMap = new Map(cats.map((c) => [c.id, c]));

  return result
    .map((r) => {
      const cat = r.categoryId ? catMap.get(r.categoryId) : null;
      return {
        category: cat?.name ?? "Sans catégorie",
        color: cat?.color ?? DEFAULT_COLOR,
        amount: -(toNumber(r.total)),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export async function getSubCategoryBreakdown(year: number, month: number, accountId?: string) {
  const accountIds = await getAccountFilter(accountId);

  const result = await db
    .select({
      categoryId: transactions.categoryId,
      subCategoryId: transactions.subCategoryId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.year, year),
        lte(transactions.month, month),
        inArray(transactions.status, ["COMPLETED", "PENDING"]),
        isNotNull(transactions.subCategoryId),
        inArray(transactions.accountId, accountIds)
      )
    )
    .groupBy(transactions.categoryId, transactions.subCategoryId);

  const categoryIds = [...new Set(result.map((r) => r.categoryId).filter((id): id is string => id != null))];
  const subCategoryIds = result.map((r) => r.subCategoryId).filter((id): id is string => id !== null);

  if (categoryIds.length === 0) return { items: [], categories: [] };

  const [cats, subs] = await Promise.all([
    db.query.categories.findMany({ where: inArray(categories.id, categoryIds) }),
    subCategoryIds.length > 0
      ? db.query.subCategories.findMany({ where: inArray(subCategories.id, subCategoryIds) })
      : [],
  ]);

  const catMap = new Map(cats.map((c) => [c.id, c]));
  const subMap = new Map((subs as { id: string; name: string }[]).map((s) => [s.id, s]));

  const items = result.map((r) => {
    const cat = r.categoryId ? catMap.get(r.categoryId) : null;
    const sub = r.subCategoryId ? subMap.get(r.subCategoryId) : null;
    return {
      categoryId: r.categoryId ?? "__uncategorized",
      subCategory: sub?.name ?? "?",
      color: cat?.color ?? DEFAULT_COLOR,
      amount: -(toNumber(r.total)),
    };
  });

  const availableCategories = [...catMap.values()]
    .map((c) => ({ id: c.id, name: c.name, color: c.color }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return { items, categories: availableCategories };
}

export async function getCategoryYearComparison(year: number, month: number, accountId?: string) {
  const accountIds = await getAccountFilter(accountId);

  const baseWhere = and(
    inArray(transactions.status, ["COMPLETED", "PENDING"]),
    inArray(transactions.accountId, accountIds)
  );

  const [currentMonthData, currentYearData, prevYearData] = await Promise.all([
    db.select({ categoryId: transactions.categoryId, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions).where(and(baseWhere, eq(transactions.year, year), eq(transactions.month, month)))
      .groupBy(transactions.categoryId),
    db.select({ categoryId: transactions.categoryId, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions).where(and(baseWhere, eq(transactions.year, year), lte(transactions.month, month)))
      .groupBy(transactions.categoryId),
    db.select({ categoryId: transactions.categoryId, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions).where(and(baseWhere, eq(transactions.year, year - 1)))
      .groupBy(transactions.categoryId),
  ]);

  const allCatIds = [
    ...new Set([
      ...currentMonthData.map((r) => r.categoryId),
      ...currentYearData.map((r) => r.categoryId),
      ...prevYearData.map((r) => r.categoryId),
    ].filter((id): id is string => id != null)),
  ];

  if (allCatIds.length === 0) {
    return { rows: [], totals: { currentMonth: 0, yearlyTotal: 0, prevYearTotal: 0 }, month };
  }

  const cats = await db.query.categories.findMany({
    where: inArray(categories.id, allCatIds),
  });
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const currentMonthMap = new Map(
    currentMonthData.filter((r) => r.categoryId != null).map((r) => [r.categoryId as string, -(toNumber(r.total))])
  );
  const currentYearMap = new Map(
    currentYearData.filter((r) => r.categoryId != null).map((r) => [r.categoryId as string, -(toNumber(r.total))])
  );
  const prevYearMap = new Map(
    prevYearData.filter((r) => r.categoryId != null).map((r) => [r.categoryId as string, -(toNumber(r.total))])
  );

  const currentYearAbsTotal = [...currentYearMap.values()].reduce((a, b) => a + Math.abs(b), 0);
  const currentMonthAbsTotal = [...currentMonthMap.values()].reduce((a, b) => a + Math.abs(b), 0);

  const rows = cats.map((c) => c.id)
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
        color: cat?.color ?? DEFAULT_COLOR,
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
  const savingsAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.type, ["SAVINGS", "INVESTMENT"]));
  const accountIds = savingsAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthLabel: new Date(year, i).toLocaleDateString("fr-FR", { month: "short" }),
      total: 0,
    }));
  }

  const statusFilter = ["COMPLETED", "PENDING"] as const;

  // Previous years totals + base amounts (4 queries)
  const [prevStandalone, prevIncoming, prevOutgoing, totalBaseAmount] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(inArray(transactions.accountId, accountIds), isNull(transactions.destinationAccountId), inArray(transactions.status, statusFilter), lt(transactions.year, year))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(inArray(transactions.destinationAccountId, accountIds), inArray(transactions.status, statusFilter), lt(transactions.year, year))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(inArray(transactions.accountId, accountIds), isNotNull(transactions.destinationAccountId), inArray(transactions.status, statusFilter), lt(transactions.year, year))),
    db.select({ total: sql<string>`coalesce(sum(${buckets.baseAmount}), 0)` })
      .from(buckets)
      .where(inArray(buckets.accountId, accountIds)),
  ]);

  let cumulative =
    toNumber(prevStandalone[0].total) +
    -(toNumber(prevIncoming[0].total)) +
    toNumber(prevOutgoing[0].total) +
    toNumber(totalBaseAmount[0].total);

  // Current year monthly data (3 GROUP BY queries instead of 36 individual queries)
  const [standaloneByMonth, incomingByMonth, outgoingByMonth] = await Promise.all([
    db.select({ month: transactions.month, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(inArray(transactions.accountId, accountIds), isNull(transactions.destinationAccountId), inArray(transactions.status, statusFilter), eq(transactions.year, year)))
      .groupBy(transactions.month),
    db.select({ month: transactions.month, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(inArray(transactions.destinationAccountId, accountIds), inArray(transactions.status, statusFilter), eq(transactions.year, year)))
      .groupBy(transactions.month),
    db.select({ month: transactions.month, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(inArray(transactions.accountId, accountIds), isNotNull(transactions.destinationAccountId), inArray(transactions.status, statusFilter), eq(transactions.year, year)))
      .groupBy(transactions.month),
  ]);

  const standaloneMap = new Map(standaloneByMonth.map((r) => [r.month, toNumber(r.total)]));
  const incomingMap = new Map(incomingByMonth.map((r) => [r.month, toNumber(r.total)]));
  const outgoingMap = new Map(outgoingByMonth.map((r) => [r.month, toNumber(r.total)]));

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    cumulative +=
      (standaloneMap.get(month) ?? 0) +
      -(incomingMap.get(month) ?? 0) +
      (outgoingMap.get(month) ?? 0);

    return {
      month,
      monthLabel: new Date(year, i).toLocaleDateString("fr-FR", { month: "short" }),
      total: cumulative,
    };
  });
}

export async function getAccounts() {
  return db.query.accounts.findMany({
    orderBy: [asc(accounts.sortOrder)],
  });
}

export async function getCategoryMonthlyHeatmap(year: number, accountId?: string) {
  const accountIds = await getAccountFilter(accountId);

  const baseWhere = and(
    eq(transactions.year, year),
    inArray(transactions.status, ["COMPLETED", "PENDING"]),
    sql`${transactions.amount} < 0`,
    inArray(transactions.accountId, accountIds)
  );

  const [result, subResult] = await Promise.all([
    db
      .select({
        categoryId: transactions.categoryId,
        month: transactions.month,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(baseWhere)
      .groupBy(transactions.categoryId, transactions.month),
    db
      .select({
        categoryId: transactions.categoryId,
        subCategoryId: transactions.subCategoryId,
        month: transactions.month,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(and(baseWhere, isNotNull(transactions.subCategoryId)))
      .groupBy(transactions.categoryId, transactions.subCategoryId, transactions.month),
  ]);

  const catIds = [...new Set(result.map((r) => r.categoryId).filter((id): id is string => id != null))];
  if (catIds.length === 0) return { categories: [], data: {}, subCategoryData: {} };

  const subCatIds = [...new Set(subResult.map((r) => r.subCategoryId).filter((id): id is string => id !== null))];

  const [cats, subs] = await Promise.all([
    db.query.categories.findMany({
      where: inArray(categories.id, catIds),
    }),
    subCatIds.length > 0
      ? db.query.subCategories.findMany({ where: inArray(subCategories.id, subCatIds) })
      : [],
  ]);

  const sortedCats = cats
    .map((c) => ({ id: c.id, name: c.name, color: c.color }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const data: Record<string, Record<number, number>> = {};
  for (const r of result) {
    const catId = r.categoryId ?? "__uncategorized";
    if (!data[catId]) data[catId] = {};
    data[catId][r.month] = Math.abs(toNumber(r.total));
  }

  // Build sub-category data keyed by categoryId
  const subMap = new Map((subs as { id: string; name: string }[]).map((s) => [s.id, s]));
  const subCategoryData: Record<string, {
    subCategories: { id: string; name: string }[];
    data: Record<string, Record<number, number>>;
  }> = {};

  for (const r of subResult) {
    const subId = r.subCategoryId;
    if (!subId) continue;
    const catId = r.categoryId ?? "__uncategorized";

    if (!subCategoryData[catId]) {
      subCategoryData[catId] = { subCategories: [], data: {} };
    }
    if (!subCategoryData[catId].data[subId]) {
      subCategoryData[catId].data[subId] = {};
    }
    subCategoryData[catId].data[subId][r.month] = Math.abs(toNumber(r.total));
  }

  // Populate sub-category names and sort
  for (const catId of Object.keys(subCategoryData)) {
    const subIds = Object.keys(subCategoryData[catId].data);
    subCategoryData[catId].subCategories = subIds
      .map((id) => ({ id, name: subMap.get(id)?.name ?? "?" }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  return { categories: sortedCats, data, subCategoryData };
}
