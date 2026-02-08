import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Catégories avec sous-catégories
  const categories = [
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

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: { color: cat.color, icon: cat.icon, sortOrder: i },
      create: { name: cat.name, color: cat.color, icon: cat.icon, sortOrder: i },
    });

    for (let j = 0; j < cat.subs.length; j++) {
      await prisma.subCategory.upsert({
        where: { categoryId_name: { categoryId: created.id, name: cat.subs[j] } },
        update: { sortOrder: j },
        create: { name: cat.subs[j], categoryId: created.id, sortOrder: j },
      });
    }
  }

  // Comptes
  const checking = await prisma.account.upsert({
    where: { id: "checking-main" },
    update: {},
    create: {
      id: "checking-main",
      name: "Compte Courant",
      type: "CHECKING",
      color: "#3b82f6",
      icon: "Wallet",
      sortOrder: 0,
    },
  });

  await prisma.account.upsert({
    where: { id: "credit-amex" },
    update: {},
    create: {
      id: "credit-amex",
      name: "AMEX",
      type: "CREDIT_CARD",
      color: "#6366f1",
      icon: "CreditCard",
      sortOrder: 1,
      linkedAccountId: checking.id,
    },
  });

  const savings = await prisma.account.upsert({
    where: { id: "savings-main" },
    update: {},
    create: {
      id: "savings-main",
      name: "Livret A",
      type: "SAVINGS",
      color: "#10b981",
      icon: "PiggyBank",
      sortOrder: 2,
    },
  });

  // Buckets pour le compte épargne
  await prisma.bucket.upsert({
    where: { id: "bucket-emergency" },
    update: {},
    create: {
      id: "bucket-emergency",
      name: "Fonds d'urgence",
      accountId: savings.id,
      color: "#ef4444",
      goal: 10000,
      sortOrder: 0,
    },
  });

  await prisma.bucket.upsert({
    where: { id: "bucket-travel" },
    update: {},
    create: {
      id: "bucket-travel",
      name: "Voyages",
      accountId: savings.id,
      color: "#f59e0b",
      goal: 3000,
      sortOrder: 1,
    },
  });

  // Transactions de démonstration
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const month = currentMonth + 1; // 1-indexed pour le champ month

  const catMap = await prisma.category.findMany({ include: { subCategories: true } });
  const getCatId = (name: string) => catMap.find((c) => c.name === name)!.id;
  const getSubId = (catName: string, subName: string) =>
    catMap.find((c) => c.name === catName)!.subCategories.find((s) => s.name === subName)!.id;

  // Transactions avec date
  const sampleTransactions = [
    { label: "Salaire", amount: 3200, date: new Date(currentYear, currentMonth, 1), month, year: currentYear, status: "COMPLETED" as const, accountId: checking.id, categoryId: getCatId("Revenus"), subCategoryId: getSubId("Revenus", "Salaire") },
    { label: "Courses Carrefour", amount: -87.5, date: new Date(currentYear, currentMonth, 8), month, year: currentYear, status: "COMPLETED" as const, accountId: checking.id, categoryId: getCatId("Alimentation"), subCategoryId: getSubId("Alimentation", "Courses") },
    { label: "Restaurant", amount: -45, date: new Date(currentYear, currentMonth, 10), month, year: currentYear, status: "COMPLETED" as const, accountId: "credit-amex", categoryId: getCatId("Alimentation"), subCategoryId: getSubId("Alimentation", "Restaurant") },
    { label: "Essence", amount: -65, date: new Date(currentYear, currentMonth, 12), month, year: currentYear, status: "COMPLETED" as const, accountId: checking.id, categoryId: getCatId("Transport"), subCategoryId: getSubId("Transport", "Essence") },
    { label: "Virement épargne", amount: -500, date: new Date(currentYear, currentMonth, 2), month, year: currentYear, status: "COMPLETED" as const, accountId: checking.id, categoryId: getCatId("Épargne"), subCategoryId: getSubId("Épargne", "Livret A") },
    { label: "Virement épargne reçu", amount: 500, date: new Date(currentYear, currentMonth, 2), month, year: currentYear, status: "COMPLETED" as const, accountId: savings.id, categoryId: getCatId("Épargne"), subCategoryId: getSubId("Épargne", "Livret A"), bucketId: "bucket-emergency" },
    { label: "Assurance auto", amount: -75, date: new Date(currentYear, currentMonth, 20), month, year: currentYear, status: "PENDING" as const, accountId: checking.id, categoryId: getCatId("Transport"), subCategoryId: getSubId("Transport", "Entretien véhicule") },
    { label: "Prime trimestrielle", amount: 800, date: new Date(currentYear, currentMonth, 25), month, year: currentYear, status: "PENDING" as const, accountId: checking.id, categoryId: getCatId("Revenus"), subCategoryId: getSubId("Revenus", "Prime") },
  ];

  // Transactions récurrentes (sans date)
  const recurringTransactions = [
    { label: "Loyer", amount: -850, date: null, month, year: currentYear, status: "COMPLETED" as const, accountId: checking.id, categoryId: getCatId("Logement"), subCategoryId: getSubId("Logement", "Loyer") },
    { label: "Netflix", amount: -17.99, date: null, month, year: currentYear, status: "COMPLETED" as const, accountId: checking.id, categoryId: getCatId("Abonnements"), subCategoryId: getSubId("Abonnements", "Streaming") },
  ];

  for (const t of [...sampleTransactions, ...recurringTransactions]) {
    await prisma.transaction.create({ data: t });
  }

  // Budgets pour le mois courant
  const budgets = [
    { categoryId: getCatId("Logement"), amount: 900 },
    { categoryId: getCatId("Alimentation"), amount: 400 },
    { categoryId: getCatId("Transport"), amount: 200 },
    { categoryId: getCatId("Loisirs"), amount: 150 },
    { categoryId: getCatId("Shopping"), amount: 100 },
    { categoryId: getCatId("Abonnements"), amount: 80 },
    { categoryId: getCatId("Santé"), amount: 50 },
  ];

  for (const b of budgets) {
    await prisma.budget.upsert({
      where: {
        categoryId_year_month: {
          categoryId: b.categoryId,
          year: currentYear,
          month,
        },
      },
      update: { amount: b.amount },
      create: {
        ...b,
        year: currentYear,
        month,
      },
    });
  }

  // Backfill MonthlyBalance
  const distinctMonths = await prisma.transaction.findMany({
    select: { year: true, month: true },
    distinct: ["year", "month"],
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  for (const { year: y, month: m } of distinctMonths) {
    const forecast = await prisma.transaction.aggregate({
      where: { year: y, month: m, status: { in: ["COMPLETED", "PENDING"] } },
      _sum: { amount: true },
    });
    const totalForecast = forecast._sum.amount?.toNumber() ?? 0;

    const spentByCategory = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { year: y, month: m, status: { in: ["COMPLETED", "PENDING"] }, amount: { lt: 0 } },
      _sum: { amount: true },
    });

    const monthBudgets = await prisma.budget.findMany({ where: { year: y, month: m } });

    const budgetMap = new Map(monthBudgets.map((b) => [b.categoryId, b.amount.toNumber()]));
    const spentMap = new Map(
      spentByCategory.map((s) => [s.categoryId, Math.abs(s._sum.amount?.toNumber() ?? 0)])
    );

    const allCategoryIds = new Set([...budgetMap.keys(), ...spentMap.keys()]);
    let totalCommitted = 0;
    for (const id of allCategoryIds) {
      const budgeted = budgetMap.get(id) ?? 0;
      const spent = spentMap.get(id) ?? 0;
      totalCommitted += Math.max(budgeted, spent);
    }

    const surplus = totalForecast - totalCommitted;

    await prisma.monthlyBalance.upsert({
      where: { year_month: { year: y, month: m } },
      update: {
        forecast: new Prisma.Decimal(totalForecast),
        committed: new Prisma.Decimal(totalCommitted),
        surplus: new Prisma.Decimal(surplus),
      },
      create: {
        year: y,
        month: m,
        forecast: new Prisma.Decimal(totalForecast),
        committed: new Prisma.Decimal(totalCommitted),
        surplus: new Prisma.Decimal(surplus),
      },
    });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
