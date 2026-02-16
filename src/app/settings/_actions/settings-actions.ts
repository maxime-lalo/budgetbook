"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { comptesExportSchema } from "@/lib/validators";

export async function getApiToken() {
  const token = await prisma.apiToken.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!token) return null;

  return {
    token: token.token,
    createdAt: token.createdAt.toISOString(),
  };
}

export async function regenerateApiToken() {
  await prisma.apiToken.deleteMany();

  const newToken = await prisma.apiToken.create({
    data: {
      token: randomUUID(),
    },
  });

  return {
    token: newToken.token,
    createdAt: newToken.createdAt.toISOString(),
  };
}

export async function getAppPreferences() {
  const prefs = await prisma.appPreferences.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", amexEnabled: true },
  });
  return { amexEnabled: prefs.amexEnabled };
}

export async function updateAmexEnabled(enabled: boolean) {
  await prisma.appPreferences.upsert({
    where: { id: "singleton" },
    update: { amexEnabled: enabled },
    create: { id: "singleton", amexEnabled: enabled },
  });
  revalidatePath("/transactions");
  revalidatePath("/settings");
}

export async function exportAllData(): Promise<string> {
  const [accounts, categories, subCategories, buckets, transactions, budgets, monthlyBalances, apiTokens, appPreferences] =
    await Promise.all([
      prisma.account.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.subCategory.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.bucket.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.transaction.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.budget.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.monthlyBalance.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }] }),
      prisma.apiToken.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.appPreferences.findUnique({ where: { id: "singleton" } }),
    ]);

  const serialize = <T extends Record<string, unknown>>(items: T[]) =>
    items.map((item) => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(item)) {
        if (value instanceof Prisma.Decimal) {
          result[key] = value.toString();
        } else if (value instanceof Date) {
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
      accounts: serialize(accounts),
      categories: serialize(categories),
      subCategories: serialize(subCategories),
      buckets: serialize(buckets),
      transactions: serialize(transactions),
      budgets: serialize(budgets),
      monthlyBalances: serialize(monthlyBalances),
      apiTokens: serialize(apiTokens),
      appPreferences: appPreferences ? { amexEnabled: appPreferences.amexEnabled } : null,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

export async function clearAllData(): Promise<{ success: true } | { error: string }> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.monthlyBalance.deleteMany();
        await tx.budget.deleteMany();
        await tx.transaction.deleteMany();
        await tx.subCategory.deleteMany();
        await tx.category.deleteMany();
        await tx.bucket.deleteMany();
        // Supprimer les linkedAccountId avant de supprimer les comptes
        await tx.account.updateMany({ data: { linkedAccountId: null } });
        await tx.account.deleteMany();
      },
      { timeout: 60000 }
    );

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error("Erreur lors de la suppression des données:", e);
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

    await prisma.$transaction(
      async (tx) => {
        // 1. Clear toutes les données existantes
        await tx.monthlyBalance.deleteMany();
        await tx.budget.deleteMany();
        await tx.transaction.deleteMany();
        await tx.subCategory.deleteMany();
        await tx.category.deleteMany();
        await tx.bucket.deleteMany();
        await tx.account.updateMany({ data: { linkedAccountId: null } });
        await tx.account.deleteMany();
        await tx.apiToken.deleteMany();

        // 2. Insérer les comptes (sans linkedAccountId d'abord)
        for (const account of data.accounts) {
          await tx.account.create({
            data: {
              id: account.id,
              name: account.name,
              type: account.type,
              color: account.color,
              icon: account.icon,
              sortOrder: account.sortOrder,
              linkedAccountId: null,
              createdAt: new Date(account.createdAt),
              updatedAt: new Date(account.updatedAt),
            },
          });
        }
        counts.accounts = data.accounts.length;

        // 3. Insérer les catégories
        for (const category of data.categories) {
          await tx.category.create({
            data: {
              id: category.id,
              name: category.name,
              color: category.color,
              icon: category.icon,
              sortOrder: category.sortOrder,
              createdAt: new Date(category.createdAt),
              updatedAt: new Date(category.updatedAt),
            },
          });
        }
        counts.categories = data.categories.length;

        // 4. Insérer les sous-catégories
        for (const subCategory of data.subCategories) {
          await tx.subCategory.create({
            data: {
              id: subCategory.id,
              name: subCategory.name,
              categoryId: subCategory.categoryId,
              sortOrder: subCategory.sortOrder,
              createdAt: new Date(subCategory.createdAt),
              updatedAt: new Date(subCategory.updatedAt),
            },
          });
        }
        counts.subCategories = data.subCategories.length;

        // 5. Insérer les buckets
        for (const bucket of data.buckets) {
          await tx.bucket.create({
            data: {
              id: bucket.id,
              name: bucket.name,
              accountId: bucket.accountId,
              color: bucket.color,
              goal: bucket.goal ? new Prisma.Decimal(bucket.goal) : null,
              baseAmount: new Prisma.Decimal(bucket.baseAmount),
              sortOrder: bucket.sortOrder,
              createdAt: new Date(bucket.createdAt),
              updatedAt: new Date(bucket.updatedAt),
            },
          });
        }
        counts.buckets = data.buckets.length;

        // 6. Insérer les transactions
        for (const transaction of data.transactions) {
          await tx.transaction.create({
            data: {
              id: transaction.id,
              label: transaction.label,
              amount: new Prisma.Decimal(transaction.amount),
              date: transaction.date ? new Date(transaction.date) : null,
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
              createdAt: new Date(transaction.createdAt),
              updatedAt: new Date(transaction.updatedAt),
            },
          });
        }
        counts.transactions = data.transactions.length;

        // 7. Insérer les budgets
        for (const budget of data.budgets) {
          await tx.budget.create({
            data: {
              id: budget.id,
              categoryId: budget.categoryId,
              month: budget.month,
              year: budget.year,
              amount: new Prisma.Decimal(budget.amount),
              createdAt: new Date(budget.createdAt),
              updatedAt: new Date(budget.updatedAt),
            },
          });
        }
        counts.budgets = data.budgets.length;

        // 8. Insérer les monthly balances
        for (const mb of data.monthlyBalances) {
          await tx.monthlyBalance.create({
            data: {
              id: mb.id,
              year: mb.year,
              month: mb.month,
              forecast: new Prisma.Decimal(mb.forecast),
              committed: new Prisma.Decimal(mb.committed),
              surplus: new Prisma.Decimal(mb.surplus),
              createdAt: new Date(mb.createdAt),
              updatedAt: new Date(mb.updatedAt),
            },
          });
        }
        counts.monthlyBalances = data.monthlyBalances.length;

        // 9. Insérer les API tokens
        for (const token of data.apiTokens) {
          await tx.apiToken.create({
            data: {
              id: token.id,
              token: token.token,
              name: token.name,
              createdAt: new Date(token.createdAt),
            },
          });
        }
        counts.apiTokens = data.apiTokens.length;

        // 10. Restaurer les préférences si présentes
        if (data.appPreferences) {
          await tx.appPreferences.upsert({
            where: { id: "singleton" },
            update: { amexEnabled: data.appPreferences.amexEnabled },
            create: { id: "singleton", amexEnabled: data.appPreferences.amexEnabled },
          });
        }

        // 11. 2e passe : mettre à jour les linkedAccountId
        const accountsWithLinked = data.accounts.filter((a) => a.linkedAccountId);
        for (const account of accountsWithLinked) {
          await tx.account.update({
            where: { id: account.id },
            data: { linkedAccountId: account.linkedAccountId },
          });
        }
      },
      { timeout: 60000 }
    );

    revalidatePath("/");
    return { success: true, counts };
  } catch (e) {
    console.error("Erreur lors de l'import des données:", e);
    if (e instanceof SyntaxError) {
      return { error: "Le fichier n'est pas un JSON valide" };
    }
    if (e instanceof Error && e.name === "ZodError") {
      return { error: "Le format du fichier est invalide" };
    }
    return { error: "Erreur lors de l'import des données" };
  }
}
