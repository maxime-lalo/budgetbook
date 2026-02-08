/**
 * Import extracted JSON data into the database via Prisma.
 * Only imports BNP account transactions and categories.
 *
 * Usage: pnpm db:import
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
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

async function clearDatabase() {
  console.log("Clearing database...");
  // Order matters: respect FK constraints
  await prisma.monthlyBalance.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.subCategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.bucket.deleteMany();
  await prisma.account.deleteMany();
  console.log("  All tables cleared.");
}

async function createAccounts() {
  console.log("Creating accounts...");

  const bnp = await prisma.account.create({
    data: {
      id: "bnp-checking",
      name: "BNP",
      type: "CHECKING",
      color: "#4f46e5",
      icon: "Wallet",
      sortOrder: 0,
    },
  });

  const livretA = await prisma.account.create({
    data: {
      id: "livret-a",
      name: "Livret A",
      type: "SAVINGS",
      color: "#10b981",
      icon: "PiggyBank",
      sortOrder: 1,
    },
  });

  console.log(`  Created accounts: ${bnp.name}, ${livretA.name}`);
  return { bnpId: bnp.id, livretAId: livretA.id };
}

async function importCategories(categoriesData: CategoryData[]) {
  console.log(`Importing ${categoriesData.length} categories...`);

  const categoryMap = new Map<string, string>(); // name → id
  const subCategoryMap = new Map<string, string>(); // "cat|sub" → id

  for (let i = 0; i < categoriesData.length; i++) {
    const cat = categoriesData[i];
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        color: cat.color,
        sortOrder: i,
      },
    });
    categoryMap.set(cat.name, created.id);

    for (let j = 0; j < cat.subcategories.length; j++) {
      const subName = cat.subcategories[j];
      const sub = await prisma.subCategory.create({
        data: {
          name: subName,
          categoryId: created.id,
          sortOrder: j,
        },
      });
      subCategoryMap.set(`${cat.name}|${subName}`, sub.id);
    }
  }

  console.log(`  ${categoryMap.size} categories, ${subCategoryMap.size} subcategories created.`);
  return { categoryMap, subCategoryMap };
}

async function importTransactions(
  transactions: TransactionData[],
  accountIds: { bnpId: string; livretAId: string },
  categoryMap: Map<string, string>,
  subCategoryMap: Map<string, string>
) {
  console.log(`Importing ${transactions.length} transactions...`);

  const uncategorizedId = categoryMap.get("Non catégorisé");
  if (!uncategorizedId) {
    throw new Error("Missing 'Non catégorisé' category");
  }

  let imported = 0;
  let amexCount = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    const data: Prisma.TransactionCreateManyInput[] = [];

    for (const tx of batch) {
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

      // Determine label and isAmex flag
      let label = tx.label;
      let isAmex = false;

      // AMEX: transactions whose label starts with "AMEX "
      if (tx.label.startsWith("AMEX ")) {
        isAmex = true;
        label = tx.label.slice(5); // Remove "AMEX " prefix
        amexCount++;
      }

      const txData: Prisma.TransactionCreateManyInput = {
        label,
        amount: new Prisma.Decimal(tx.amount),
        date: tx.date ? new Date(tx.date) : null,
        month: tx.month,
        year: tx.year,
        status,
        accountId: accountIds.bnpId,
        categoryId,
        subCategoryId,
        note: status === "CANCELLED" ? "Annulé dans Excel" : undefined,
        isAmex,
      };

      data.push(txData);
    }

    await prisma.transaction.createMany({ data });
    imported += data.length;

    if (imported % 2000 === 0 || i + BATCH_SIZE >= transactions.length) {
      console.log(`  ${imported}/${transactions.length} transactions imported...`);
    }
  }

  console.log(`  Done: ${imported} imported (${amexCount} AMEX).`);
}

async function recomputeAllMonthlyBalances() {
  console.log("Recomputing MonthlyBalance for all months...");

  const distinctMonths = await prisma.transaction.findMany({
    select: { year: true, month: true },
    distinct: ["year", "month"],
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  for (const { year, month } of distinctMonths) {
    const forecast = await prisma.transaction.aggregate({
      where: { year, month, status: { in: ["COMPLETED", "PENDING"] } },
      _sum: { amount: true },
    });

    const totalForecast = forecast._sum.amount?.toNumber() ?? 0;

    const spentByCategory = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { year, month, status: { in: ["COMPLETED", "PENDING"] }, amount: { lt: 0 } },
      _sum: { amount: true },
    });

    const budgets = await prisma.budget.findMany({ where: { year, month } });

    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount.toNumber()]));
    const spentMap = new Map(
      spentByCategory.map((s) => [s.categoryId, Math.abs(s._sum.amount?.toNumber() ?? 0)])
    );

    const allCategoryIds = new Set([...budgetMap.keys(), ...spentMap.keys()]);
    let totalCommitted = 0;
    for (const id of allCategoryIds) {
      const budgeted = budgetMap.get(id) ?? 0;
      const spent = spentMap.get(id) ?? 0;
      totalCommitted += Math.max(0, budgeted - spent);
    }

    const surplus = totalForecast - totalCommitted;

    await prisma.monthlyBalance.upsert({
      where: { year_month: { year, month } },
      update: {
        forecast: new Prisma.Decimal(totalForecast),
        committed: new Prisma.Decimal(totalCommitted),
        surplus: new Prisma.Decimal(surplus),
      },
      create: {
        year,
        month,
        forecast: new Prisma.Decimal(totalForecast),
        committed: new Prisma.Decimal(totalCommitted),
        surplus: new Prisma.Decimal(surplus),
      },
    });
  }

  console.log(`  Computed ${distinctMonths.length} monthly balances.`);
}

async function main() {
  console.log("=== Starting data import ===\n");

  // 1. Read JSON files
  const categories = readJSON<CategoryData[]>("categories.json");
  const transactions = readJSON<TransactionData[]>("transactions-bnp.json");
  console.log(`Loaded: ${categories.length} categories, ${transactions.length} transactions\n`);

  // 2. Clear existing data
  await clearDatabase();

  // 3. Create accounts
  const accountIds = await createAccounts();

  // 4. Import categories
  const { categoryMap, subCategoryMap } = await importCategories(categories);

  // 5. Import transactions
  await importTransactions(transactions, accountIds, categoryMap, subCategoryMap);

  // 6. Recompute MonthlyBalance
  await recomputeAllMonthlyBalances();

  // 7. Summary
  const txCount = await prisma.transaction.count();
  const catCount = await prisma.category.count();
  const subCount = await prisma.subCategory.count();
  const balCount = await prisma.monthlyBalance.count();
  const accCount = await prisma.account.count();

  const txByAccount = await prisma.transaction.groupBy({
    by: ["accountId"],
    _count: true,
  });

  console.log("\n=== Import complete ===");
  console.log(`  Accounts: ${accCount}`);
  for (const entry of txByAccount) {
    console.log(`    ${entry.accountId}: ${entry._count} transactions`);
  }
  console.log(`  Categories: ${catCount}`);
  console.log(`  SubCategories: ${subCount}`);
  console.log(`  Transactions: ${txCount}`);
  console.log(`  MonthlyBalances: ${balCount}`);
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
