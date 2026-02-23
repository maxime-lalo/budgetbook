import { db, transactions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { transactionSchema, type TransactionInput } from "@/lib/validators";
import { revalidateTransactionPages } from "@/lib/revalidate";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";
import { toDbDate } from "@/lib/db/helpers";
import { safeAction } from "@/lib/safe-action";

type TransactionOverrides = {
  forceNegativeAmount?: boolean;
  forceIsAmex?: boolean;
  forceRecurring?: boolean;
};

function applyOverrides(data: TransactionInput, overrides?: TransactionOverrides): TransactionInput {
  const result = { ...data };
  if (overrides?.forceNegativeAmount) {
    result.amount = -Math.abs(Number(result.amount));
  }
  if (overrides?.forceIsAmex !== undefined) {
    result.isAmex = overrides.forceIsAmex;
  }
  if (overrides?.forceRecurring !== undefined) {
    result.recurring = overrides.forceRecurring;
  }
  return result;
}

function buildTransactionValues(parsed: {
  label: string;
  amount: number;
  date: Date | null;
  month: number;
  year: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "PRÉVUE";
  note?: string | null;
  accountId: string;
  categoryId?: string | null;
  subCategoryId?: string | null;
  bucketId?: string | null;
  isAmex: boolean;
  recurring: boolean;
  destinationAccountId?: string | null;
}) {
  return {
    label: parsed.label,
    amount: parsed.amount.toString(),
    date: parsed.date ? toDbDate(parsed.date) : null,
    month: parsed.month,
    year: parsed.year,
    status: parsed.status,
    note: parsed.note || null,
    accountId: parsed.accountId,
    categoryId: parsed.categoryId || null,
    subCategoryId: parsed.subCategoryId || null,
    bucketId: parsed.bucketId || null,
    isAmex: parsed.isAmex,
    recurring: parsed.recurring,
    destinationAccountId: parsed.destinationAccountId || null,
  };
}

export async function insertTransaction(
  data: TransactionInput,
  overrides?: TransactionOverrides,
  errorMessage = "Erreur lors de la création"
) {
  const modified = applyOverrides(data, overrides);
  const parsed = transactionSchema.safeParse(modified);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    await db.insert(transactions).values({
      id: createId(),
      ...buildTransactionValues(parsed.data),
    });
    await recomputeMonthlyBalance(parsed.data.year, parsed.data.month);
    revalidateTransactionPages();
    return { success: true };
  }, errorMessage);
}

export async function updateTransactionById(
  id: string,
  data: TransactionInput,
  overrides?: TransactionOverrides,
  errorMessage = "Erreur lors de la mise à jour"
) {
  const modified = applyOverrides(data, overrides);
  const parsed = transactionSchema.safeParse(modified);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  return safeAction(async () => {
    const oldTransaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      columns: { year: true, month: true },
    });

    await db.update(transactions)
      .set(buildTransactionValues(parsed.data))
      .where(eq(transactions.id, id));

    await recomputeMonthlyBalance(parsed.data.year, parsed.data.month);
    if (oldTransaction && (oldTransaction.year !== parsed.data.year || oldTransaction.month !== parsed.data.month)) {
      await recomputeMonthlyBalance(oldTransaction.year, oldTransaction.month);
    }

    revalidateTransactionPages();
    return { success: true };
  }, errorMessage);
}

export async function deleteTransactionById(
  id: string,
  errorMessage = "Erreur lors de la suppression"
) {
  return safeAction(async () => {
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      columns: { year: true, month: true },
    });

    await db.delete(transactions).where(eq(transactions.id, id));

    if (transaction) {
      await recomputeMonthlyBalance(transaction.year, transaction.month);
    }

    revalidateTransactionPages();
    return { success: true };
  }, errorMessage);
}
