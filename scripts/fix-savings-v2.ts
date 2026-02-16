import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const CAT_ECO = 'cmleb3stu0013v5v482ldxpzp';
const CHECKING = 'bnp-checking';
const LIVRET = 'livret-a';
const BUCKET_ECO = 'cmled5tw4003cv5b1qndssuvl';

// Crée une transaction virement checking → livret (montant négatif côté checking)
// ou livret → checking (montant positif côté checking, inversé pour la convention)
function txData(label: string, amount: number, month: number, year: number, status: 'COMPLETED' | 'PENDING' = 'COMPLETED') {
  // amount est du point de vue du LIVRET (positif = argent entrant, négatif = retrait)
  // Convention DB : amount négatif = sort du compte source
  if (amount >= 0) {
    // Argent vers le livret : checking → livret, montant négatif (sort du checking)
    return {
      label, amount: new Prisma.Decimal(-amount),
      date: null as Date | null, month, year, status,
      accountId: CHECKING, destinationAccountId: LIVRET,
      categoryId: CAT_ECO, bucketId: BUCKET_ECO,
      isAmex: false, note: null as string | null,
      subCategoryId: null as string | null,
    };
  } else {
    // Retrait du livret : livret → checking, montant négatif (sort du livret)
    return {
      label, amount: new Prisma.Decimal(amount), // déjà négatif
      date: null as Date | null, month, year, status,
      accountId: LIVRET, destinationAccountId: CHECKING,
      categoryId: CAT_ECO, bucketId: BUCKET_ECO,
      isAmex: false, note: null as string | null,
      subCategoryId: null as string | null,
    };
  }
}

async function rebuildYear(year: number, entries: { label: string; amount: number; month: number; status?: 'PENDING' }[]) {
  // Supprimer toutes les tx Economies de cette année
  const deleted = await prisma.transaction.deleteMany({
    where: { year, categoryId: CAT_ECO },
  });
  console.log(`  Supprimé ${deleted.count} anciennes transactions`);

  // Recréer depuis l'Excel
  let created = 0;
  for (const e of entries) {
    if (e.amount === 0) continue; // skip les 0
    await prisma.transaction.create({
      data: txData(e.label, e.amount, e.month, year, e.status === 'PENDING' ? 'PENDING' : 'COMPLETED'),
    });
    created++;
  }
  console.log(`  Créé ${created} transactions`);

  // Vérifier le total
  const txs = await prisma.transaction.findMany({
    where: { year, categoryId: CAT_ECO, status: { not: 'CANCELLED' } },
  });
  const net = txs.reduce((s, t) => {
    // Calculer le net du point de vue du livret
    if (t.destinationAccountId === LIVRET) return s + (-t.amount.toNumber()); // crédit livret
    if (t.accountId === LIVRET) return s + t.amount.toNumber(); // débit livret (négatif)
    return s;
  }, 0);
  console.log(`  Net livret ${year}: ${net.toFixed(2)}`);
}

async function main() {
  // ============================================================
  // ANNÉE 2020 — Reconstruction complète depuis l'Excel Livret A
  // Excel net LA = -600
  // ============================================================
  console.log('\n=== 2020 (reconstruction) ===');
  await rebuildYear(2020, [
    // Livret A seulement (pas de Livret Jeune)
    { label: 'Espèces Noël', amount: 60, month: 1 },
    { label: 'Dépôt chèques Noël', amount: 140, month: 1 },
    { label: 'Galère Janvier', amount: -50, month: 1 },
    { label: 'Avance bouteilles Nicolas', amount: -210, month: 1 },
    { label: 'Galère Janvier', amount: -50, month: 1 },
    { label: 'Economies Février', amount: 500, month: 2 },
    { label: 'Remboursement Livret', amount: 100, month: 2 },
    { label: 'Prêt Camille', amount: -1280, month: 3 },
    { label: 'Remboursement Camille', amount: 1020.04, month: 4 },
    { label: 'Économies février', amount: 369.96, month: 3 },
    { label: 'Economies mars', amount: 600, month: 3 },
    { label: 'Frais inscription école', amount: -300, month: 4 },
    { label: 'Récupération Avril', amount: -200, month: 4 },
    { label: 'Écrans', amount: -500, month: 4 },
    { label: 'Economies Avril', amount: 500, month: 4 },
    { label: 'Economies Mai', amount: 500, month: 5 },
    { label: 'Economies Juin', amount: 200, month: 6 },
    { label: 'Airbnb', amount: -846, month: 7 },
    { label: 'Airbnb remboursement', amount: 46, month: 7 },
    { label: 'Galère août', amount: -100, month: 8 },
    { label: 'Galère août', amount: -50, month: 8 },
    { label: 'Économies août', amount: 1150, month: 8 },
    { label: 'Crypto + galère', amount: -600, month: 9 },
    { label: 'Galère', amount: -100, month: 9 },
    { label: 'ImagineR', amount: -350, month: 9 },
    { label: 'Économies Septembre', amount: 50, month: 10 },
    { label: 'Économies Novembre', amount: 500, month: 11 },
    { label: 'Économies Décembre', amount: 1094.87, month: 12 },
    { label: 'Intérêts', amount: 5.13, month: 12 },
    { label: 'Réservation Airbnb', amount: -1200, month: 7 },
    { label: 'Appart galère', amount: -1000, month: 8 },
    { label: 'Remboursement appart', amount: 1000, month: 8 },
    { label: 'Chaud juillet', amount: -400, month: 7 },
    { label: 'Chaud juillet', amount: -150, month: 7 },
    { label: 'Espagne', amount: -1200, month: 8 },
    { label: 'Equilibre', amount: 150, month: 9 },
  ]);

  // ============================================================
  // ANNÉE 2021 — L'Excel n'a AUCUNE entrée Livret A
  // Mais le JSON a 12 tx. Ces transactions n'ont pas de correspondance.
  // On les supprime.
  // ============================================================
  console.log('\n=== 2021 (suppression — pas dans Excel LA) ===');
  const del2021 = await prisma.transaction.deleteMany({
    where: { year: 2021, categoryId: CAT_ECO },
  });
  console.log(`  Supprimé ${del2021.count} transactions`);

  // ============================================================
  // ANNÉE 2019 — Reconstruction depuis l'Excel Livret A
  // Excel net LA = 800
  // ============================================================
  console.log('\n=== 2019 (reconstruction) ===');
  await rebuildYear(2019, [
    { label: 'Économies ouverture', amount: 50, month: 1 },
    { label: 'Économies Janvier', amount: 450, month: 1 },
    { label: 'Retrait saint valentin', amount: -100, month: 2 },
    { label: 'Économies Février', amount: 300, month: 2 },
    { label: 'Galère mars', amount: -75, month: 3 },
    { label: 'Économies Mars', amount: 425, month: 3 },
    { label: 'Économies Avril', amount: 350, month: 4 },
    { label: 'Commande ASOS mai', amount: -100, month: 5 },
    { label: 'Retrait galère mai', amount: -50, month: 5 },
    { label: 'Remboursement salle', amount: 200, month: 5 },
    { label: 'Retrait galère mai', amount: -50, month: 5 },
    { label: 'Retrait galère Mai', amount: -50, month: 5 },
    { label: 'Économies Mai', amount: 350, month: 5 },
    { label: 'Préparatifs Espagne', amount: -300, month: 6 },
    { label: 'Préparatifs Espagne 2', amount: -300, month: 6 },
    { label: 'Vacances Espagne', amount: -700, month: 7 },
    { label: 'Espagne', amount: -200, month: 7 },
    { label: 'Jambon Espagne', amount: -100, month: 7 },
    { label: 'Avance Camille', amount: -80, month: 7 },
    { label: 'Économies Juillet', amount: 380, month: 7 },
    { label: 'Galère Août', amount: -100, month: 8 },
    { label: 'Avance', amount: -100, month: 8 },
    { label: 'Economies Décembre', amount: 596.55, month: 12 },
    { label: 'Rémunération nette', amount: 3.45, month: 12 },
  ]);

  // ============================================================
  // ANNÉE 2022 — Reconstruction depuis l'Excel Livret A
  // Excel net LA = 1000
  // ============================================================
  console.log('\n=== 2022 (reconstruction) ===');
  await rebuildYear(2022, [
    { label: 'Economies Janvier', amount: 234.39, month: 1 },
    { label: 'Economies Mai', amount: 900, month: 5 },
    { label: 'Prime LCL', amount: 3200, month: 5 },
    { label: 'Matelas', amount: -550, month: 5 },
    { label: 'Léo + tatouage', amount: -250, month: 6 },
    { label: 'Voyage amsterdam', amount: -150, month: 6 },
    { label: 'Galère Juin', amount: -100, month: 6 },
    { label: 'Economies Juin', amount: 700, month: 6 },
    { label: 'Tel + galère', amount: -1050, month: 7 },
    { label: 'C la merde mdr', amount: -400, month: 7 },
    { label: 'New York', amount: -1500, month: 8 },
    { label: 'Economies Août', amount: 600, month: 8 },
    { label: 'BON', amount: -400, month: 9 },
    { label: 'ImagineR', amount: -200, month: 10 },
    { label: 'Economies Octobre', amount: 200, month: 10 },
  ]);

  // ============================================================
  // ANNÉE 2023 — Reconstruction depuis l'Excel Livret A
  // Excel net LA = -1000
  // ============================================================
  console.log('\n=== 2023 (reconstruction) ===');
  await rebuildYear(2023, [
    { label: 'Rémunération Livret A', amount: 11.59, month: 1 },
    { label: 'Economies Février', amount: 200, month: 2 },
    { label: 'Economies Mars', amount: 200, month: 3 },
    { label: 'Economies Septembre', amount: 190, month: 9 },
    { label: 'Economies Novembre', amount: 400, month: 11 },
    { label: 'Economies Décembre', amount: 190, month: 12 },
    { label: 'Janvier', amount: -400, month: 1 },
    { label: 'Mph', amount: -400, month: 1 },
    { label: 'Mph', amount: -200, month: 2 },
    { label: 'Carte graphique', amount: -150, month: 3 },
    { label: 'Remboursement Carte graphique', amount: 150, month: 3 },
    { label: 'Lunalogic', amount: 150, month: 4 },
    { label: 'Avance Mai', amount: -150, month: 5 },
    { label: 'Remboursement Avance Mai', amount: 100, month: 5 },
    { label: 'Avance Poêles/Psy', amount: -300, month: 6 },
    { label: 'Avance', amount: -100, month: 7 },
    { label: 'Avance', amount: -200, month: 7 },
    { label: 'Vacances', amount: -90, month: 8 },
    { label: "J'en ai marre", amount: -190, month: 9 },
    { label: 'imagineR', amount: -400, month: 11 },
  ]);

  // ============================================================
  // ANNÉE 2024 — Reconstruction depuis l'Excel Livret A
  // Excel net LA = 1000
  // ============================================================
  console.log('\n=== 2024 (reconstruction) ===');
  await rebuildYear(2024, [
    { label: 'Economies Janvier', amount: 136.06, month: 1 },
    { label: 'Economies Février', amount: 860, month: 2 },
    { label: 'Economies Juin', amount: 100, month: 6 },
    { label: 'Economies Août', amount: 1190, month: 8 },
    { label: 'Economies Octobre', amount: -200, month: 10 },
    { label: 'Economies Novembre', amount: 700, month: 11 },
    { label: 'Intérêts 2023', amount: 3.94, month: 1 },
    { label: 'Frigo', amount: -600, month: 2 },
    { label: 'Dentiste', amount: -200, month: 3 },
    { label: 'Meubles IKEA', amount: -300, month: 4 },
    { label: 'Ouverture Fortunéo', amount: 10, month: 5 },
    { label: 'Juillet', amount: -200, month: 7 },
    { label: 'Chats', amount: -500, month: 8 },
  ]);

  // ============================================================
  // ANNÉE 2025 — Reconstruction depuis l'Excel Livret A
  // Excel net LA = 50
  // ============================================================
  console.log('\n=== 2025 (reconstruction) ===');
  await rebuildYear(2025, [
    { label: 'Intérêts 2024', amount: 4.58, month: 1 },
    { label: 'Economies Janvier', amount: 395.42, month: 1 },
    { label: 'Ski', amount: -500, month: 2 },
    { label: 'Ski', amount: -250, month: 3 },
    { label: 'Economies Mars', amount: 2350, month: 3 },
    { label: 'Economies Avril', amount: 300, month: 4 },
    { label: 'Economies Mai', amount: 100, month: 5 },
    { label: 'Economies Juin', amount: -600, month: 6 },
    { label: 'Economies Juillet', amount: -1000, month: 7 },
    { label: 'Economies Août', amount: -500, month: 8 },
    { label: 'Economies Septembre', amount: -1000, month: 9 },
    { label: 'Economies Octobre', amount: 1200, month: 10 },
    { label: 'Economies Novembre', amount: -1000, month: 11 },
    { label: 'Economies Décembre', amount: 550, month: 12 },
  ]);

  // ============================================================
  // ANNÉE 2026 — Reconstruction depuis l'Excel
  // ============================================================
  console.log('\n=== 2026 (reconstruction) ===');
  await rebuildYear(2026, [
    { label: 'Economies Janvier', amount: 214.02, month: 1 },
    { label: 'Intérêts 2025', amount: 35.98, month: 1 },
    { label: 'Economies Février', amount: 1300, month: 2 },
    { label: 'Economies Mars', amount: 1100, month: 3, status: 'PENDING' },
    { label: 'Economies Avril', amount: 1100, month: 4, status: 'PENDING' },
    { label: 'Economies Mai', amount: 1100, month: 5, status: 'PENDING' },
    { label: 'Economies Juin', amount: 1100, month: 6, status: 'PENDING' },
    { label: 'Economies Juillet', amount: 1100, month: 7, status: 'PENDING' },
    { label: 'Economies Août', amount: 1100, month: 8, status: 'PENDING' },
    { label: 'Economies Septembre', amount: 1100, month: 9, status: 'PENDING' },
    { label: 'Economies Octobre', amount: 1100, month: 10, status: 'PENDING' },
    { label: 'Economies Novembre', amount: 1100, month: 11, status: 'PENDING' },
    { label: 'Economies Décembre', amount: 1100, month: 12, status: 'PENDING' },
    // Voyages
    { label: 'Voyages Février', amount: 100, month: 2 },
    { label: 'Voyages Mars', amount: 200, month: 3, status: 'PENDING' },
    { label: 'Voyages Avril', amount: 200, month: 4, status: 'PENDING' },
    { label: 'Voyages Mai', amount: 200, month: 5, status: 'PENDING' },
    { label: 'Voyages Juin', amount: 200, month: 6, status: 'PENDING' },
    { label: 'Voyages Juillet', amount: 200, month: 7, status: 'PENDING' },
    { label: 'Voyages Août', amount: 200, month: 8, status: 'PENDING' },
    { label: 'Voyages Septembre', amount: 200, month: 9, status: 'PENDING' },
    { label: 'Voyages Octobre', amount: 200, month: 10, status: 'PENDING' },
    { label: 'Voyages Novembre', amount: 200, month: 11, status: 'PENDING' },
    { label: 'Voyages Décembre', amount: 200, month: 12, status: 'PENDING' },
    // Vêtements
    { label: 'Vêtements Mars', amount: 70, month: 3, status: 'PENDING' },
    { label: 'Vêtements Avril', amount: 70, month: 4, status: 'PENDING' },
    { label: 'Vêtements Mai', amount: 70, month: 5, status: 'PENDING' },
    { label: 'Vêtements Juin', amount: 70, month: 6, status: 'PENDING' },
    { label: 'Vêtements Juillet', amount: 70, month: 7, status: 'PENDING' },
    { label: 'Vêtements Août', amount: 70, month: 8, status: 'PENDING' },
    { label: 'Vêtements Septembre', amount: 70, month: 9, status: 'PENDING' },
    { label: 'Vêtements Octobre', amount: 70, month: 10, status: 'PENDING' },
    { label: 'Vêtements Novembre', amount: 70, month: 11, status: 'PENDING' },
    { label: 'Vêtements Décembre', amount: 70, month: 12, status: 'PENDING' },
  ]);

  // ============================================================
  // 2018 : supprimer (c'étaient des tx Livret Jeune)
  // ============================================================
  console.log('\n=== 2018 (suppression — Livret Jeune) ===');
  const del2018 = await prisma.transaction.deleteMany({
    where: { year: 2018, categoryId: CAT_ECO },
  });
  console.log(`  Supprimé ${del2018.count} transactions`);

  // ============================================================
  // VÉRIFICATION FINALE
  // ============================================================
  console.log('\n=== VÉRIFICATION FINALE ===');

  for (const year of [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
    const txs = await prisma.transaction.findMany({
      where: { year, categoryId: CAT_ECO, status: { not: 'CANCELLED' } },
    });
    let netCompleted = 0;
    let netAll = 0;
    for (const t of txs) {
      const credit = t.destinationAccountId === LIVRET ? (-t.amount.toNumber()) : t.amount.toNumber();
      netAll += credit;
      if (t.status === 'COMPLETED') netCompleted += credit;
    }
    console.log(`${year}: ${txs.length} tx | COMPLETED net: ${netCompleted.toFixed(2)} | Total net: ${netAll.toFixed(2)}`);
  }

  // Solde total livret
  const incoming = await prisma.transaction.aggregate({
    where: { destinationAccountId: LIVRET, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  const outgoing = await prisma.transaction.aggregate({
    where: { accountId: LIVRET, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  const totalCompleted = -(incoming._sum.amount?.toNumber() ?? 0) + (outgoing._sum.amount?.toNumber() ?? 0);

  console.log('\nSolde livret COMPLETED (transactions):', totalCompleted.toFixed(2));
  console.log('Cible: 2900');

  // Reset baseAmount à 0 puisqu'on a reconstruit les données
  const newBase = 2900 - totalCompleted;
  // Voyages a 100€ via transactions, donc bucket Eco devrait être 2800
  // Mais le calcul inclut tout, décomposons
  const inEco = await prisma.transaction.aggregate({
    where: { bucketId: BUCKET_ECO, status: 'COMPLETED', destinationAccountId: LIVRET },
    _sum: { amount: true },
  });
  const outEco = await prisma.transaction.aggregate({
    where: { bucketId: BUCKET_ECO, status: 'COMPLETED', accountId: LIVRET },
    _sum: { amount: true },
  });
  const ecoNet = -(inEco._sum.amount?.toNumber() ?? 0) + (outEco._sum.amount?.toNumber() ?? 0);
  console.log('Net bucket Economies COMPLETED:', ecoNet.toFixed(2));
  console.log('baseAmount nécessaire pour 2800:', (2800 - ecoNet).toFixed(2));

  await prisma.bucket.update({
    where: { id: BUCKET_ECO },
    data: { baseAmount: new Prisma.Decimal(2800 - ecoNet) },
  });
  console.log('✓ baseAmount mis à:', (2800 - ecoNet).toFixed(2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
