import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as pgSchema from "./schema/pg";
import { env } from "@/lib/env";

function createDb() {
  const connectionString = env.DATABASE_URL ?? "postgresql://comptes:comptes@localhost:5432/comptes";
  const client = postgres(connectionString);
  return drizzle(client, { schema: pgSchema });
}

const globalForDb = globalThis as unknown as { db: ReturnType<typeof createDb> | undefined };

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export const users = pgSchema.users;
export const refreshTokens = pgSchema.refreshTokens;
export const accounts = pgSchema.accounts;
export const buckets = pgSchema.buckets;
export const categories = pgSchema.categories;
export const subCategories = pgSchema.subCategories;
export const transactions = pgSchema.transactions;
export const budgets = pgSchema.budgets;
export const monthlyBalances = pgSchema.monthlyBalances;
export const apiTokens = pgSchema.apiTokens;
export const appPreferences = pgSchema.appPreferences;
