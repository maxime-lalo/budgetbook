"use server";

import { db, categories, subCategories } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { categorySchema, subCategorySchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";

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

export async function createCategory(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.insert(categories).values({
    id: createId(),
    ...parsed.data,
  });
  revalidatePath("/categories");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.update(categories).set(parsed.data).where(eq(categories.id, id));
  revalidatePath("/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/categories");
  return { success: true };
}

export async function createSubCategory(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = subCategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.insert(subCategories).values({
    id: createId(),
    ...parsed.data,
  });
  revalidatePath("/categories");
  return { success: true };
}

export async function updateSubCategory(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = subCategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await db.update(subCategories).set(parsed.data).where(eq(subCategories.id, id));
  revalidatePath("/categories");
  return { success: true };
}

export async function deleteSubCategory(id: string) {
  await db.delete(subCategories).where(eq(subCategories.id, id));
  revalidatePath("/categories");
  return { success: true };
}
