/**
 * Import extracted JSON data into the database via Drizzle.
 * Only imports BNP account transactions and categories.
 *
 * Usage: pnpm db:import
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, inArray, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import * as pgSchema from "../src/lib/db/schema/pg";
import { toNumber } from "../src/lib/db/helpers";
import { readFileSync } from "fs";
import { join } from "path";

function createDb() {
  const connectionString = process.env.DATABASE_URL ?? "postgresql://comptes:comptes@localhost:5432/comptes";
  const client = postgres(connectionString);
  return drizzle(client, { schema: pgSchema });
}

const db = createDb();
const s = pgSchema;

const DATA_DIR = join(__dirname, "data");

interface CategoryData {
  name: string;
  subcategories: string[];
  color: string;
}

interface TransactionData {
  year: number;
  month: number;
  amount: number;
  label: string;
  date: string | null;
  status: string;
  category?: string;
  subcategory?: string;
}

function readJSON<T>(filename: string): T {
  const path = join(DATA_DIR, filename);
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

let importUserId = "";

async function clearDatabase() {
  console.log("Clearing database...");
  await db.delete(s.monthlyBalances);
  await db.delete(s.budgets);
  await db.delete(s.transactions);
  await db.delete(s.subCategories);
  await db.delete(s.categories);
  await db.delete(s.buckets);
  await db.delete(s.accounts);
  await db.delete(s.refreshTokens);
  await db.delete(s.users);
  console.log("  All tables cleared.");
}

async function createUserAndAccounts() {
  console.log("Creating user and accounts...");

  const userId = createId();
  await db.insert(s.users).values({
    id: userId,
    email: "admin@comptes.local",
    name: "Admin",
    passwordHash: null,
    authProvider: "local",
    isAdmin: true,
  });
  importUserId = userId;

  await db.insert(s.accounts).values({
    id: "bnp-checking", userId, name: "BNP", type: "CHECKING", color: "#4f46e5", icon: "Wallet", sortOrder: 0,
  });

  await db.insert(s.accounts).values({
    id: "livret-a", userId, name: "Livret A", type: "SAVINGS", color: "#10b981", icon: "PiggyBank", sortOrder: 1,
  });

  console.log("  Created accounts: BNP, Livret A");
  return { bnpId: "bnp-checking", livretAId: "livret-a" };
}

async function importCategories(categoriesData: CategoryData[]) {
  console.log(`Importing ${categoriesData.length} categories...`);

  const categoryMap = new Map<string, string>();
  const subCategoryMap = new Map<string, string>();

  for (let i = 0; i < categoriesData.length; i++) {
    const cat = categoriesData[i];
    const catId = createId();
    await db.insert(s.categories).values({
      id: catId, userId: importUserId, name: cat.name, color: cat.color, sortOrder: i,
    });
    categoryMap.set(cat.name, catId);

    for (let j = 0; j < cat.subcategories.length; j++) {
      const subName = cat.subcategories[j];
      const subId = createId();
      await db.insert(s.subCategories).values({
        id: subId, userId: importUserId, name: subName, categoryId: catId, sortOrder: j,
      });
      subCategoryMap.set(`${cat.name}|${subName}`, subId);
    }
  }

  console.log(`  ${categoryMap.size} categories, ${subCategoryMap.size} subcategories created.`);
  return { categoryMap, subCategoryMap };
}

async function importTransactions(
  transactionsData: TransactionData[],
  accountIds: { bnpId: string; livretAId: string },
  categoryMap: Map<string, string>,
  subCategoryMap: Map<string, string>
) {
  console.log(`Importing ${transactionsData.length} transactions...`);

  const uncategorizedId = categoryMap.get("Non catégorisé");
  if (!uncategorizedId) {
    throw new Error("Missing 'Non catégorisé' category");
  }

  let imported = 0;
  let amexCount = 0;

  for (const tx of transactionsData) {
    const catName = tx.category || null;
    const subName = tx.subcategory || null;

    let categoryId = uncategorizedId;
    let subCategoryId: string | undefined = undefined;

    if (catName && categoryMap.has(catName)) {
      categoryId = categoryMap.get(catName)!;
      if (subName) {
        const subKey = `${catName}|${subName}`;
        if (subCategoryMap.has(subKey)) {
          subCategoryId = subCategoryMap.get(subKey);
        }
      }
    }

    let status: "PENDING" | "COMPLETED" | "CANCELLED" = "PENDING";
    if (tx.status === "COMPLETED") status = "COMPLETED";
    else if (tx.status === "CANCELLED") status = "CANCELLED";

    let label = tx.label;
    let isAmex = false;

    if (tx.label.startsWith("AMEX ")) {
      isAmex = true;
      label = tx.label.slice(5);
      amexCount++;
    }

    await db.insert(s.transactions).values({
      id: createId(),
      userId: importUserId,
      label,
      amount: tx.amount.toString(),
      date: tx.date ? new Date(tx.date) : null,
      month: tx.month,
      year: tx.year,
      status,
      accountId: accountIds.bnpId,
      categoryId,
      subCategoryId: subCategoryId ?? null,
      note: status === "CANCELLED" ? "Annulé dans Excel" : null,
      isAmex,
    });

    imported++;
    if (imported % 2000 === 0) {
      console.log(`  ${imported}/${transactionsData.length} transactions imported...`);
    }
  }

  console.log(`  Done: ${imported} imported (${amexCount} AMEX).`);
}

async function recomputeAllMonthlyBalances() {
  console.log("Recomputing MonthlyBalance for all months...");

  const distinctMonths = await db
    .selectDistinct({ year: s.transactions.year, month: s.transactions.month })
    .from(s.transactions)
    .orderBy(s.transactions.year, s.transactions.month);

  for (const { year, month } of distinctMonths) {
    const [forecastResult] = await db
      .select({ total: sql<string>`coalesce(sum(${s.transactions.amount}), 0)` })
      .from(s.transactions)
      .where(and(eq(s.transactions.year, year), eq(s.transactions.month, month), inArray(s.transactions.status, ["COMPLETED", "PENDING"])));
    const totalForecast = toNumber(forecastResult.total);

    const spentByCategory = await db
      .select({ categoryId: s.transactions.categoryId, total: sql<string>`coalesce(sum(${s.transactions.amount}), 0)` })
      .from(s.transactions)
      .where(and(eq(s.transactions.year, year), eq(s.transactions.month, month), inArray(s.transactions.status, ["COMPLETED", "PENDING"]), sql`${s.transactions.amount} < 0`))
      .groupBy(s.transactions.categoryId);

    const budgetsResult = await db.query.budgets.findMany({
      where: and(eq(s.budgets.year, year), eq(s.budgets.month, month)),
    });

    const budgetMap = new Map<string, number>((budgetsResult as { categoryId: string; amount: string | number }[]).map((b) => [b.categoryId, toNumber(b.amount)]));
    const spentMap = new Map<string, number>(
      spentByCategory.map((sp: { categoryId: string | null; total: string }) => [sp.categoryId ?? "", Math.abs(toNumber(sp.total))])
    );

    const allCategoryIds = new Set<string>([...budgetMap.keys(), ...spentMap.keys()]);
    let totalCommitted = 0;
    for (const id of allCategoryIds) {
      const budgeted = budgetMap.get(id) ?? 0;
      const spent = spentMap.get(id) ?? 0;
      totalCommitted += Math.max(0, budgeted - spent);
    }

    const surplus = totalForecast - totalCommitted;

    const existingMb = await db.query.monthlyBalances.findFirst({
      where: and(eq(s.monthlyBalances.year, year), eq(s.monthlyBalances.month, month)),
    });

    if (existingMb) {
      await db.update(s.monthlyBalances).set({
        forecast: totalForecast.toString(),
        committed: totalCommitted.toString(),
        surplus: surplus.toString(),
      }).where(eq(s.monthlyBalances.id, existingMb.id));
    } else {
      await db.insert(s.monthlyBalances).values({
        id: createId(),
        userId: importUserId,
        year, month,
        forecast: totalForecast.toString(),
        committed: totalCommitted.toString(),
        surplus: surplus.toString(),
      });
    }
  }

  console.log(`  Computed ${distinctMonths.length} monthly balances.`);
}

async function main() {
  console.log("=== Starting data import ===\n");

  const categoriesFile = readJSON<CategoryData[]>("categories.json");
  const transactionsFile = readJSON<TransactionData[]>("transactions-bnp.json");
  console.log(`Loaded: ${categoriesFile.length} categories, ${transactionsFile.length} transactions\n`);

  await clearDatabase();
  const accountIds = await createUserAndAccounts();
  const { categoryMap, subCategoryMap } = await importCategories(categoriesFile);
  await importTransactions(transactionsFile, accountIds, categoryMap, subCategoryMap);
  await recomputeAllMonthlyBalances();

  console.log("\n=== Import complete ===");
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
