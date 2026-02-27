"use server";

import { db, accounts, categories, subCategories, buckets, transactions, budgets, monthlyBalances, apiTokens, appPreferences } from "@/lib/db";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { comptesExportSchema } from "@/lib/validators";
import { toISOString } from "@/lib/db/helpers";
import { backfillAllMonthlyBalances } from "@/lib/monthly-balance";
import { logger } from "@/lib/logger";
import { hashToken } from "@/lib/api-auth";
import { safeAction } from "@/lib/safe-action";
import { revalidateTransactionPages } from "@/lib/revalidate";
import { requireAuth } from "@/lib/auth/session";


export async function getApiToken() {
  const user = await requireAuth();
  const token = await db.query.apiTokens.findFirst({
    where: eq(apiTokens.userId, user.id),
    orderBy: [desc(apiTokens.createdAt)],
  });

  if (!token) return null;

  return {
    tokenPrefix: token.tokenPrefix || token.token.slice(0, 8),
    createdAt: toISOString(token.createdAt)!,
  };
}

export async function regenerateApiToken() {
  const user = await requireAuth();
  return safeAction(async () => {
    await db.delete(apiTokens).where(eq(apiTokens.userId, user.id));

    const id = createId();
    const plainToken = randomUUID();
    const hashedToken = hashToken(plainToken);
    const tokenPrefix = plainToken.slice(0, 8);

    await db.insert(apiTokens).values({ id, userId: user.id, token: hashedToken, tokenPrefix });

    const created = await db.query.apiTokens.findFirst({
      where: eq(apiTokens.id, id),
    });

    logger.info("API token regenerated", { userId: user.id, tokenPrefix });
    return {
      token: plainToken,
      tokenPrefix,
      createdAt: toISOString(created!.createdAt)!,
    };
  }, "Erreur lors de la régénération du token");
}

export async function getAppPreferences() {
  const user = await requireAuth();
  let prefs = await db.query.appPreferences.findFirst({
    where: eq(appPreferences.userId, user.id),
  });

  if (!prefs) {
    await db.insert(appPreferences).values({ id: createId(), userId: user.id, amexEnabled: true, separateRecurring: true });
    prefs = { id: "new", userId: user.id, amexEnabled: true, separateRecurring: true, updatedAt: new Date() };
  }

  // Migrer les lignes existantes sans separateRecurring
  if (prefs.separateRecurring === null || prefs.separateRecurring === undefined) {
    await db.update(appPreferences).set({ separateRecurring: true }).where(eq(appPreferences.userId, user.id));
    prefs = { ...prefs, separateRecurring: true };
  }

  return { amexEnabled: prefs.amexEnabled, separateRecurring: prefs.separateRecurring };
}

export async function updateAmexEnabled(enabled: boolean) {
  const user = await requireAuth();
  return safeAction(async () => {
    const existing = await db.query.appPreferences.findFirst({
      where: eq(appPreferences.userId, user.id),
    });

    if (existing) {
      await db.update(appPreferences).set({ amexEnabled: enabled }).where(eq(appPreferences.userId, user.id));
    } else {
      await db.insert(appPreferences).values({ id: createId(), userId: user.id, amexEnabled: enabled });
    }

    revalidateTransactionPages();
    revalidatePath("/settings");
    logger.info("AMEX preference updated", { userId: user.id, enabled });
    return { success: true };
  }, "Erreur lors de la mise à jour de la préférence AMEX");
}

export async function updateSeparateRecurring(enabled: boolean) {
  const user = await requireAuth();
  return safeAction(async () => {
    const existing = await db.query.appPreferences.findFirst({
      where: eq(appPreferences.userId, user.id),
    });

    if (existing) {
      await db.update(appPreferences).set({ separateRecurring: enabled }).where(eq(appPreferences.userId, user.id));
    } else {
      await db.insert(appPreferences).values({ id: createId(), userId: user.id, separateRecurring: enabled });
    }

    revalidateTransactionPages();
    revalidatePath("/settings");
    logger.info("Separate recurring preference updated", { userId: user.id, enabled });
    return { success: true };
  }, "Erreur lors de la mise à jour de la préférence récurrentes");
}

export async function exportAllData(): Promise<string> {
  const user = await requireAuth();
  const [accs, cats, subs, bkts, txs, bdgs, mbs, tokens, prefs] =
    await Promise.all([
      db.query.accounts.findMany({ where: eq(accounts.userId, user.id), orderBy: [asc(accounts.sortOrder)] }),
      db.query.categories.findMany({ where: eq(categories.userId, user.id), orderBy: [asc(categories.sortOrder)] }),
      db.query.subCategories.findMany({ where: eq(subCategories.userId, user.id), orderBy: [asc(subCategories.sortOrder)] }),
      db.query.buckets.findMany({ orderBy: [asc(buckets.sortOrder)] }),
      db.query.transactions.findMany({ where: eq(transactions.userId, user.id), orderBy: [asc(transactions.createdAt)] }),
      db.query.budgets.findMany({ where: eq(budgets.userId, user.id), orderBy: [asc(budgets.createdAt)] }),
      db.query.monthlyBalances.findMany({ where: eq(monthlyBalances.userId, user.id), orderBy: [asc(monthlyBalances.year), asc(monthlyBalances.month)] }),
      db.query.apiTokens.findMany({ where: eq(apiTokens.userId, user.id), orderBy: [asc(apiTokens.createdAt)] }),
      db.query.appPreferences.findFirst({ where: eq(appPreferences.userId, user.id) }),
    ]);

  // Filter buckets by user's account IDs
  const userAccountIds = new Set(accs.map((a) => a.id));
  const userBuckets = bkts.filter((b) => userAccountIds.has(b.accountId));

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
      buckets: serialize(userBuckets),
      transactions: serialize(txs),
      budgets: serialize(bdgs),
      monthlyBalances: serialize(mbs),
      apiTokens: serialize(tokens),
      appPreferences: prefs ? { amexEnabled: prefs.amexEnabled, separateRecurring: prefs.separateRecurring } : null,
    },
  };

  logger.info("Data exported", { userId: user.id, accounts: accs.length, categories: cats.length, transactions: txs.length, budgets: bdgs.length });
  return JSON.stringify(exportData, null, 2);
}

export async function clearAllData() {
  const user = await requireAuth();
  return safeAction(async () => {
    await db.delete(monthlyBalances).where(eq(monthlyBalances.userId, user.id));
    await db.delete(budgets).where(eq(budgets.userId, user.id));
    await db.delete(transactions).where(eq(transactions.userId, user.id));
    await db.delete(subCategories).where(eq(subCategories.userId, user.id));
    await db.delete(categories).where(eq(categories.userId, user.id));
    // Delete buckets via account IDs (buckets don't have userId)
    const userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, user.id),
      columns: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length > 0) {
      await db.delete(buckets).where(inArray(buckets.accountId, accountIds));
    }
    await db.update(accounts).set({ linkedAccountId: null }).where(eq(accounts.userId, user.id));
    await db.delete(accounts).where(eq(accounts.userId, user.id));
    revalidatePath("/");
    logger.warn("All user data cleared", { userId: user.id });
    return { success: true };
  }, "Erreur lors de la suppression des données");
}

export async function importAllData(
  jsonString: string
): Promise<{ success: true; counts: Record<string, number> } | { error: string }> {
  const user = await requireAuth();
  try {
    const parsed = JSON.parse(jsonString);
    const validated = comptesExportSchema.parse(parsed);
    const { data } = validated;

    const counts: Record<string, number> = {};

    // 1. Clear toutes les données existantes de l'utilisateur
    logger.info("Import: clearing existing data", { userId: user.id });
    await db.delete(monthlyBalances).where(eq(monthlyBalances.userId, user.id));
    await db.delete(budgets).where(eq(budgets.userId, user.id));
    await db.delete(transactions).where(eq(transactions.userId, user.id));
    await db.delete(subCategories).where(eq(subCategories.userId, user.id));
    await db.delete(categories).where(eq(categories.userId, user.id));
    // Delete buckets via account IDs
    const existingAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, user.id),
      columns: { id: true },
    });
    const existingAccountIds = existingAccounts.map((a) => a.id);
    if (existingAccountIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      await db.delete(buckets).where(inArray(buckets.accountId, existingAccountIds));
    }
    await db.update(accounts).set({ linkedAccountId: null }).where(eq(accounts.userId, user.id));
    await db.delete(accounts).where(eq(accounts.userId, user.id));
    await db.delete(apiTokens).where(eq(apiTokens.userId, user.id));

    // ID mappings (ancien ID → nouveau ID) pour remapper les FK
    const accountIdMap = new Map<string, string>();
    const categoryIdMap = new Map<string, string>();
    const subCategoryIdMap = new Map<string, string>();
    const bucketIdMap = new Map<string, string>();
    const remap = (map: Map<string, string>, oldId: string | null | undefined) =>
      oldId ? map.get(oldId) ?? null : null;

    // 2. Insérer les comptes (sans linkedAccountId d'abord)
    logger.info("Import: inserting accounts", { userId: user.id, count: data.accounts.length });
    for (const account of data.accounts) {
      const newId = createId();
      accountIdMap.set(account.id, newId);
      await db.insert(accounts).values({
        id: newId,
        userId: user.id,
        name: account.name,
        type: account.type,
        color: account.color,
        icon: account.icon,
        sortOrder: account.sortOrder,
        linkedAccountId: null,
        createdAt: new Date(account.createdAt),
        updatedAt: new Date(account.updatedAt),
      });
    }

    // 3. Insérer les catégories
    logger.info("Import: inserting categories", { userId: user.id, count: data.categories.length });
    for (const category of data.categories) {
      const newId = createId();
      categoryIdMap.set(category.id, newId);
      await db.insert(categories).values({
        id: newId,
        userId: user.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        sortOrder: category.sortOrder,
        createdAt: new Date(category.createdAt),
        updatedAt: new Date(category.updatedAt),
      });
    }

    // 4. Insérer les sous-catégories
    for (const subCategory of data.subCategories) {
      const newId = createId();
      subCategoryIdMap.set(subCategory.id, newId);
      await db.insert(subCategories).values({
        id: newId,
        userId: user.id,
        name: subCategory.name,
        categoryId: remap(categoryIdMap, subCategory.categoryId)!,
        sortOrder: subCategory.sortOrder,
        createdAt: new Date(subCategory.createdAt),
        updatedAt: new Date(subCategory.updatedAt),
      });
    }

    // 5. Insérer les buckets
    for (const bucket of data.buckets) {
      const newId = createId();
      bucketIdMap.set(bucket.id, newId);
      await db.insert(buckets).values({
        id: newId,
        name: bucket.name,
        accountId: remap(accountIdMap, bucket.accountId)!,
        color: bucket.color,
        goal: bucket.goal,
        baseAmount: bucket.baseAmount,
        sortOrder: bucket.sortOrder,
        createdAt: new Date(bucket.createdAt),
        updatedAt: new Date(bucket.updatedAt),
      });
    }

    // 6. Insérer les transactions en batches de 500
    const BATCH_SIZE = 500;
    logger.info("Import: inserting transactions", { userId: user.id, count: data.transactions.length });
    const sortCounters = new Map<string, number>();
    const txValues = data.transactions.map((transaction) => {
      const key = `${transaction.year}-${transaction.month}`;
      let sortOrder: number;
      if (transaction.sortOrder != null && transaction.sortOrder > 0) {
        sortOrder = transaction.sortOrder;
      } else {
        sortOrder = sortCounters.get(key) ?? 0;
      }
      sortCounters.set(key, Math.max(sortCounters.get(key) ?? 0, sortOrder + 1));

      return {
        id: createId(),
        userId: user.id,
        label: transaction.label,
        amount: transaction.amount,
        date: transaction.date ? new Date(transaction.date) : null,
        month: transaction.month,
        year: transaction.year,
        status: transaction.status,
        note: transaction.note,
        accountId: remap(accountIdMap, transaction.accountId)!,
        destinationAccountId: remap(accountIdMap, transaction.destinationAccountId),
        categoryId: remap(categoryIdMap, transaction.categoryId),
        subCategoryId: remap(subCategoryIdMap, transaction.subCategoryId),
        bucketId: remap(bucketIdMap, transaction.bucketId),
        isAmex: transaction.isAmex,
        recurring: transaction.recurring ?? false,
        sortOrder,
        createdAt: new Date(transaction.createdAt),
        updatedAt: new Date(transaction.updatedAt),
      };
    });
    for (let i = 0; i < txValues.length; i += BATCH_SIZE) {
      const batch = txValues.slice(i, i + BATCH_SIZE);
      await db.insert(transactions).values(batch);
      logger.info("Import: transactions batch inserted", { userId: user.id, progress: `${Math.min(i + BATCH_SIZE, txValues.length)}/${txValues.length}` });
    }

    // 7. Insérer les budgets
    logger.info("Import: inserting budgets", { userId: user.id, count: data.budgets.length });
    for (const budget of data.budgets) {
      await db.insert(budgets).values({
        id: createId(),
        userId: user.id,
        categoryId: remap(categoryIdMap, budget.categoryId)!,
        month: budget.month,
        year: budget.year,
        amount: budget.amount,
        createdAt: new Date(budget.createdAt),
        updatedAt: new Date(budget.updatedAt),
      });
    }

    // 8. Insérer les API tokens (ne pas réimporter — les tokens sont spécifiques à l'env)
    // On skip les tokens car le hash ne serait plus valide

    // 9. Restaurer les préférences si présentes
    if (data.appPreferences) {
      const existingPrefs = await db.query.appPreferences.findFirst({
        where: eq(appPreferences.userId, user.id),
      });
      const prefsData = { amexEnabled: data.appPreferences.amexEnabled, separateRecurring: data.appPreferences.separateRecurring ?? true };
      if (existingPrefs) {
        await db.update(appPreferences).set(prefsData).where(eq(appPreferences.userId, user.id));
      } else {
        await db.insert(appPreferences).values({ id: createId(), userId: user.id, ...prefsData });
      }
    }

    // 10. 2e passe : mettre à jour les linkedAccountId
    const accountsWithLinked = data.accounts.filter((a) => a.linkedAccountId);
    for (const account of accountsWithLinked) {
      const newId = accountIdMap.get(account.id)!;
      const newLinkedId = remap(accountIdMap, account.linkedAccountId);
      await db.update(accounts).set({ linkedAccountId: newLinkedId }).where(and(eq(accounts.id, newId), eq(accounts.userId, user.id)));
    }

    // Compteurs depuis les données validées
    counts.accounts = data.accounts.length;
    counts.categories = data.categories.length;
    counts.subCategories = data.subCategories.length;
    counts.buckets = data.buckets.length;
    counts.transactions = data.transactions.length;
    counts.budgets = data.budgets.length;
    // Recalculer les monthly balances (hors transaction — récupérable via Recalculer)
    logger.info("Import: recalculating monthly balances", { userId: user.id });
    await backfillAllMonthlyBalances(user.id);
    const recalculated = await db.query.monthlyBalances.findMany({
      where: eq(monthlyBalances.userId, user.id),
    });
    counts.monthlyBalances = recalculated.length;

    logger.info("Data imported", { userId: user.id, counts });
    revalidatePath("/");
    return { success: true, counts };
  } catch (e) {
    const errorInfo: Record<string, unknown> = { error: e instanceof Error ? e.message : String(e) };
    if (e && typeof e === "object") {
      const obj = e as Record<string, unknown>;
      for (const key of Object.getOwnPropertyNames(obj)) {
        if (key !== "message" && key !== "stack") errorInfo[key] = obj[key];
      }
      if (e instanceof Error && e.cause) {
        const cause = e.cause as Record<string, unknown>;
        errorInfo.cause_message = cause.message ?? String(cause);
        for (const key of Object.getOwnPropertyNames(cause)) {
          if (key !== "message" && key !== "stack") errorInfo[`cause_${key}`] = cause[key];
        }
      }
    }
    logger.error("Erreur lors de l'import des données", errorInfo);
    if (e instanceof SyntaxError) {
      return { error: "Le fichier n'est pas un JSON valide" };
    }
    if (e instanceof Error && e.name === "ZodError") {
      return { error: "Le format du fichier est invalide" };
    }
    return { error: "Erreur lors de l'import des données" };
  }
}

export async function recalculateAllBalances() {
  const user = await requireAuth();
  return safeAction(async () => {
    await db.delete(monthlyBalances).where(eq(monthlyBalances.userId, user.id));
    await backfillAllMonthlyBalances(user.id);
    const recalculated = await db.query.monthlyBalances.findMany({
      where: eq(monthlyBalances.userId, user.id),
    });
    revalidatePath("/");
    logger.info("All balances recalculated", { userId: user.id, count: recalculated.length });
    return { success: true, count: recalculated.length };
  }, "Erreur lors du recalcul des soldes mensuels");
}
