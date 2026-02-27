import { NextResponse } from "next/server";
import { db, transactions, accounts, appPreferences } from "@/lib/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { validateApiToken, unauthorizedResponse } from "@/lib/api-auth";
import { TRANSACTION_STATUSES } from "@/lib/types";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";
import { revalidatePath } from "next/cache";
import { toDbDate } from "@/lib/db/helpers";
import { logger } from "@/lib/logger";

const apiTransactionSchema = z.object({
  label: z.string().min(1, "Le libellé est requis"),
  amount: z.number().refine((v) => v !== 0, "Le montant ne peut pas être zéro"),
  categoryId: z.string().min(1, "La catégorie est requise"),
  subCategoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  isAmex: z.boolean().optional(),
});

export async function POST(request: Request) {
  const userId = await validateApiToken(request);
  if (!userId) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn("API: Invalid JSON in transaction request", { userId });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = apiTransactionSchema.safeParse(body);
  if (!parsed.success) {
    logger.debug("API: Transaction validation failed", { userId, errors: parsed.error.flatten().fieldErrors });
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Forcer isAmex à false si le support AMEX est désactivé
  const prefs = await db.query.appPreferences.findFirst({
    where: eq(appPreferences.userId, userId),
  });
  const amexEnabled = prefs?.amexEnabled ?? true;
  if (!amexEnabled) {
    data.isAmex = false;
  }

  // Résoudre la date (défaut = aujourd'hui)
  const dateStr = data.date ?? new Date().toISOString().slice(0, 10);
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // Résoudre le compte (défaut = premier CHECKING)
  let accountId = data.accountId;
  if (!accountId) {
    const defaultAccount = await db.query.accounts.findFirst({
      where: and(eq(accounts.type, "CHECKING"), eq(accounts.userId, userId)),
      orderBy: asc(accounts.sortOrder),
    });
    if (!defaultAccount) {
      return NextResponse.json({ error: "Aucun compte courant trouvé" }, { status: 400 });
    }
    accountId = defaultAccount.id;
  }

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${transactions.sortOrder}), -1)` })
    .from(transactions)
    .where(and(
      eq(transactions.year, year),
      eq(transactions.month, month),
      eq(transactions.userId, userId)
    ));

  const id = createId();
  await db.insert(transactions).values({
    id,
    userId,
    label: data.label,
    amount: data.amount.toString(),
    date: toDbDate(date),
    month,
    year,
    status: data.status ?? "PENDING",
    accountId,
    categoryId: data.categoryId,
    subCategoryId: data.subCategoryId ?? null,
    isAmex: data.isAmex ?? false,
    sortOrder: (maxRow?.max ?? -1) + 1,
  });

  await recomputeMonthlyBalance(year, month, userId);
  revalidatePath("/transactions");

  logger.info("API: Transaction created", { userId, label: data.label, amount: data.amount });

  return NextResponse.json(
    {
      id,
      label: data.label,
      amount: data.amount,
      date: dateStr,
      month,
      year,
      status: data.status ?? "PENDING",
      categoryId: data.categoryId,
      accountId,
    },
    { status: 201 }
  );
}
