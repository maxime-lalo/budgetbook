"use server";

import { db, users, accounts, transactions, categories, budgets, monthlyBalances, subCategories, apiTokens, appPreferences, buckets, refreshTokens } from "@/lib/db";
import { eq, sql, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { safeAction } from "@/lib/safe-action";

export async function getUsers() {
  const admin = await requireAdmin();

  const allUsers = await db.query.users.findMany({
    orderBy: (u, { asc }) => [asc(u.createdAt)],
  });

  const stats = await Promise.all(
    allUsers.map(async (u) => {
      const [txCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(eq(transactions.userId, u.id));
      const [accCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(accounts)
        .where(eq(accounts.userId, u.id));
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        authProvider: u.authProvider,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt.toISOString(),
        transactionCount: Number(txCount?.count ?? 0),
        accountCount: Number(accCount?.count ?? 0),
        isCurrentUser: u.id === admin.id,
      };
    })
  );

  return stats;
}

export async function deleteUser(userId: string) {
  const admin = await requireAdmin();

  if (userId === admin.id) {
    return { error: "Impossible de supprimer votre propre compte" };
  }

  return safeAction(async () => {
    // Supprimer dans l'ordre des dépendances FK
    await db.delete(monthlyBalances).where(eq(monthlyBalances.userId, userId));
    await db.delete(budgets).where(eq(budgets.userId, userId));
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(subCategories).where(eq(subCategories.userId, userId));
    await db.delete(categories).where(eq(categories.userId, userId));

    // Buckets via account IDs
    const userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, userId),
      columns: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length > 0) {
      await db.delete(buckets).where(inArray(buckets.accountId, accountIds));
    }

    await db.update(accounts).set({ linkedAccountId: null }).where(eq(accounts.userId, userId));
    await db.delete(accounts).where(eq(accounts.userId, userId));
    await db.delete(apiTokens).where(eq(apiTokens.userId, userId));
    await db.delete(appPreferences).where(eq(appPreferences.userId, userId));
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    return { success: true };
  }, "Erreur lors de la suppression de l'utilisateur");
}

export async function toggleAdmin(userId: string, isAdmin: boolean) {
  const admin = await requireAdmin();

  if (userId === admin.id && !isAdmin) {
    return { error: "Impossible de vous retirer les droits administrateur" };
  }

  return safeAction(async () => {
    await db.update(users).set({ isAdmin }).where(eq(users.id, userId));
    return { success: true };
  }, "Erreur lors de la mise à jour des droits");
}

export async function getGlobalStats() {
  await requireAdmin();

  const [[userCount], [txCount], [accCount], [catCount]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(transactions),
    db.select({ count: sql<number>`count(*)` }).from(accounts),
    db.select({ count: sql<number>`count(*)` }).from(categories),
  ]);

  return {
    users: Number(userCount?.count ?? 0),
    transactions: Number(txCount?.count ?? 0),
    accounts: Number(accCount?.count ?? 0),
    categories: Number(catCount?.count ?? 0),
  };
}
