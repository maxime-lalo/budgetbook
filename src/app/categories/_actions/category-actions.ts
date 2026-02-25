"use server";

import { db, categories, subCategories, transactions, budgets } from "@/lib/db";
import { eq, sql, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { categorySchema, subCategorySchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/safe-action";

export async function getCategories() {
  const result = await db.query.categories.findMany({
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
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.categoryId, id));
  return result.count;
}

export async function createCategory(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.insert(categories).values({
      id: createId(),
      ...parsed.data,
    });
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la création de la catégorie");
}

export async function updateCategory(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.update(categories).set(parsed.data).where(eq(categories.id, id));
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la mise à jour de la catégorie");
}

export async function deleteCategory(id: string) {
  return safeAction(async () => {
    const subs = await db
      .select({ id: subCategories.id })
      .from(subCategories)
      .where(eq(subCategories.categoryId, id));
    const subIds = subs.map((s) => s.id);

    await db
      .update(transactions)
      .set({ categoryId: null, subCategoryId: null })
      .where(eq(transactions.categoryId, id));

    if (subIds.length > 0) {
      await db
        .update(transactions)
        .set({ subCategoryId: null })
        .where(inArray(transactions.subCategoryId, subIds));
    }

    await db.delete(budgets).where(eq(budgets.categoryId, id));
    await db.delete(subCategories).where(eq(subCategories.categoryId, id));
    await db.delete(categories).where(eq(categories.id, id));

    revalidatePath("/categories");
    revalidatePath("/transactions");
    revalidatePath("/budgets");
    return { success: true };
  }, "Erreur lors de la suppression de la catégorie");
}

export async function createSubCategory(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = subCategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.insert(subCategories).values({
      id: createId(),
      ...parsed.data,
    });
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la création de la sous-catégorie");
}

export async function updateSubCategory(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = subCategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.update(subCategories).set(parsed.data).where(eq(subCategories.id, id));
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la mise à jour de la sous-catégorie");
}

export async function deleteSubCategory(id: string) {
  return safeAction(async () => {
    await db.delete(subCategories).where(eq(subCategories.id, id));
    revalidatePath("/categories");
    return { success: true };
  }, "Erreur lors de la suppression de la sous-catégorie");
}
