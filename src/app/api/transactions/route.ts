import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { validateApiToken, unauthorizedResponse } from "@/lib/api-auth";
import { recomputeMonthlyBalance } from "@/lib/monthly-balance";
import { revalidatePath } from "next/cache";

const apiTransactionSchema = z.object({
  label: z.string().min(1, "Le libellé est requis"),
  amount: z.number().refine((v) => v !== 0, "Le montant ne peut pas être zéro"),
  categoryId: z.string().min(1, "La catégorie est requise"),
  subCategoryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
  isAmex: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!(await validateApiToken(request))) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = apiTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Résoudre la date (défaut = aujourd'hui)
  const dateStr = data.date ?? new Date().toISOString().slice(0, 10);
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // Résoudre le compte (défaut = premier CHECKING)
  let accountId = data.accountId;
  if (!accountId) {
    const defaultAccount = await prisma.account.findFirst({
      where: { type: "CHECKING" },
      orderBy: { sortOrder: "asc" },
    });
    if (!defaultAccount) {
      return NextResponse.json({ error: "Aucun compte courant trouvé" }, { status: 400 });
    }
    accountId = defaultAccount.id;
  }

  const transaction = await prisma.transaction.create({
    data: {
      label: data.label,
      amount: new Prisma.Decimal(data.amount),
      date,
      month,
      year,
      status: data.status ?? "PENDING",
      accountId,
      categoryId: data.categoryId,
      subCategoryId: data.subCategoryId ?? null,
      isAmex: data.isAmex ?? false,
    },
  });

  await recomputeMonthlyBalance(year, month);
  revalidatePath("/transactions");

  return NextResponse.json(
    {
      id: transaction.id,
      label: transaction.label,
      amount: transaction.amount.toNumber(),
      date: dateStr,
      month,
      year,
      status: transaction.status,
      categoryId: transaction.categoryId,
      accountId: transaction.accountId,
    },
    { status: 201 }
  );
}
