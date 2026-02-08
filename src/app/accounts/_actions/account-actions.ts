"use server";

import { prisma } from "@/lib/prisma";
import { accountSchema, bucketSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export async function getAccounts() {
  const accounts = await prisma.account.findMany({
    include: {
      buckets: { orderBy: { sortOrder: "asc" } },
      linkedAccount: true,
      linkedCards: true,
      transactions: {
        where: { status: "COMPLETED" },
        select: { amount: true, year: true, month: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    color: a.color,
    icon: a.icon,
    sortOrder: a.sortOrder,
    linkedAccountId: a.linkedAccountId,
    linkedAccount: a.linkedAccount ? { id: a.linkedAccount.id, name: a.linkedAccount.name } : null,
    linkedCards: a.linkedCards.map((c) => ({ id: c.id, name: c.name })),
    buckets: a.buckets.map((b) => ({
      id: b.id,
      name: b.name,
      accountId: b.accountId,
      color: b.color,
      goal: b.goal?.toNumber() ?? null,
      baseAmount: b.baseAmount.toNumber(),
      sortOrder: b.sortOrder,
    })),
    transactions: a.transactions.map((t) => ({
      amount: t.amount.toNumber(),
      year: t.year,
      month: t.month,
    })),
  }));
}

export async function getCheckingAccounts() {
  return prisma.account.findMany({
    where: { type: "CHECKING" },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createAccount(formData: FormData) {
  const raw = Object.fromEntries(formData);
  if (raw.linkedAccountId === "" || raw.linkedAccountId === "__none__") raw.linkedAccountId = null as unknown as string;
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.account.create({
    data: {
      ...parsed.data,
      linkedAccountId: parsed.data.linkedAccountId || null,
    },
  });
  revalidatePath("/accounts");
  return { success: true };
}

export async function updateAccount(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  if (raw.linkedAccountId === "" || raw.linkedAccountId === "__none__") raw.linkedAccountId = null as unknown as string;
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.account.update({
    where: { id },
    data: {
      ...parsed.data,
      linkedAccountId: parsed.data.linkedAccountId || null,
    },
  });
  revalidatePath("/accounts");
  return { success: true };
}

export async function deleteAccount(id: string) {
  await prisma.account.delete({ where: { id } });
  revalidatePath("/accounts");
  return { success: true };
}

export async function createBucket(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = bucketSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.bucket.create({
    data: {
      ...parsed.data,
      goal: parsed.data.goal ? new Prisma.Decimal(parsed.data.goal) : null,
      baseAmount: new Prisma.Decimal(parsed.data.baseAmount),
    },
  });
  revalidatePath("/accounts");
  return { success: true };
}

export async function updateBucket(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = bucketSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.bucket.update({
    where: { id },
    data: {
      ...parsed.data,
      goal: parsed.data.goal ? new Prisma.Decimal(parsed.data.goal) : null,
      baseAmount: new Prisma.Decimal(parsed.data.baseAmount),
    },
  });
  revalidatePath("/accounts");
  return { success: true };
}

export async function deleteBucket(id: string) {
  await prisma.bucket.delete({ where: { id } });
  revalidatePath("/accounts");
  return { success: true };
}

export async function getBucketBalance(bucketId: string): Promise<number> {
  const [result, bucket] = await Promise.all([
    prisma.transaction.aggregate({
      where: { bucketId, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.bucket.findUnique({ where: { id: bucketId }, select: { baseAmount: true } }),
  ]);
  // Signe inversé : les buckets sont sur des comptes épargne/investissement
  const transactionBalance = -(result._sum.amount?.toNumber() ?? 0);
  return transactionBalance + (bucket?.baseAmount.toNumber() ?? 0);
}
