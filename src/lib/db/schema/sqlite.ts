import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// --- Tables ---

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["CHECKING", "CREDIT_CARD", "SAVINGS", "INVESTMENT"] }).notNull(),
  color: text("color"),
  icon: text("icon"),
  sortOrder: integer("sortOrder").notNull().default(0),
  linkedAccountId: text("linkedAccountId"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
}, (t) => [
  foreignKey({ columns: [t.linkedAccountId], foreignColumns: [t.id] }).onDelete("set null"),
]);

export const buckets = sqliteTable(
  "buckets",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    accountId: text("accountId").notNull(),
    color: text("color"),
    goal: real("goal"),
    baseAmount: real("baseAmount").notNull().default(0),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index("buckets_accountId_idx").on(t.accountId),
    foreignKey({ columns: [t.accountId], foreignColumns: [accounts.id] }).onDelete("cascade"),
  ]
);

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
  icon: text("icon"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
});

export const subCategories = sqliteTable(
  "sub_categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    categoryId: text("categoryId").notNull(),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    uniqueIndex("sub_categories_categoryId_name_key").on(t.categoryId, t.name),
    foreignKey({ columns: [t.categoryId], foreignColumns: [categories.id] }).onDelete("cascade"),
  ]
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    amount: real("amount").notNull(),
    date: text("date"),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    status: text("status", { enum: ["PENDING", "COMPLETED", "CANCELLED", "PLANNED"] }).notNull().default("PENDING"),
    note: text("note"),
    accountId: text("accountId").notNull(),
    destinationAccountId: text("destinationAccountId"),
    categoryId: text("categoryId"),
    subCategoryId: text("subCategoryId"),
    bucketId: text("bucketId"),
    isAmex: integer("isAmex", { mode: "boolean" }).notNull().default(false),
    recurring: integer("recurring", { mode: "boolean" }).notNull().default(false),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index("transactions_accountId_date_idx").on(t.accountId, t.date),
    index("transactions_categoryId_idx").on(t.categoryId),
    index("transactions_date_idx").on(t.date),
    index("transactions_status_idx").on(t.status),
    index("transactions_isAmex_status_idx").on(t.isAmex, t.status),
    index("transactions_destinationAccountId_idx").on(t.destinationAccountId),
    index("transactions_year_month_status_idx").on(t.year, t.month, t.status),
    index("transactions_accountId_status_idx").on(t.accountId, t.status),
    foreignKey({ columns: [t.accountId], foreignColumns: [accounts.id] }).onDelete("restrict"),
    foreignKey({ columns: [t.destinationAccountId], foreignColumns: [accounts.id] }).onDelete("set null"),
    foreignKey({ columns: [t.categoryId], foreignColumns: [categories.id] }).onDelete("restrict"),
    foreignKey({ columns: [t.subCategoryId], foreignColumns: [subCategories.id] }).onDelete("set null"),
    foreignKey({ columns: [t.bucketId], foreignColumns: [buckets.id] }).onDelete("set null"),
  ]
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    categoryId: text("categoryId").notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    amount: real("amount").notNull(),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    uniqueIndex("budgets_categoryId_year_month_key").on(t.categoryId, t.year, t.month),
    index("budgets_year_month_idx").on(t.year, t.month),
    foreignKey({ columns: [t.categoryId], foreignColumns: [categories.id] }).onDelete("cascade"),
  ]
);

export const monthlyBalances = sqliteTable(
  "monthly_balances",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    forecast: real("forecast").notNull(),
    committed: real("committed").notNull(),
    surplus: real("surplus").notNull(),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    uniqueIndex("monthly_balances_year_month_key").on(t.year, t.month),
  ]
);

export const apiTokens = sqliteTable("api_tokens", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  tokenPrefix: text("tokenPrefix").notNull().default(""),
  name: text("name").notNull().default("default"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
});

export const appPreferences = sqliteTable("app_preferences", {
  id: text("id").primaryKey().default("singleton"),
  amexEnabled: integer("amexEnabled", { mode: "boolean" }).notNull().default(true),
  separateRecurring: integer("separateRecurring", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
});

// --- Relations ---

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  linkedAccount: one(accounts, {
    fields: [accounts.linkedAccountId],
    references: [accounts.id],
    relationName: "AmexLink",
  }),
  linkedCards: many(accounts, { relationName: "AmexLink" }),
  buckets: many(buckets),
  transactions: many(transactions, { relationName: "TransactionSource" }),
  incomingTransfers: many(transactions, { relationName: "TransactionDestination" }),
}));

export const bucketsRelations = relations(buckets, ({ one, many }) => ({
  account: one(accounts, {
    fields: [buckets.accountId],
    references: [accounts.id],
  }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  subCategories: many(subCategories),
  transactions: many(transactions),
  budgets: many(budgets),
}));

export const subCategoriesRelations = relations(subCategories, ({ one, many }) => ({
  category: one(categories, {
    fields: [subCategories.categoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
    relationName: "TransactionSource",
  }),
  destinationAccount: one(accounts, {
    fields: [transactions.destinationAccountId],
    references: [accounts.id],
    relationName: "TransactionDestination",
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  subCategory: one(subCategories, {
    fields: [transactions.subCategoryId],
    references: [subCategories.id],
  }),
  bucket: one(buckets, {
    fields: [transactions.bucketId],
    references: [buckets.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));
