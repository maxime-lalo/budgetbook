"use server";

import { db, categories, transactions, budgets } from "@/lib/db";
import { eq, and, inArray, lt, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";
import { toNumber, round2 } from "@/lib/db/helpers";

export async function getBudgetsWithSpent(year: number, month: number) {
  const allCategories = await db.query.categories.findMany({
    with: {
      budgets: {
        where: and(eq(budgets.year, year), eq(budgets.month, month)),
      },
    },
  });

  // Get net spent amounts per category (includes refunds)
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
    spent.map((s) => {
      const net = toNumber(s.total);
      return [s.categoryId, net < 0 ? round2(Math.abs(net)) : 0];
    })
  );

  return allCategories
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map((cat) => {
      const budgeted = round2(cat.budgets[0] ? toNumber(cat.budgets[0].amount) : 0);
      const spentAmount = spentMap.get(cat.id) ?? 0;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        budgeted,
        budgetId: cat.budgets[0] ? cat.budgets[0].id : null,
        spent: spentAmount,
        remaining: round2(budgeted - spentAmount),
      };
    });
}

export async function upsertBudget(categoryId: string, year: number, month: number, amount: number) {
  const existing = await db.query.budgets.findFirst({
    where: and(eq(budgets.categoryId, categoryId), eq(budgets.year, year), eq(budgets.month, month)),
  });

  if (existing) {
    await db.update(budgets).set({ amount: amount.toString() }).where(eq(budgets.id, existing.id));
  } else {
    await db.insert(budgets).values({
      id: createId(),
      categoryId,
      year,
      month,
      amount: amount.toString(),
    });
  }

  await recomputeMonthlyBalance(year, month);
  revalidatePath("/budgets");
  return { success: true };
}

export async function copyBudgetsFromPreviousMonth(year: number, month: number) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const previousBudgets = await db.query.budgets.findMany({
    where: and(eq(budgets.year, prevYear), eq(budgets.month, prevMonth)),
  });

  if (previousBudgets.length === 0) {
    return { error: "Aucun budget trouvé pour le mois précédent" };
  }

  for (const budget of previousBudgets) {
    const existing = await db.query.budgets.findFirst({
      where: and(eq(budgets.categoryId, budget.categoryId), eq(budgets.year, year), eq(budgets.month, month)),
    });

    if (existing) {
      await db.update(budgets).set({ amount: budget.amount }).where(eq(budgets.id, existing.id));
    } else {
      await db.insert(budgets).values({
        id: createId(),
        categoryId: budget.categoryId,
        year,
        month,
        amount: budget.amount,
      });
    }
  }

  await recomputeMonthlyBalance(year, month);
  revalidatePath("/budgets");
  return { success: true, count: previousBudgets.length };
}

export async function calibrateBudgets(year: number, month: number) {
  const budgetData: { id: string; spent: number; budgeted: number }[] = await getBudgetsWithSpent(year, month);
  const overBudget = budgetData.filter((b) => b.spent > b.budgeted && b.spent > 0);

  if (overBudget.length === 0) {
    return { error: "Aucun dépassement de budget à calibrer" };
  }

  for (const b of overBudget) {
    const existing = await db.query.budgets.findFirst({
      where: and(eq(budgets.categoryId, b.id), eq(budgets.year, year), eq(budgets.month, month)),
    });

    if (existing) {
      await db.update(budgets).set({ amount: b.spent.toString() }).where(eq(budgets.id, existing.id));
    } else {
      await db.insert(budgets).values({
        id: createId(),
        categoryId: b.id,
        year,
        month,
        amount: b.spent.toString(),
      });
    }
  }

  await recomputeMonthlyBalance(year, month);
  revalidatePath("/budgets");
  return { success: true, count: overBudget.length };
}
