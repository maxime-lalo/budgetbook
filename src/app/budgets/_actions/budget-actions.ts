"use server";

import { db, transactions, budgets } from "@/lib/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";
import { toNumber, round2 } from "@/lib/db/helpers";
import { safeAction } from "@/lib/safe-action";

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
    spent.filter((s) => s.categoryId != null).map((s) => {
      const net = toNumber(s.total);
      return [s.categoryId as string, net < 0 ? round2(Math.abs(net)) : 0];
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
  return safeAction(async () => {
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
  }, "Erreur lors de la mise à jour du budget");
}

export async function copyBudgetsFromPreviousMonth(year: number, month: number) {
  return safeAction(async () => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const previousBudgets = await db.query.budgets.findMany({
      where: and(eq(budgets.year, prevYear), eq(budgets.month, prevMonth)),
    });

    if (previousBudgets.length === 0) {
      return { error: "Aucun budget trouvé pour le mois précédent" };
    }

    // Batch-fetch all existing budgets for the target month to avoid N+1 queries
    const existingBudgets = await db.query.budgets.findMany({
      where: and(eq(budgets.year, year), eq(budgets.month, month)),
    });
    const existingByCategory = new Map(existingBudgets.map((b) => [b.categoryId, b]));

    for (const budget of previousBudgets) {
      const existing = existingByCategory.get(budget.categoryId);

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
  }, "Erreur lors de la copie des budgets");
}

export async function calibrateBudgets(year: number, month: number) {
  return safeAction(async () => {
    const budgetData: { id: string; budgetId: string | null; spent: number; budgeted: number }[] =
      await getBudgetsWithSpent(year, month);
    const overBudget = budgetData.filter((b) => b.spent > b.budgeted && b.spent > 0);

    if (overBudget.length === 0) {
      return { error: "Aucun dépassement de budget à calibrer" };
    }

    // getBudgetsWithSpent already returns budgetId — use it directly for O(1) lookups
    // without any additional DB queries inside the loop
    for (const b of overBudget) {
      if (b.budgetId) {
        await db.update(budgets).set({ amount: b.spent.toString() }).where(eq(budgets.id, b.budgetId));
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
  }, "Erreur lors de la calibration des budgets");
}
