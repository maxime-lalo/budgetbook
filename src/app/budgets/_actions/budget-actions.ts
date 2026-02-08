"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";

export async function getBudgetsWithSpent(year: number, month: number) {
  const categories = await prisma.category.findMany({
    include: {
      budgets: {
        where: { year, month },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get spent amounts per category
  const spent = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      year,
      month,
      status: { in: ["COMPLETED", "PENDING"] },
      amount: { lt: 0 },
    },
    _sum: { amount: true },
  });

  const spentMap = new Map(
    spent.map((s) => [s.categoryId, Math.abs(s._sum.amount?.toNumber() ?? 0)])
  );

  return categories
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      budgeted: cat.budgets[0]?.amount.toNumber() ?? 0,
      budgetId: cat.budgets[0]?.id ?? null,
      spent: spentMap.get(cat.id) ?? 0,
      remaining: (cat.budgets[0]?.amount.toNumber() ?? 0) - (spentMap.get(cat.id) ?? 0),
    }));
}

export async function upsertBudget(categoryId: string, year: number, month: number, amount: number) {
  await prisma.budget.upsert({
    where: { categoryId_year_month: { categoryId, year, month } },
    update: { amount: new Prisma.Decimal(amount) },
    create: {
      categoryId,
      year,
      month,
      amount: new Prisma.Decimal(amount),
    },
  });
  await recomputeMonthlyBalance(year, month);
  revalidatePath("/budgets");
  return { success: true };
}

export async function copyBudgetsFromPreviousMonth(year: number, month: number) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const previousBudgets = await prisma.budget.findMany({
    where: { year: prevYear, month: prevMonth },
  });

  if (previousBudgets.length === 0) {
    return { error: "Aucun budget trouvé pour le mois précédent" };
  }

  for (const budget of previousBudgets) {
    await prisma.budget.upsert({
      where: {
        categoryId_year_month: {
          categoryId: budget.categoryId,
          year,
          month,
        },
      },
      update: { amount: budget.amount },
      create: {
        categoryId: budget.categoryId,
        year,
        month,
        amount: budget.amount,
      },
    });
  }

  await recomputeMonthlyBalance(year, month);
  revalidatePath("/budgets");
  return { success: true, count: previousBudgets.length };
}
