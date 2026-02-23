"use server";

import { db, provider, accounts, categories, subCategories, buckets, transactions, budgets, monthlyBalances, apiTokens, appPreferences } from "@/lib/db";
import { eq, asc, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { comptesExportSchema } from "@/lib/validators";
import { toISOString } from "@/lib/db/helpers";
import { backfillAllMonthlyBalances } from "@/lib/monthly-balance";
import { logger } from "@/lib/logger";
import { hashToken } from "@/lib/api-auth";
import { safeAction } from "@/lib/safe-action";

// Helper: convertit une date ISO string en Date (PG) ou la laisse en string (SQLite)
const toTimestamp = (isoString: string): Date | string =>
  provider === "sqlite" ? isoString : new Date(isoString);

const toDateCol = (isoString: string): Date | string =>
  provider === "sqlite" ? isoString : new Date(isoString);

export async function getApiToken() {
  const token = await db.query.apiTokens.findFirst({
    orderBy: [desc(apiTokens.createdAt)],
  });

  if (!token) return null;

  return {
    tokenPrefix: token.tokenPrefix || token.token.slice(0, 8),
    createdAt: toISOString(token.createdAt)!,
  };
}

export async function regenerateApiToken() {
  return safeAction(async () => {
    await db.delete(apiTokens);

    const id = createId();
    const plainToken = randomUUID();
    const hashedToken = hashToken(plainToken);
    const tokenPrefix = plainToken.slice(0, 8);

    await db.insert(apiTokens).values({ id, token: hashedToken, tokenPrefix });

    const created = await db.query.apiTokens.findFirst({
      where: eq(apiTokens.id, id),
    });

    return {
      token: plainToken,
      tokenPrefix,
      createdAt: toISOString(created!.createdAt)!,
    };
  }, "Erreur lors de la régénération du token");
}

export async function getAppPreferences() {
  let prefs = await db.query.appPreferences.findFirst({
    where: eq(appPreferences.id, "singleton"),
  });

  if (!prefs) {
    await db.insert(appPreferences).values({ id: "singleton", amexEnabled: true, separateRecurring: true });
    prefs = { id: "singleton", amexEnabled: true, separateRecurring: true, updatedAt: new Date().toISOString() as unknown as Date };
  }

  // Migrer les lignes existantes sans separateRecurring
  if (prefs.separateRecurring === null || prefs.separateRecurring === undefined) {
    await db.update(appPreferences).set({ separateRecurring: true }).where(eq(appPreferences.id, "singleton"));
    prefs = { ...prefs, separateRecurring: true };
  }

  return { amexEnabled: prefs.amexEnabled, separateRecurring: prefs.separateRecurring };
}

export async function updateAmexEnabled(enabled: boolean) {
  return safeAction(async () => {
    const existing = await db.query.appPreferences.findFirst({
      where: eq(appPreferences.id, "singleton"),
    });

    if (existing) {
      await db.update(appPreferences).set({ amexEnabled: enabled }).where(eq(appPreferences.id, "singleton"));
    } else {
      await db.insert(appPreferences).values({ id: "singleton", amexEnabled: enabled });
    }

    revalidatePath("/transactions");
    revalidatePath("/settings");
    return { success: true };
  }, "Erreur lors de la mise à jour de la préférence AMEX");
}

export async function updateSeparateRecurring(enabled: boolean) {
  return safeAction(async () => {
    const existing = await db.query.appPreferences.findFirst({
      where: eq(appPreferences.id, "singleton"),
    });

    if (existing) {
      await db.update(appPreferences).set({ separateRecurring: enabled }).where(eq(appPreferences.id, "singleton"));
    } else {
      await db.insert(appPreferences).values({ id: "singleton", separateRecurring: enabled });
    }

    revalidatePath("/transactions");
    revalidatePath("/settings");
    return { success: true };
  }, "Erreur lors de la mise à jour de la préférence récurrentes");
}

export async function exportAllData(): Promise<string> {
  const [accs, cats, subs, bkts, txs, bdgs, mbs, tokens, prefs] =
    await Promise.all([
      db.query.accounts.findMany({ orderBy: [asc(accounts.sortOrder)] }),
      db.query.categories.findMany({ orderBy: [asc(categories.sortOrder)] }),
      db.query.subCategories.findMany({ orderBy: [asc(subCategories.sortOrder)] }),
      db.query.buckets.findMany({ orderBy: [asc(buckets.sortOrder)] }),
      db.query.transactions.findMany({ orderBy: [asc(transactions.createdAt)] }),
      db.query.budgets.findMany({ orderBy: [asc(budgets.createdAt)] }),
      db.query.monthlyBalances.findMany({ orderBy: [asc(monthlyBalances.year), asc(monthlyBalances.month)] }),
      db.query.apiTokens.findMany({ orderBy: [asc(apiTokens.createdAt)] }),
      db.query.appPreferences.findFirst({ where: eq(appPreferences.id, "singleton") }),
    ]);

  const serialize = (items: Record<string, unknown>[]) =>
    items.map((item) => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(item)) {
        if (value instanceof Date) {
          result[key] = value.toISOString();
        } else {
          result[key] = value;
        }
      }
      return result;
    });

  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      formatVersion: 1,
    },
    data: {
      accounts: serialize(accs),
      categories: serialize(cats),
      subCategories: serialize(subs),
      buckets: serialize(bkts),
      transactions: serialize(txs),
      budgets: serialize(bdgs),
      monthlyBalances: serialize(mbs),
      apiTokens: serialize(tokens),
      appPreferences: prefs ? { amexEnabled: prefs.amexEnabled, separateRecurring: prefs.separateRecurring } : null,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

async function clearAllTables() {
  await db.delete(monthlyBalances);
  await db.delete(budgets);
  await db.delete(transactions);
  await db.delete(subCategories);
  await db.delete(categories);
  await db.delete(buckets);
  await db.update(accounts).set({ linkedAccountId: null });
  await db.delete(accounts);
}

export async function clearAllData(): Promise<{ success: true } | { error: string }> {
  try {
    await clearAllTables();
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    logger.error("Erreur lors de la suppression des données", { error: e instanceof Error ? e.message : String(e) });
    return { error: "Erreur lors de la suppression des données" };
  }
}

export async function importAllData(
  jsonString: string
): Promise<{ success: true; counts: Record<string, number> } | { error: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    const validated = comptesExportSchema.parse(parsed);
    const { data } = validated;

    const counts: Record<string, number> = {};

    // 1. Clear toutes les données existantes
    await clearAllTables();
    await db.delete(apiTokens);

    // 2. Insérer les comptes (sans linkedAccountId d'abord)
    for (const account of data.accounts) {
      await db.insert(accounts).values({
        id: account.id,
        name: account.name,
        type: account.type,
        color: account.color,
        icon: account.icon,
        sortOrder: account.sortOrder,
        linkedAccountId: null,
        createdAt: toTimestamp(account.createdAt) as Date,
        updatedAt: toTimestamp(account.updatedAt) as Date,
      });
    }
    counts.accounts = data.accounts.length;

    // 3. Insérer les catégories
    for (const category of data.categories) {
      await db.insert(categories).values({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        sortOrder: category.sortOrder,
        createdAt: toTimestamp(category.createdAt) as Date,
        updatedAt: toTimestamp(category.updatedAt) as Date,
      });
    }
    counts.categories = data.categories.length;

    // 4. Insérer les sous-catégories
    for (const subCategory of data.subCategories) {
      await db.insert(subCategories).values({
        id: subCategory.id,
        name: subCategory.name,
        categoryId: subCategory.categoryId,
        sortOrder: subCategory.sortOrder,
        createdAt: toTimestamp(subCategory.createdAt) as Date,
        updatedAt: toTimestamp(subCategory.updatedAt) as Date,
      });
    }
    counts.subCategories = data.subCategories.length;

    // 5. Insérer les buckets
    for (const bucket of data.buckets) {
      await db.insert(buckets).values({
        id: bucket.id,
        name: bucket.name,
        accountId: bucket.accountId,
        color: bucket.color,
        goal: bucket.goal,
        baseAmount: bucket.baseAmount,
        sortOrder: bucket.sortOrder,
        createdAt: toTimestamp(bucket.createdAt) as Date,
        updatedAt: toTimestamp(bucket.updatedAt) as Date,
      });
    }
    counts.buckets = data.buckets.length;

    // 6. Insérer les transactions
    for (const transaction of data.transactions) {
      await db.insert(transactions).values({
        id: transaction.id,
        label: transaction.label,
        amount: transaction.amount,
        date: transaction.date ? toDateCol(transaction.date) as Date : null,
        month: transaction.month,
        year: transaction.year,
        status: transaction.status,
        note: transaction.note,
        accountId: transaction.accountId,
        destinationAccountId: transaction.destinationAccountId,
        categoryId: transaction.categoryId,
        subCategoryId: transaction.subCategoryId,
        bucketId: transaction.bucketId,
        isAmex: transaction.isAmex,
        recurring: transaction.recurring ?? false,
        createdAt: toTimestamp(transaction.createdAt) as Date,
        updatedAt: toTimestamp(transaction.updatedAt) as Date,
      });
    }
    counts.transactions = data.transactions.length;

    // 7. Insérer les budgets
    for (const budget of data.budgets) {
      await db.insert(budgets).values({
        id: budget.id,
        categoryId: budget.categoryId,
        month: budget.month,
        year: budget.year,
        amount: budget.amount,
        createdAt: toTimestamp(budget.createdAt) as Date,
        updatedAt: toTimestamp(budget.updatedAt) as Date,
      });
    }
    counts.budgets = data.budgets.length;

    // 8. Recalculer les monthly balances depuis les données réelles
    await backfillAllMonthlyBalances();
    const recalculated = await db.query.monthlyBalances.findMany();
    counts.monthlyBalances = recalculated.length;

    // 9. Insérer les API tokens
    for (const token of data.apiTokens) {
      await db.insert(apiTokens).values({
        id: token.id,
        token: token.token,
        tokenPrefix: token.tokenPrefix || token.token.slice(0, 8),
        name: token.name,
        createdAt: toTimestamp(token.createdAt) as Date,
      });
    }
    counts.apiTokens = data.apiTokens.length;

    // 10. Restaurer les préférences si présentes
    if (data.appPreferences) {
      const existingPrefs = await db.query.appPreferences.findFirst({
        where: eq(appPreferences.id, "singleton"),
      });
      const prefsData = { amexEnabled: data.appPreferences.amexEnabled, separateRecurring: data.appPreferences.separateRecurring ?? true };
      if (existingPrefs) {
        await db.update(appPreferences).set(prefsData).where(eq(appPreferences.id, "singleton"));
      } else {
        await db.insert(appPreferences).values({ id: "singleton", ...prefsData });
      }
    }

    // 11. 2e passe : mettre à jour les linkedAccountId
    const accountsWithLinked = data.accounts.filter((a) => a.linkedAccountId);
    for (const account of accountsWithLinked) {
      await db.update(accounts).set({ linkedAccountId: account.linkedAccountId }).where(eq(accounts.id, account.id));
    }

    revalidatePath("/");
    return { success: true, counts };
  } catch (e) {
    logger.error("Erreur lors de l'import des données", { error: e instanceof Error ? e.message : String(e) });
    if (e instanceof SyntaxError) {
      return { error: "Le fichier n'est pas un JSON valide" };
    }
    if (e instanceof Error && e.name === "ZodError") {
      return { error: "Le format du fichier est invalide" };
    }
    return { error: "Erreur lors de l'import des données" };
  }
}

export async function recalculateAllBalances(): Promise<{ success: true; count: number } | { error: string }> {
  try {
    await db.delete(monthlyBalances);
    await backfillAllMonthlyBalances();
    const recalculated = await db.query.monthlyBalances.findMany();
    revalidatePath("/");
    return { success: true, count: recalculated.length };
  } catch (e) {
    logger.error("Erreur lors du recalcul des soldes", { error: e instanceof Error ? e.message : String(e) });
    return { error: "Erreur lors du recalcul des soldes mensuels" };
  }
}
