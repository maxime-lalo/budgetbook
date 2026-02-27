import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, inArray, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { hash } from "bcryptjs";
import * as pgSchema from "./schema/pg";
import { toNumber } from "./helpers";
import { logger } from "@/lib/logger";

function createDb() {
  const connectionString = process.env.DATABASE_URL ?? "postgresql://comptes:comptes@localhost:5432/comptes";
  const client = postgres(connectionString);
  return drizzle(client, { schema: pgSchema });
}

const db = createDb();
const s = pgSchema;

async function main() {
  // Vider la base de données (ordre respectant les FK)
  await db.delete(s.monthlyBalances);
  await db.delete(s.budgets);
  await db.delete(s.transactions);
  await db.delete(s.subCategories);
  await db.delete(s.categories);
  await db.delete(s.buckets);
  await db.delete(s.accounts);
  await db.delete(s.refreshTokens);
  await db.delete(s.users);

  // Créer un utilisateur admin par défaut
  const adminId = createId();
  const adminPassword = await hash("admin", 12);
  await db.insert(s.users).values({
    id: adminId,
    email: "admin@comptes.local",
    name: "Admin",
    passwordHash: adminPassword,
    authProvider: "local",
    isAdmin: true,
  });
  const userId = adminId;
  logger.info("Admin user created: admin@comptes.local / admin");

  // Catégories avec sous-catégories
  const categoriesData = [
    { name: "Logement", color: "#6366f1", icon: "Home", subs: ["Loyer", "Charges", "Assurance habitation", "Travaux"] },
    { name: "Alimentation", color: "#22c55e", icon: "ShoppingCart", subs: ["Courses", "Restaurant", "Livraison"] },
    { name: "Transport", color: "#f59e0b", icon: "Car", subs: ["Essence", "Transports en commun", "Parking", "Péage", "Entretien véhicule"] },
    { name: "Santé", color: "#ef4444", icon: "Heart", subs: ["Médecin", "Pharmacie", "Mutuelle"] },
    { name: "Loisirs", color: "#8b5cf6", icon: "Gamepad2", subs: ["Sorties", "Sport", "Vacances", "Culture"] },
    { name: "Shopping", color: "#ec4899", icon: "ShoppingBag", subs: ["Vêtements", "Électronique", "Maison"] },
    { name: "Abonnements", color: "#06b6d4", icon: "Repeat", subs: ["Streaming", "Téléphone", "Internet", "Presse"] },
    { name: "Éducation", color: "#14b8a6", icon: "GraduationCap", subs: ["Formation", "Livres"] },
    { name: "Impôts & Taxes", color: "#64748b", icon: "Landmark", subs: ["Impôt sur le revenu", "Taxe foncière", "Taxe habitation"] },
    { name: "Épargne", color: "#10b981", icon: "PiggyBank", subs: ["Livret A", "Assurance vie", "PEA", "Crypto"] },
    { name: "Revenus", color: "#059669", icon: "Banknote", subs: ["Salaire", "Prime", "Freelance", "Dividendes"] },
    { name: "Remboursements", color: "#0ea5e9", icon: "RotateCcw", subs: ["Sécurité sociale", "Mutuelle", "Employeur"] },
    { name: "Cadeaux", color: "#f43f5e", icon: "Gift", subs: ["Offerts", "Reçus"] },
    { name: "Divers", color: "#78716c", icon: "MoreHorizontal", subs: ["Frais bancaires", "Autre"] },
  ];

  const catIdMap = new Map<string, string>();

  for (let i = 0; i < categoriesData.length; i++) {
    const cat = categoriesData[i];
    const existing = await db.query.categories.findFirst({
      where: eq(s.categories.name, cat.name),
    });

    let catId: string;
    if (existing) {
      catId = existing.id;
      await db.update(s.categories).set({ color: cat.color, icon: cat.icon, sortOrder: i }).where(eq(s.categories.id, catId));
    } else {
      catId = createId();
      await db.insert(s.categories).values({ id: catId, userId, name: cat.name, color: cat.color, icon: cat.icon, sortOrder: i });
    }
    catIdMap.set(cat.name, catId);

    for (let j = 0; j < cat.subs.length; j++) {
      const existingSub = await db.query.subCategories.findFirst({
        where: and(eq(s.subCategories.categoryId, catId), eq(s.subCategories.name, cat.subs[j])),
      });
      if (existingSub) {
        await db.update(s.subCategories).set({ sortOrder: j }).where(eq(s.subCategories.id, existingSub.id));
      } else {
        await db.insert(s.subCategories).values({ id: createId(), userId, name: cat.subs[j], categoryId: catId, sortOrder: j });
      }
    }
  }

  // Comptes
  const existingChecking = await db.query.accounts.findFirst({ where: eq(s.accounts.id, "checking-main") });
  if (!existingChecking) {
    await db.insert(s.accounts).values({
      id: "checking-main", userId, name: "Compte Courant", type: "CHECKING", color: "#3b82f6", icon: "Wallet", sortOrder: 0,
    });
  }

  const existingSavings = await db.query.accounts.findFirst({ where: eq(s.accounts.id, "savings-main") });
  if (!existingSavings) {
    await db.insert(s.accounts).values({
      id: "savings-main", userId, name: "Livret A", type: "SAVINGS", color: "#10b981", icon: "PiggyBank", sortOrder: 1,
    });
  }

  // Buckets
  const existingBucket1 = await db.query.buckets.findFirst({ where: eq(s.buckets.id, "bucket-emergency") });
  if (!existingBucket1) {
    await db.insert(s.buckets).values({
      id: "bucket-emergency", name: "Fonds d'urgence", accountId: "savings-main",
      color: "#ef4444", goal: "10000", sortOrder: 0,
    });
  }

  const existingBucket2 = await db.query.buckets.findFirst({ where: eq(s.buckets.id, "bucket-travel") });
  if (!existingBucket2) {
    await db.insert(s.buckets).values({
      id: "bucket-travel", name: "Voyages", accountId: "savings-main",
      color: "#f59e0b", goal: "3000", sortOrder: 1,
    });
  }

  // Transactions de démonstration
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const month = currentMonth + 1;

  const allCats = await db.query.categories.findMany({ with: { subCategories: true } });
  const getCatId = (name: string) => (allCats as { name: string; id: string }[]).find((c) => c.name === name)!.id;
  const getSubId = (catName: string, subName: string) => {
    const cat = (allCats as { name: string; subCategories: { name: string; id: string }[] }[]).find((c) => c.name === catName)!;
    return cat.subCategories.find((s) => s.name === subName)!.id;
  };

  const sampleTransactions = [
    { label: "Salaire", amount: "3200", date: new Date(currentYear, currentMonth, 1), month, year: currentYear, status: "COMPLETED" as const, accountId: "checking-main", categoryId: getCatId("Revenus"), subCategoryId: getSubId("Revenus", "Salaire") },
    { label: "Courses Carrefour", amount: "-87.5", date: new Date(currentYear, currentMonth, 8), month, year: currentYear, status: "COMPLETED" as const, accountId: "checking-main", categoryId: getCatId("Alimentation"), subCategoryId: getSubId("Alimentation", "Courses") },
    { label: "Restaurant", amount: "-45", date: new Date(currentYear, currentMonth, 10), month, year: currentYear, status: "COMPLETED" as const, accountId: "checking-main", categoryId: getCatId("Alimentation"), subCategoryId: getSubId("Alimentation", "Restaurant"), isAmex: true },
    { label: "Essence", amount: "-65", date: new Date(currentYear, currentMonth, 12), month, year: currentYear, status: "COMPLETED" as const, accountId: "checking-main", categoryId: getCatId("Transport"), subCategoryId: getSubId("Transport", "Essence") },
    { label: "Virement épargne", amount: "-500", date: new Date(currentYear, currentMonth, 2), month, year: currentYear, status: "COMPLETED" as const, accountId: "checking-main", categoryId: getCatId("Épargne"), subCategoryId: getSubId("Épargne", "Livret A"), destinationAccountId: "savings-main", bucketId: "bucket-emergency" },
    { label: "Assurance auto", amount: "-75", date: new Date(currentYear, currentMonth, 20), month, year: currentYear, status: "PENDING" as const, accountId: "checking-main", categoryId: getCatId("Transport"), subCategoryId: getSubId("Transport", "Entretien véhicule") },
    { label: "Prime trimestrielle", amount: "800", date: new Date(currentYear, currentMonth, 25), month, year: currentYear, status: "PENDING" as const, accountId: "checking-main", categoryId: getCatId("Revenus"), subCategoryId: getSubId("Revenus", "Prime") },
  ];

  const recurringTransactions = [
    { label: "Loyer", amount: "-850", date: null, recurring: true, month, year: currentYear, status: "COMPLETED" as const, accountId: "checking-main", categoryId: getCatId("Logement"), subCategoryId: getSubId("Logement", "Loyer") },
    { label: "Netflix", amount: "-17.99", date: null, recurring: true, month, year: currentYear, status: "COMPLETED" as const, accountId: "checking-main", categoryId: getCatId("Abonnements"), subCategoryId: getSubId("Abonnements", "Streaming") },
  ];

  for (const t of [...sampleTransactions, ...recurringTransactions]) {
    await db.insert(s.transactions).values({ id: createId(), userId, ...t });
  }

  // Budgets pour le mois courant
  const budgetsData = [
    { categoryId: getCatId("Logement"), amount: "900" },
    { categoryId: getCatId("Alimentation"), amount: "400" },
    { categoryId: getCatId("Transport"), amount: "200" },
    { categoryId: getCatId("Loisirs"), amount: "150" },
    { categoryId: getCatId("Shopping"), amount: "100" },
    { categoryId: getCatId("Abonnements"), amount: "80" },
    { categoryId: getCatId("Santé"), amount: "50" },
  ];

  for (const b of budgetsData) {
    const existing = await db.query.budgets.findFirst({
      where: and(eq(s.budgets.categoryId, b.categoryId), eq(s.budgets.year, currentYear), eq(s.budgets.month, month)),
    });
    if (existing) {
      await db.update(s.budgets).set({ amount: b.amount }).where(eq(s.budgets.id, existing.id));
    } else {
      await db.insert(s.budgets).values({ id: createId(), userId, ...b, year: currentYear, month });
    }
  }

  // Backfill MonthlyBalance
  const distinctMonths = await db
    .selectDistinct({ year: s.transactions.year, month: s.transactions.month })
    .from(s.transactions)
    .orderBy(s.transactions.year, s.transactions.month);

  for (const { year: y, month: m } of distinctMonths) {
    const [forecastResult] = await db
      .select({ total: sql<string>`coalesce(sum(${s.transactions.amount}), 0)` })
      .from(s.transactions)
      .where(and(eq(s.transactions.year, y), eq(s.transactions.month, m), inArray(s.transactions.status, ["COMPLETED", "PENDING"])));
    const totalForecast = toNumber(forecastResult.total);

    const spentByCategory = await db
      .select({ categoryId: s.transactions.categoryId, total: sql<string>`coalesce(sum(${s.transactions.amount}), 0)` })
      .from(s.transactions)
      .where(and(eq(s.transactions.year, y), eq(s.transactions.month, m), inArray(s.transactions.status, ["COMPLETED", "PENDING"]), sql`${s.transactions.amount} < 0`))
      .groupBy(s.transactions.categoryId);

    const monthBudgets = await db.query.budgets.findMany({
      where: and(eq(s.budgets.year, y), eq(s.budgets.month, m)),
    });

    const budgetMap = new Map<string, number>(
      (monthBudgets as { categoryId: string; amount: string | number }[]).map((b) => [b.categoryId, toNumber(b.amount)])
    );
    const spentMap = new Map<string, number>(
      spentByCategory.map((sp: { categoryId: string | null; total: string }) => [sp.categoryId ?? "", Math.abs(toNumber(sp.total))])
    );

    const allCategoryIds = new Set([...budgetMap.keys(), ...spentMap.keys()]);
    let totalCommitted = 0;
    for (const id of allCategoryIds) {
      const budgeted = budgetMap.get(id) ?? 0;
      const spent = spentMap.get(id) ?? 0;
      totalCommitted += Math.max(budgeted, spent);
    }

    const surplus = totalForecast - totalCommitted;

    const existingMb = await db.query.monthlyBalances.findFirst({
      where: and(eq(s.monthlyBalances.year, y), eq(s.monthlyBalances.month, m)),
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
        userId,
        year: y,
        month: m,
        forecast: totalForecast.toString(),
        committed: totalCommitted.toString(),
        surplus: surplus.toString(),
      });
    }
  }

  // AppPreferences pour l'admin
  await db.insert(s.appPreferences).values({ id: createId(), userId, amexEnabled: true });

  logger.info("Seed completed successfully!");
}

main()
  .catch((e) => {
    logger.error("Seed failed", { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
