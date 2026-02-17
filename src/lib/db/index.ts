import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import postgres from "postgres";
import Database from "better-sqlite3";
import * as pgSchema from "./schema/pg";
import * as sqliteSchema from "./schema/sqlite";

export const provider = process.env.DB_PROVIDER ?? "postgresql";

type PgDb = ReturnType<typeof drizzlePg<typeof pgSchema>>;

function createDb(): PgDb {
  if (provider === "sqlite") {
    const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace("file:", "");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    // Cast to PgDb — both APIs are structurally compatible for DML
    return drizzleSqlite(sqlite, { schema: sqliteSchema }) as unknown as PgDb;
  }

  const connectionString = process.env.DATABASE_URL ?? "postgresql://comptes:comptes@localhost:5432/comptes";
  const client = postgres(connectionString);
  return drizzlePg(client, { schema: pgSchema });
}

const globalForDb = globalThis as unknown as { db: PgDb | undefined };

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

// Export table references matching the active provider
// Both schemas have identical table/column names — safe to cast to pg types for TS
const s = (provider === "sqlite" ? sqliteSchema : pgSchema) as typeof pgSchema;

export const accounts = s.accounts;
export const buckets = s.buckets;
export const categories = s.categories;
export const subCategories = s.subCategories;
export const transactions = s.transactions;
export const budgets = s.budgets;
export const monthlyBalances = s.monthlyBalances;
export const apiTokens = s.apiTokens;
export const appPreferences = s.appPreferences;
