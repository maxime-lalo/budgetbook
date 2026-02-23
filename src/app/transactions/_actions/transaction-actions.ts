"use server";

import { db, transactions, accounts, buckets } from "@/lib/db";
import { eq, and, inArray, sql, asc, desc, gte, lte, or } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { partialTransactionFieldSchema, type TransactionInput } from "@/lib/validators";
import { revalidateTransactionPages } from "@/lib/revalidate";
import { recomputeMonthlyBalance, getCarryOver } from "@/lib/monthly-balance";
import { toNumber, toISOString, toDbDate, round2, getCheckingAccountIds } from "@/lib/db/helpers";
import { safeAction } from "@/lib/safe-action";
import { insertTransaction, updateTransactionById, deleteTransactionById } from "@/lib/transaction-helpers";

export async function getTransactions(year: number, month: number) {
  const result = await db.query.transactions.findMany({
    where: and(eq(transactions.year, year), eq(transactions.month, month)),
    with: {
      account: true,
      category: true,
      subCategory: true,
      bucket: true,
      destinationAccount: { columns: { name: true, color: true } },
    },
    orderBy: [
      sql`CASE WHEN ${transactions.recurring} THEN 0 ELSE 1 END`,
      asc(transactions.date),
      asc(transactions.createdAt),
      asc(transactions.label),
    ],
  });

  return result.map((t) => ({
    id: t.id,
    label: t.label,
    amount: toNumber(t.amount),
    date: t.date ? toISOString(t.date) : null,
    month: t.month,
    year: t.year,
    status: t.status,
    note: t.note,
    accountId: t.accountId,
    categoryId: t.categoryId,
    subCategoryId: t.subCategoryId,
    bucketId: t.bucketId,
    isAmex: t.isAmex,
    recurring: t.recurring,
    destinationAccountId: t.destinationAccountId,
    account: t.account ? { name: t.account.name, color: t.account.color } : null,
    destinationAccount: t.destinationAccount ? { name: t.destinationAccount.name, color: t.destinationAccount.color } : null,
    category: t.category ? { name: t.category.name, color: t.category.color } : null,
    subCategory: t.subCategory ? { name: t.subCategory.name } : null,
    bucket: t.bucket ? { name: t.bucket.name } : null,
  }));
}

export async function getTransactionTotals(year: number, month: number) {
  const checkingIds = await getCheckingAccountIds();

  if (checkingIds.length === 0) {
    return { real: 0, pending: 0, planned: 0, forecast: 0 };
  }

  const baseWhere = and(eq(transactions.year, year), eq(transactions.month, month));

  const [[outgoing], [incoming]] = await Promise.all([
    db.select({
      completed: sql<string>`coalesce(sum(case when ${transactions.status} = 'COMPLETED' then ${transactions.amount} end), 0)`,
      pending:   sql<string>`coalesce(sum(case when ${transactions.status} = 'PENDING'   then ${transactions.amount} end), 0)`,
      planned:   sql<string>`coalesce(sum(case when ${transactions.status} = 'PLANNED'   then ${transactions.amount} end), 0)`,
    })
      .from(transactions)
      .where(and(baseWhere, inArray(transactions.accountId, checkingIds))),
    db.select({
      completed: sql<string>`coalesce(sum(case when ${transactions.status} = 'COMPLETED' then ${transactions.amount} end), 0)`,
      pending:   sql<string>`coalesce(sum(case when ${transactions.status} = 'PENDING'   then ${transactions.amount} end), 0)`,
      planned:   sql<string>`coalesce(sum(case when ${transactions.status} = 'PLANNED'   then ${transactions.amount} end), 0)`,
    })
      .from(transactions)
      .where(and(baseWhere, inArray(transactions.destinationAccountId, checkingIds))),
  ]);

  const realTotal = round2(toNumber(outgoing.completed) + -(toNumber(incoming.completed)));
  const pendingTotal = round2(toNumber(outgoing.pending) + -(toNumber(incoming.pending)));
  const plannedTotal = round2(toNumber(outgoing.planned) + -(toNumber(incoming.planned)));

  return {
    real: realTotal,
    pending: pendingTotal,
    planned: plannedTotal,
    forecast: round2(realTotal + pendingTotal + plannedTotal),
  };
}

export async function createTransaction(data: TransactionInput) {
  return insertTransaction(data, undefined, "Erreur lors de la création de la transaction");
}

export async function updateTransaction(id: string, data: TransactionInput) {
  return updateTransactionById(id, data, undefined, "Erreur lors de la mise à jour de la transaction");
}

export async function deleteTransaction(id: string) {
  return deleteTransactionById(id, "Erreur lors de la suppression de la transaction");
}

export async function markTransactionCompleted(id: string) {
  return safeAction(async () => {
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      columns: { year: true, month: true },
    });

    await db.update(transactions).set({ status: "COMPLETED" }).where(eq(transactions.id, id));

    if (transaction) {
      await recomputeMonthlyBalance(transaction.year, transaction.month);
    }

    revalidateTransactionPages();
    return { success: true };
  }, "Erreur lors de la validation de la transaction");
}

export async function completeAmexTransactions(year: number, month: number) {
  return safeAction(async () => {
    const amexWhere = and(
      eq(transactions.year, year),
      eq(transactions.month, month),
      eq(transactions.status, "PENDING"),
      eq(transactions.isAmex, true)
    );

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(amexWhere);

    await db
      .update(transactions)
      .set({ status: "COMPLETED" })
      .where(amexWhere);

    await recomputeMonthlyBalance(year, month);
    revalidateTransactionPages();
    return { count: Number(count) };
  }, "Erreur lors de la validation des transactions AMEX");
}

export async function cancelTransaction(id: string, note: string) {
  if (!note.trim()) return { error: "Une note est requise pour annuler" };

  return safeAction(async () => {
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      columns: { year: true, month: true },
    });

    await db.update(transactions).set({ status: "CANCELLED", note }).where(eq(transactions.id, id));

    if (transaction) {
      await recomputeMonthlyBalance(transaction.year, transaction.month);
    }

    revalidateTransactionPages();
    return { success: true };
  }, "Erreur lors de l'annulation de la transaction");
}

export async function updateTransactionField(
  id: string,
  fields: Partial<{
    label: string;
    amount: number;
    date: string | null;
    month: number;
    year: number;
    accountId: string;
    categoryId: string;
    subCategoryId: string | null;
    bucketId: string | null;
    status: string;
    note: string | null;
    isAmex: boolean;
    recurring: boolean;
    destinationAccountId: string | null;
  }>
) {
  const validated = partialTransactionFieldSchema.safeParse(fields);
  if (!validated.success) return { error: validated.error.flatten().fieldErrors };

  return safeAction(async () => {
    const oldTransaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      columns: { year: true, month: true },
    });

    const data: Record<string, unknown> = {};

    if (fields.label !== undefined) data.label = fields.label;
    if (fields.amount !== undefined) data.amount = fields.amount.toString();
    if (fields.date !== undefined) {
      if (fields.date === null) {
        data.date = null;
      } else {
        data.date = toDbDate(new Date(fields.date));
      }
    }
    if (fields.month !== undefined) data.month = fields.month;
    if (fields.year !== undefined) data.year = fields.year;
    if (fields.accountId !== undefined) data.accountId = fields.accountId;
    if (fields.categoryId !== undefined) data.categoryId = fields.categoryId;
    if (fields.subCategoryId !== undefined) data.subCategoryId = fields.subCategoryId;
    if (fields.bucketId !== undefined) data.bucketId = fields.bucketId;
    if (fields.status !== undefined) data.status = fields.status;
    if (fields.note !== undefined) data.note = fields.note;
    if (fields.isAmex !== undefined) data.isAmex = fields.isAmex;
    if (fields.recurring !== undefined) data.recurring = fields.recurring;
    if (fields.destinationAccountId !== undefined) data.destinationAccountId = fields.destinationAccountId;

    await db.update(transactions).set(data).where(eq(transactions.id, id));

    const updated = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      columns: { year: true, month: true },
    });

    if (updated) {
      await recomputeMonthlyBalance(updated.year, updated.month);
    }
    if (oldTransaction && updated && (oldTransaction.year !== updated.year || oldTransaction.month !== updated.month)) {
      await recomputeMonthlyBalance(oldTransaction.year, oldTransaction.month);
    }

    revalidateTransactionPages();
    return { success: true };
  }, "Erreur lors de la mise à jour du champ");
}

export async function copyRecurringTransactions(year: number, month: number) {
  return safeAction(async () => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const previousRecurring = await db.query.transactions.findMany({
      where: and(
        eq(transactions.year, prevYear),
        eq(transactions.month, prevMonth),
        eq(transactions.recurring, true)
      ),
    });

    if (previousRecurring.length === 0) {
      return { error: "Aucune transaction récurrente trouvée pour le mois précédent" };
    }

    // Supprimer les récurrentes existantes du mois cible
    await db.delete(transactions).where(
      and(eq(transactions.year, year), eq(transactions.month, month), eq(transactions.recurring, true))
    );

    // Copier avec status PENDING et sans note (batch insert)
    await db.insert(transactions).values(
      previousRecurring.map((t) => ({
        id: createId(),
        label: t.label,
        amount: t.amount,
        date: null,
        month,
        year,
        status: "PENDING" as const,
        note: null,
        accountId: t.accountId,
        categoryId: t.categoryId,
        subCategoryId: t.subCategoryId,
        bucketId: t.bucketId,
        isAmex: t.isAmex,
        recurring: true,
        destinationAccountId: t.destinationAccountId,
      }))
    );

    await recomputeMonthlyBalance(year, month);
    revalidateTransactionPages();
    return { success: true, count: previousRecurring.length };
  }, "Erreur lors de la copie des transactions récurrentes");
}

export async function getPreviousMonthBudgetRemaining(year: number, month: number) {
  return getCarryOver(year, month);
}

export async function searchTransactionsAcrossMonths(
  query: string,
  filters: {
    categoryId?: string;
    accountId?: string;
    status?: string;
    amountMin?: number;
    amountMax?: number;
  }
) {
  const conditions = [];

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${transactions.label}) like ${pattern}`,
        sql`lower(${transactions.note}) like ${pattern}`
      )
    );
  }

  if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.status) {
    conditions.push(eq(transactions.status, filters.status as "PENDING" | "COMPLETED" | "CANCELLED" | "PLANNED"));
  }
  if (filters.amountMin !== undefined) {
    conditions.push(gte(transactions.amount, filters.amountMin.toString()));
  }
  if (filters.amountMax !== undefined) {
    conditions.push(lte(transactions.amount, filters.amountMax.toString()));
  }

  const result = await db.query.transactions.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      category: true,
      account: true,
    },
    orderBy: [desc(transactions.year), desc(transactions.month), desc(transactions.date)],
    limit: 50,
  });

  return result.map((t) => ({
    id: t.id,
    label: t.label,
    amount: toNumber(t.amount),
    date: t.date ? toISOString(t.date) : null,
    month: t.month,
    year: t.year,
    status: t.status,
    category: t.category ? { name: t.category.name, color: t.category.color } : null,
    account: t.account ? { name: t.account.name } : null,
  }));
}

export async function getFormData() {
  const [accountList, categoryList] = await Promise.all([
    db.query.accounts.findMany({
      with: {
        buckets: { orderBy: [asc(buckets.sortOrder)] },
        linkedCards: true,
      },
      orderBy: [asc(accounts.sortOrder)],
    }),
    db.query.categories.findMany({
      with: { subCategories: true },
    }),
  ]);

  return {
    accounts: accountList.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      buckets: a.buckets.map((b) => ({
        id: b.id,
        name: b.name,
      })),
      linkedCards: a.linkedCards.map((c) => ({
        id: c.id,
        name: c.name,
      })),
    })),
    categories: categoryList
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        subCategories: c.subCategories
          .sort((a, b) => a.name.localeCompare(b.name, "fr"))
          .map((s) => ({
            id: s.id,
            name: s.name,
          })),
      })),
  };
}
