"use server";

import { db, transactions, accounts, buckets } from "@/lib/db";
import { eq, and, isNotNull, asc, desc } from "drizzle-orm";
import { type TransactionInput } from "@/lib/validators";
import { toNumber, toISOString } from "@/lib/db/helpers";
import { insertTransaction, updateTransactionById, deleteTransactionById } from "@/lib/transaction-helpers";

export async function getTransfers(year: number, month: number) {
  const result = await db.query.transactions.findMany({
    where: and(
      eq(transactions.year, year),
      eq(transactions.month, month),
      isNotNull(transactions.destinationAccountId)
    ),
    with: {
      account: true,
      category: true,
      subCategory: true,
      bucket: true,
      destinationAccount: true,
    },
    orderBy: [desc(transactions.date), asc(transactions.createdAt)],
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
    destinationAccountId: t.destinationAccountId,
    account: t.account ? { name: t.account.name, color: t.account.color, type: t.account.type } : null,
    destinationAccount: t.destinationAccount
      ? { name: t.destinationAccount.name, color: t.destinationAccount.color, type: t.destinationAccount.type }
      : null,
    category: t.category ? { name: t.category.name, color: t.category.color } : null,
    subCategory: t.subCategory ? { name: t.subCategory.name } : null,
    bucket: t.bucket ? { name: t.bucket.name } : null,
  }));
}

export async function getTransferFormData() {
  const [accountList, categoryList] = await Promise.all([
    db.query.accounts.findMany({
      with: {
        buckets: { orderBy: [asc(buckets.sortOrder)] },
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
      color: a.color,
      buckets: a.buckets.map((b) => ({
        id: b.id,
        name: b.name,
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

const TRANSFER_OVERRIDES = { forceNegativeAmount: true, forceIsAmex: false } as const;

export async function createTransfer(data: TransactionInput) {
  return insertTransaction(data, TRANSFER_OVERRIDES, "Erreur lors de la création du virement");
}

export async function updateTransfer(id: string, data: TransactionInput) {
  return updateTransactionById(id, data, TRANSFER_OVERRIDES, "Erreur lors de la mise à jour du virement");
}

export async function deleteTransfer(id: string) {
  return deleteTransactionById(id, "Erreur lors de la suppression du virement");
}
