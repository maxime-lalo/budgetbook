"use server";

import { prisma } from "@/lib/prisma";
import { categorySchema, subCategorySchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  const categories = await prisma.category.findMany({
    include: { subCategories: true },
  });
  return categories
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

  await prisma.category.create({ data: parsed.data });
  revalidatePath("/categories");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.category.update({ where: { id }, data: parsed.data });
  revalidatePath("/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  await prisma.category.delete({ where: { id } });
  revalidatePath("/categories");
  return { success: true };
}

export async function createSubCategory(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = subCategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.subCategory.create({ data: parsed.data });
  revalidatePath("/categories");
  return { success: true };
}

export async function updateSubCategory(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = subCategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.subCategory.update({ where: { id }, data: parsed.data });
  revalidatePath("/categories");
  return { success: true };
}

export async function deleteSubCategory(id: string) {
  await prisma.subCategory.delete({ where: { id } });
  revalidatePath("/categories");
  return { success: true };
}
