"use server";

import { db, transactions, budgets, categories } from "@/lib/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";
import { toNumber, round2 } from "@/lib/db/helpers";
import { safeAction } from "@/lib/safe-action";
import { budgetSchema } from "@/lib/validators";
import { revalidateTransactionPages } from "@/lib/revalidate";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export async function getBudgetsWithSpent(year: number, month: number) {
  const user = await requireAuth();
  const allCategories = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
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
        eq(transactions.userId, user.id),
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
  const user = await requireAuth();
  const parsed = budgetSchema.safeParse({ categoryId, year, month, amount });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    const existing = await db.query.budgets.findFirst({
      where: and(eq(budgets.categoryId, parsed.data.categoryId), eq(budgets.year, parsed.data.year), eq(budgets.month, parsed.data.month), eq(budgets.userId, user.id)),
    });

    if (existing) {
      await db.update(budgets).set({ amount: parsed.data.amount.toString() }).where(and(eq(budgets.id, existing.id), eq(budgets.userId, user.id)));
    } else {
      await db.insert(budgets).values({
        id: createId(),
        userId: user.id,
        categoryId: parsed.data.categoryId,
        year: parsed.data.year,
        month: parsed.data.month,
        amount: parsed.data.amount.toString(),
      });
    }

    await recomputeMonthlyBalance(parsed.data.year, parsed.data.month, user.id);
    revalidatePath("/budgets");
    revalidateTransactionPages();
    logger.info("Budget upserted", { userId: user.id, categoryId: parsed.data.categoryId, amount: parsed.data.amount, isNew: !existing });
    return { success: true };
  }, "Erreur lors de la mise à jour du budget");
}

export async function copyBudgetsFromPreviousMonth(year: number, month: number) {
  const user = await requireAuth();
  return safeAction(async () => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const previousBudgets = await db.query.budgets.findMany({
      where: and(eq(budgets.year, prevYear), eq(budgets.month, prevMonth), eq(budgets.userId, user.id)),
    });

    if (previousBudgets.length === 0) {
      return { error: "Aucun budget trouvé pour le mois précédent" };
    }

    // Batch-fetch all existing budgets for the target month to avoid N+1 queries
    const existingBudgets = await db.query.budgets.findMany({
      where: and(eq(budgets.year, year), eq(budgets.month, month), eq(budgets.userId, user.id)),
    });
    const existingByCategory = new Map(existingBudgets.map((b) => [b.categoryId, b]));

    for (const budget of previousBudgets) {
      const existing = existingByCategory.get(budget.categoryId);

      if (existing) {
        await db.update(budgets).set({ amount: budget.amount }).where(and(eq(budgets.id, existing.id), eq(budgets.userId, user.id)));
      } else {
        await db.insert(budgets).values({
          id: createId(),
          userId: user.id,
          categoryId: budget.categoryId,
          year,
          month,
          amount: budget.amount,
        });
      }
    }

    await recomputeMonthlyBalance(year, month, user.id);
    revalidatePath("/budgets");
    revalidateTransactionPages();
    logger.info("Budgets copied from previous month", { userId: user.id, year, month, count: previousBudgets.length });
    return { success: true, count: previousBudgets.length };
  }, "Erreur lors de la copie des budgets");
}

export async function calibrateBudgets(year: number, month: number) {
  const user = await requireAuth();
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
        await db.update(budgets).set({ amount: b.spent.toString() }).where(and(eq(budgets.id, b.budgetId), eq(budgets.userId, user.id)));
      } else {
        await db.insert(budgets).values({
          id: createId(),
          userId: user.id,
          categoryId: b.id,
          year,
          month,
          amount: b.spent.toString(),
        });
      }
    }

    await recomputeMonthlyBalance(year, month, user.id);
    revalidatePath("/budgets");
    revalidateTransactionPages();
    logger.info("Budgets calibrated", { userId: user.id, year, month, count: overBudget.length });
    return { success: true, count: overBudget.length };
  }, "Erreur lors de la calibration des budgets");
}
