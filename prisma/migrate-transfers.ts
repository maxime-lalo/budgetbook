import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  if (DRY_RUN) {
    console.log("=== DRY RUN — aucune modification ne sera effectuée ===\n");
  }

  // 1. Trouver le premier compte CHECKING
  const checking = await prisma.account.findFirst({
    where: { type: "CHECKING" },
    orderBy: { sortOrder: "asc" },
  });

  if (!checking) {
    console.error("Aucun compte CHECKING trouvé. Migration annulée.");
    return;
  }
  console.log(`Compte courant source : ${checking.name} (${checking.id})`);

  // 2. Trouver tous les comptes SAVINGS/INVESTMENT
  const savingsAccounts = await prisma.account.findMany({
    where: { type: { in: ["SAVINGS", "INVESTMENT"] } },
  });

  if (savingsAccounts.length === 0) {
    console.log("Aucun compte épargne/investissement trouvé. Rien à migrer.");
    return;
  }

  const savingsIds = savingsAccounts.map((a) => a.id);
  console.log(`Comptes épargne/investissement : ${savingsAccounts.map((a) => a.name).join(", ")}\n`);

  // 3. Trouver toutes les transactions sur ces comptes
  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: { in: savingsIds },
      destinationAccountId: null, // Ne pas re-migrer
    },
    include: { account: true },
  });

  console.log(`${transactions.length} transactions trouvées sur les comptes épargne.\n`);

  let migratedCount = 0;
  let standaloneCount = 0;

  for (const t of transactions) {
    if (t.amount.toNumber() < 0) {
      // Montant négatif sur compte épargne = dépôt (convention actuelle)
      // → Transformer en virement : source = checking, destination = ancien account
      console.log(
        `[MIGRER] "${t.label}" ${t.amount.toNumber()}€ sur ${t.account.name} → ` +
        `accountId=${checking.id}, destinationAccountId=${t.accountId}`
      );

      if (!DRY_RUN) {
        await prisma.transaction.update({
          where: { id: t.id },
          data: {
            accountId: checking.id,
            destinationAccountId: t.accountId,
          },
        });
      }
      migratedCount++;
    } else {
      // Montant positif = standalone (intérêts, ajustements, etc.)
      console.log(
        `[STANDALONE] "${t.label}" +${t.amount.toNumber()}€ sur ${t.account.name} — pas de modification`
      );
      standaloneCount++;
    }
  }

  console.log(`\n=== Résumé ===`);
  console.log(`Migrées en virements : ${migratedCount}`);
  console.log(`Standalone conservées : ${standaloneCount}`);

  if (!DRY_RUN && migratedCount > 0) {
    console.log("\nRecalcul des soldes mensuels...");
    const distinctMonths = await prisma.transaction.findMany({
      select: { year: true, month: true },
      distinct: ["year", "month"],
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });

    for (const { year, month } of distinctMonths) {
      const forecast = await prisma.transaction.aggregate({
        where: {
          year,
          month,
          status: { in: ["COMPLETED", "PENDING"] },
          destinationAccountId: null,
        },
        _sum: { amount: true },
      });
      const totalForecast = forecast._sum.amount?.toNumber() ?? 0;

      const spentByCategory = await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          year,
          month,
          status: { in: ["COMPLETED", "PENDING"] },
          amount: { lt: 0 },
          destinationAccountId: null,
        },
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
        update: { forecast: totalForecast, committed: totalCommitted, surplus },
        create: { year, month, forecast: totalForecast, committed: totalCommitted, surplus },
      });
    }
    console.log("Soldes mensuels recalculés.");
  }

  if (DRY_RUN) {
    console.log("\n=== Pour appliquer réellement, relancer sans --dry-run ===");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
