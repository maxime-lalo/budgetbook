import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["CHECKING", "CREDIT_CARD", "SAVINGS", "INVESTMENT"]),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  linkedAccountId: z.string().nullable().optional(),
});

export const bucketSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  accountId: z.string().min(1, "Le compte est requis"),
  color: z.string().nullable().optional(),
  goal: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number().nonnegative("L'objectif doit être positif").nullable()
  ),
  baseAmount: z.preprocess(
    (v) => (v === "" || v === undefined ? 0 : v),
    z.coerce.number().default(0)
  ),
  sortOrder: z.coerce.number().int().default(0),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const subCategorySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  categoryId: z.string().min(1, "La catégorie est requise"),
  sortOrder: z.coerce.number().int().default(0),
});

export const transactionSchema = z
  .object({
    label: z.string().min(1, "Le libellé est requis"),
    amount: z.coerce.number().refine((v) => v !== 0, "Le montant ne peut pas être zéro"),
    date: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      z.coerce.date().nullable()
    ),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100),
    status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).default("PENDING"),
    note: z.string().nullable().optional(),
    accountId: z.string().min(1, "Le compte est requis"),
    categoryId: z.string().nullable().optional(),
    subCategoryId: z.string().nullable().optional(),
    bucketId: z.string().nullable().optional(),
    isAmex: z.boolean().default(false),
    recurring: z.boolean().default(false),
    destinationAccountId: z.string().nullable().optional(),
  })
  .refine(
    (data) => data.status !== "CANCELLED" || (data.note && data.note.trim().length > 0),
    { message: "Une note est requise pour les transactions annulées", path: ["note"] }
  )
  .refine(
    (data) => !data.destinationAccountId || data.destinationAccountId !== data.accountId,
    { message: "Le compte source et destination doivent être différents", path: ["destinationAccountId"] }
  );

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "La catégorie est requise"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  amount: z.coerce.number().nonnegative("Le montant doit être positif"),
});

export type AccountInput = z.infer<typeof accountSchema>;
export type BucketInput = z.infer<typeof bucketSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type SubCategoryInput = z.infer<typeof subCategorySchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;

// --- Schéma de validation pour l'import/export complet ---

const numericString = z.union([z.string(), z.number()]).transform(String);
const nullableNumericString = z.union([z.string(), z.number(), z.null()]).transform((v) => v === null ? null : String(v));

const exportAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["CHECKING", "CREDIT_CARD", "SAVINGS", "INVESTMENT"]),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  sortOrder: z.number(),
  linkedAccountId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const exportBucketSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountId: z.string(),
  color: z.string().nullable(),
  goal: nullableNumericString,
  baseAmount: numericString,
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const exportCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const exportSubCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const exportTransactionSchema = z.object({
  id: z.string(),
  label: z.string(),
  amount: numericString,
  date: z.string().nullable(),
  month: z.number(),
  year: z.number(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
  note: z.string().nullable(),
  accountId: z.string(),
  destinationAccountId: z.string().nullable(),
  categoryId: z.string().nullable(),
  subCategoryId: z.string().nullable(),
  bucketId: z.string().nullable(),
  isAmex: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const exportBudgetSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  month: z.number(),
  year: z.number(),
  amount: numericString,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const exportMonthlyBalanceSchema = z.object({
  id: z.string(),
  year: z.number(),
  month: z.number(),
  forecast: numericString,
  committed: numericString,
  surplus: numericString,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const exportApiTokenSchema = z.object({
  id: z.string(),
  token: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

const exportAppPreferencesSchema = z.object({
  amexEnabled: z.boolean(),
  separateRecurring: z.boolean().optional(),
}).nullable().optional();

export const comptesExportSchema = z.object({
  metadata: z.object({
    exportDate: z.string(),
    formatVersion: z.literal(1),
  }),
  data: z.object({
    accounts: z.array(exportAccountSchema),
    categories: z.array(exportCategorySchema),
    subCategories: z.array(exportSubCategorySchema),
    buckets: z.array(exportBucketSchema),
    transactions: z.array(exportTransactionSchema),
    budgets: z.array(exportBudgetSchema),
    monthlyBalances: z.array(exportMonthlyBalanceSchema),
    apiTokens: z.array(exportApiTokenSchema),
    appPreferences: exportAppPreferencesSchema,
  }),
});

export type ComptesExport = z.infer<typeof comptesExportSchema>;
