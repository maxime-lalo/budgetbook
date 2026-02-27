"use server";

import { db, categories, subCategories, transactions, budgets } from "@/lib/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { categorySchema, subCategorySchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";
import { requireAuth } from "@/lib/auth/session";

export async function getCategories() {
  const user = await requireAuth();
  const result = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
    with: { subCategories: true },
  });
  return result
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map((c) => ({
      ...c,
      subCategories: c.subCategories.sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }));
}

export async function getCategoryUsageCount(id: string) {
  const user = await requireAuth();
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(eq(transactions.categoryId, id), eq(transactions.userId, user.id)));
  return result.count;
}

export async function createCategory(formData: FormData) {
  const user = await requireAuth();
  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.insert(categories).values({
      id: createId(),
      userId: user.id,
      ...parsed.data,
    });
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la création de la catégorie");
}

export async function updateCategory(id: string, formData: FormData) {
  const user = await requireAuth();
  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.update(categories).set(parsed.data).where(and(eq(categories.id, id), eq(categories.userId, user.id)));
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la mise à jour de la catégorie");
}

export async function deleteCategory(id: string) {
  const user = await requireAuth();
  return safeAction(async () => {
    const subs = await db
      .select({ id: subCategories.id })
      .from(subCategories)
      .where(and(eq(subCategories.categoryId, id), eq(subCategories.userId, user.id)));
    const subIds = subs.map((s) => s.id);

    await db
      .update(transactions)
      .set({ categoryId: null, subCategoryId: null })
      .where(and(eq(transactions.categoryId, id), eq(transactions.userId, user.id)));

    if (subIds.length > 0) {
      await db
        .update(transactions)
        .set({ subCategoryId: null })
        .where(and(inArray(transactions.subCategoryId, subIds), eq(transactions.userId, user.id)));
    }

    await db.delete(budgets).where(and(eq(budgets.categoryId, id), eq(budgets.userId, user.id)));
    await db.delete(subCategories).where(and(eq(subCategories.categoryId, id), eq(subCategories.userId, user.id)));
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.id)));

    revalidatePath("/categories");
    revalidatePath("/transactions");
    revalidatePath("/budgets");
    return { success: true };
  }, "Erreur lors de la suppression de la catégorie");
}

export async function createSubCategory(formData: FormData) {
  const user = await requireAuth();
  const raw = Object.fromEntries(formData);
  const parsed = subCategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.insert(subCategories).values({
      id: createId(),
      userId: user.id,
      ...parsed.data,
    });
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la création de la sous-catégorie");
}

export async function updateSubCategory(id: string, formData: FormData) {
  const user = await requireAuth();
  const raw = Object.fromEntries(formData);
  const parsed = subCategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.update(subCategories).set(parsed.data).where(and(eq(subCategories.id, id), eq(subCategories.userId, user.id)));
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la mise à jour de la sous-catégorie");
}

export async function deleteSubCategory(id: string) {
  const user = await requireAuth();
  return safeAction(async () => {
    await db.delete(subCategories).where(and(eq(subCategories.id, id), eq(subCategories.userId, user.id)));
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la suppression de la sous-catégorie");
}
