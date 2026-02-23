"use server";

import { db, accounts, buckets, transactions } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { accountSchema, bucketSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { toNumber } from "@/lib/db/helpers";
import { safeAction } from "@/lib/safe-action";

export async function getAccounts() {
  const result = await db.query.accounts.findMany({
    with: {
      buckets: { orderBy: [asc(buckets.sortOrder)] },
      linkedAccount: true,
      linkedCards: true,
      transactions: {
        where: eq(transactions.status, "COMPLETED"),
        columns: { amount: true, year: true, month: true, destinationAccountId: true },
      },
      incomingTransfers: {
        where: eq(transactions.status, "COMPLETED"),
        columns: { amount: true, year: true, month: true },
      },
    },
    orderBy: [asc(accounts.sortOrder)],
  });

  return result.map((a) => ({
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
      goal: b.goal != null ? toNumber(b.goal) : null,
      baseAmount: toNumber(b.baseAmount),
      sortOrder: b.sortOrder,
    })),
    transactions: a.transactions.map((t) => ({
      amount: toNumber(t.amount),
      year: t.year,
      month: t.month,
      destinationAccountId: t.destinationAccountId,
    })),
    incomingTransfers: a.incomingTransfers.map((t) => ({
      amount: toNumber(t.amount),
      year: t.year,
      month: t.month,
    })),
  }));
}

export async function getCheckingAccounts() {
  return db.query.accounts.findMany({
    where: eq(accounts.type, "CHECKING"),
    orderBy: [asc(accounts.sortOrder)],
  });
}

export async function createAccount(formData: FormData) {
  const raw = Object.fromEntries(formData);
  if (raw.linkedAccountId === "" || raw.linkedAccountId === "__none__") raw.linkedAccountId = null as unknown as string;
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.insert(accounts).values({
      id: createId(),
      ...parsed.data,
      linkedAccountId: parsed.data.linkedAccountId || null,
    });
    revalidatePath("/accounts");
    return { success: true };
  }, "Erreur lors de la création du compte");
}

export async function updateAccount(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  if (raw.linkedAccountId === "" || raw.linkedAccountId === "__none__") raw.linkedAccountId = null as unknown as string;
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.update(accounts).set({
      ...parsed.data,
      linkedAccountId: parsed.data.linkedAccountId || null,
    }).where(eq(accounts.id, id));
    revalidatePath("/accounts");
    return { success: true };
  }, "Erreur lors de la mise à jour du compte");
}

export async function deleteAccount(id: string) {
  return safeAction(async () => {
    await db.delete(accounts).where(eq(accounts.id, id));
    revalidatePath("/accounts");
    return { success: true };
  }, "Erreur lors de la suppression du compte");
}

export async function createBucket(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = bucketSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.insert(buckets).values({
      id: createId(),
      ...parsed.data,
      goal: parsed.data.goal != null ? parsed.data.goal.toString() : null,
      baseAmount: parsed.data.baseAmount.toString(),
    });
    revalidatePath("/accounts");
    return { success: true };
  }, "Erreur lors de la création du bucket");
}

export async function updateBucket(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = bucketSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.update(buckets).set({
      ...parsed.data,
      goal: parsed.data.goal != null ? parsed.data.goal.toString() : null,
      baseAmount: parsed.data.baseAmount.toString(),
    }).where(eq(buckets.id, id));
    revalidatePath("/accounts");
    return { success: true };
  }, "Erreur lors de la mise à jour du bucket");
}

export async function deleteBucket(id: string) {
  return safeAction(async () => {
    await db.delete(buckets).where(eq(buckets.id, id));
    revalidatePath("/accounts");
    return { success: true };
  }, "Erreur lors de la suppression du bucket");
}

export async function getBucketBalance(bucketId: string): Promise<number> {
  const [txs, bucket] = await Promise.all([
    db.query.transactions.findMany({
      where: and(eq(transactions.bucketId, bucketId), eq(transactions.status, "COMPLETED")),
      columns: { amount: true, accountId: true, destinationAccountId: true },
    }),
    db.query.buckets.findFirst({
      where: eq(buckets.id, bucketId),
      columns: { baseAmount: true, accountId: true },
    }),
  ]);
  const base = bucket ? toNumber(bucket.baseAmount) : 0;
  const bucketAccountId = bucket?.accountId;
  let sum = 0;
  for (const t of txs) {
    const amt = toNumber(t.amount);
    const isOutgoing = t.accountId === bucketAccountId && t.destinationAccountId !== null;
    sum += isOutgoing ? amt : -amt;
  }
  return sum + base;
}
