import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const CAT_ECO = 'cmleb3stu0013v5v482ldxpzp';
  const CHECKING = 'bnp-checking';
  const LIVRET = 'livret-a';
  const BUCKET_ECO = 'cmled5tw4003cv5b1qndssuvl';

  // Helper: trouver une transaction par critères
  async function findTx(year: number, month: number, label: string, amount?: number) {
    const where: any = { year, month, categoryId: CAT_ECO, label: { contains: label } };
    if (amount !== undefined) where.amount = new Prisma.Decimal(amount);
    return prisma.transaction.findFirst({ where });
  }

  let totalAdjustment = 0;

  // ============================================================
  // 2026 : Mars est à -1500 dans le JSON, devrait être -1100 dans l'Excel
  // ============================================================
  console.log('\n=== 2026 ===');
  const mars2026 = await prisma.transaction.findFirst({
    where: { year: 2026, month: 3, categoryId: CAT_ECO, status: 'PENDING' }
  });
  if (mars2026 && mars2026.amount.toNumber() === -1500) {
    await prisma.transaction.update({
      where: { id: mars2026.id },
      data: { amount: new Prisma.Decimal(-1100) }
    });
    console.log('✓ Mars 2026 : -1500 → -1100 (correction de +400)');
    totalAdjustment += 400; // 400€ de moins vers le livret
  }

  // 2026 : Manque les intérêts 2025 (35.98)
  const interets2025 = await prisma.transaction.findFirst({
    where: { year: 2026, month: 1, categoryId: CAT_ECO, label: { contains: 'ntérêts' } }
  });
  if (!interets2025) {
    await prisma.transaction.create({
      data: {
        label: 'Intérêts 2025',
        amount: new Prisma.Decimal(-35.98),
        date: new Date('2026-01-01'),
        month: 1, year: 2026,
        status: 'COMPLETED',
        accountId: CHECKING,
        categoryId: CAT_ECO,
        destinationAccountId: LIVRET,
        bucketId: BUCKET_ECO,
        isAmex: false,
      }
    });
    console.log('✓ Ajout intérêts 2025 : -35.98');
    totalAdjustment -= 35.98;
  } else {
    console.log('  Intérêts 2025 déjà présents');
  }

  // ============================================================
  // 2025 : PEA transactions (6 tx = 400€) ne devraient pas être Économies
  // + "Ouverture Livret A" (10€) est un doublon conceptuel
  // ============================================================
  console.log('\n=== 2025 ===');
  const peaTx = await prisma.transaction.findMany({
    where: { year: 2025, categoryId: CAT_ECO, label: { contains: 'PEA' } }
  });
  if (peaTx.length > 0) {
    const peaTotal = peaTx.reduce((s, t) => s + t.amount.toNumber(), 0);
    // Supprimer les PEA de la catégorie Économies (ils ne sont pas dans l'Excel Livret A)
    for (const t of peaTx) {
      await prisma.transaction.delete({ where: { id: t.id } });
    }
    console.log(`✓ Supprimé ${peaTx.length} transactions PEA (total: ${peaTotal})`);
    totalAdjustment -= peaTotal; // ces montants négatifs (côté checking) ne vont plus au livret
  }

  // "Ouverture Livret A" n'est pas dans l'Excel
  const ouvertureLivret = await prisma.transaction.findFirst({
    where: { year: 2025, categoryId: CAT_ECO, label: { contains: 'Ouverture Livret' } }
  });
  if (ouvertureLivret) {
    await prisma.transaction.delete({ where: { id: ouvertureLivret.id } });
    console.log(`✓ Supprimé "Ouverture Livret A" (${ouvertureLivret.amount.toNumber()})`);
    totalAdjustment -= ouvertureLivret.amount.toNumber();
  }

  // 2025 : Excel a 4.58 intérêts 2024, le JSON a 395.42 "Economies" pour janvier
  // 395.42 + 4.58 = 400 dans l'Excel. Vérifions si les intérêts sont séparés
  const interets2024 = await prisma.transaction.findFirst({
    where: { year: 2025, month: 1, categoryId: CAT_ECO, label: { contains: 'ntérêts' } }
  });
  if (!interets2024) {
    // Les intérêts sont probablement fusionnés dans "Economies" 395.42
    // L'Excel a Economies Janvier=395.42 ET Intérêts=4.58, donc on ajoute les intérêts
    await prisma.transaction.create({
      data: {
        label: 'Intérêts 2024',
        amount: new Prisma.Decimal(-4.58),
        date: new Date('2025-01-01'),
        month: 1, year: 2025,
        status: 'COMPLETED',
        accountId: CHECKING,
        categoryId: CAT_ECO,
        destinationAccountId: LIVRET,
        bucketId: BUCKET_ECO,
        isAmex: false,
      }
    });
    console.log('✓ Ajout intérêts 2024 : -4.58');
    totalAdjustment -= 4.58;
  }

  // ============================================================
  // 2024 : Intérêts LJ (18.19) dans le JSON, pas dans l'Excel LA
  // "Activation fortunéo" (300) vs Excel "Ouverture Fortunéo" (10)
  // ============================================================
  console.log('\n=== 2024 ===');
  const interetsLJ = await prisma.transaction.findFirst({
    where: { year: 2024, categoryId: CAT_ECO, label: { contains: 'livret jeune' } }
  });
  if (interetsLJ) {
    await prisma.transaction.delete({ where: { id: interetsLJ.id } });
    console.log(`✓ Supprimé "Intérêts livret jeune" (${interetsLJ.amount.toNumber()})`);
    totalAdjustment -= interetsLJ.amount.toNumber();
  }

  // "Activation fortunéo" est à -300 dans le JSON, devrait être -10 (Ouverture Fortunéo) dans l'Excel
  const fortuneo = await prisma.transaction.findFirst({
    where: { year: 2024, categoryId: CAT_ECO, label: { contains: 'ortun' } }
  });
  if (fortuneo && fortuneo.amount.toNumber() === -300) {
    await prisma.transaction.update({
      where: { id: fortuneo.id },
      data: { amount: new Prisma.Decimal(-10), label: 'Ouverture Fortunéo' }
    });
    console.log('✓ Activation fortunéo : -300 → -10');
    totalAdjustment += 290;
  }

  // "Intérêts 2023" manquant (3.94 dans l'Excel)
  const interets2023 = await prisma.transaction.findFirst({
    where: { year: 2024, month: 1, categoryId: CAT_ECO, label: { contains: 'ntérêts' } }
  });
  if (!interets2023) {
    await prisma.transaction.create({
      data: {
        label: 'Intérêts 2023',
        amount: new Prisma.Decimal(-3.94),
        date: new Date('2024-01-01'),
        month: 1, year: 2024,
        status: 'COMPLETED',
        accountId: CHECKING,
        categoryId: CAT_ECO,
        destinationAccountId: LIVRET,
        bucketId: BUCKET_ECO,
        isAmex: false,
      }
    });
    console.log('✓ Ajout intérêts 2023 : -3.94');
    totalAdjustment -= 3.94;
  }

  // 2024 : Il y a des tx dans le JSON qui ne sont pas dans l'Excel
  // "Economies foyer" (-300), "Frigo conforama" (-600), "Remboursement dentiste" (-200)
  // vs Excel: "Frigo" (-600), "Dentiste" (-200), "Meubles IKEA" (-300)
  // → les labels diffèrent mais les montants matchent → pas de correction nécessaire

  // Mais le JSON a des tx supplémentaires : "Economies" à -400 (M08), +400 (M09), -690 (M09), +790 (M09)
  // qui ne sont pas dans l'Excel. Vérifions le net des "extra"
  // Excel 2024 net = 1000, JSON 2024 net (avant corrections) = 1367.87
  // Après corrections (suppression intérêts LJ +18.19, fortunéo -300→-10 = +290, ajout intérêts -3.94):
  // 1367.87 - 18.19 + 290 - 3.94 = 1635.74... hmm non, les signes sont inversés
  // Let's just compute the remaining gap after all fixes

  // ============================================================
  // 2023 : Rémunération Livret Jeune (20.19) et Livret A (11.59)
  // L'Excel a 11.59 dans LA. Le 20.19 est LJ → supprimer
  // ============================================================
  console.log('\n=== 2023 ===');
  const remLJ2023 = await prisma.transaction.findFirst({
    where: { year: 2023, categoryId: CAT_ECO, label: { contains: 'Livret Jeune' } }
  });
  if (remLJ2023) {
    await prisma.transaction.delete({ where: { id: remLJ2023.id } });
    console.log(`✓ Supprimé "Rémunération Livret Jeune" 2023 (${remLJ2023.amount.toNumber()})`);
    totalAdjustment -= remLJ2023.amount.toNumber();
  }

  // ============================================================
  // 2020 : C'est l'année avec le plus gros écart (+4043)
  // Le JSON a 23 tx, l'Excel LA en a 36. Beaucoup de transactions manquantes.
  // Transactions clairement manquantes dans le JSON (gros montants) :
  // ============================================================
  console.log('\n=== 2020 ===');

  // "Economies Livret Jeune" (-577.79) → c'est du LJ, supprimer
  const ecoLJ2020 = await prisma.transaction.findFirst({
    where: { year: 2020, categoryId: CAT_ECO, label: { contains: 'Livret Jeune' } }
  });
  if (ecoLJ2020) {
    await prisma.transaction.delete({ where: { id: ecoLJ2020.id } });
    console.log(`✓ Supprimé "Economies Livret Jeune" 2020 (${ecoLJ2020.amount.toNumber()})`);
    totalAdjustment -= ecoLJ2020.amount.toNumber();
  }

  // Transactions manquantes du JSON par rapport à l'Excel LA :
  const missing2020: { label: string; amount: number; month: number }[] = [
    { label: 'Espèces Noël', amount: -60, month: 1 },
    { label: 'Avance bouteilles Nicolas', amount: 210, month: 1 },
    { label: 'Remboursement Livret', amount: -100, month: 2 },
    { label: 'Prêt Camille', amount: 1280, month: 3 },
    { label: 'Remboursement Camille', amount: -1020.04, month: 4 },
    { label: 'Frais inscription école', amount: 300, month: 4 },
    { label: 'Airbnb remboursement', amount: -46, month: 7 },
    { label: 'Galère aout', amount: 50, month: 8 },
    { label: 'Économies août', amount: -1150, month: 8 },
    { label: 'Crypto + galère', amount: 600, month: 9 },
    { label: 'ImagineR', amount: 350, month: 9 },
    { label: 'Économies Novembre', amount: -500, month: 11 },
    { label: 'Économies Décembre', amount: -1094.87, month: 12 },
    { label: 'Intérêts', amount: -5.13, month: 12 },
    { label: 'Réservation Airbnb', amount: 1200, month: 7 },
    { label: 'Appart galère', amount: 1000, month: 8 },
    { label: 'Remboursement appart', amount: -1000, month: 8 },
    { label: 'Chaud juillet', amount: 400, month: 7 },
    { label: 'Chaud juillet', amount: 150, month: 7 },
    { label: 'Espagne', amount: 1200, month: 8 },
    { label: 'Equilibre', amount: -150, month: 9 },
  ];

  for (const m of missing2020) {
    await prisma.transaction.create({
      data: {
        label: m.label,
        amount: new Prisma.Decimal(m.amount),
        date: null,
        month: m.month, year: 2020,
        status: 'COMPLETED',
        accountId: m.amount < 0 ? CHECKING : LIVRET,
        categoryId: CAT_ECO,
        destinationAccountId: m.amount < 0 ? LIVRET : CHECKING,
        bucketId: BUCKET_ECO,
        isAmex: false,
      }
    });
    totalAdjustment += m.amount; // du point de vue checking
  }
  console.log(`✓ Ajouté ${missing2020.length} transactions manquantes pour 2020`);

  // Le JSON a "Renflouement Boursorama" (5€) qui n'est pas dans l'Excel → supprimer
  const renflouement2020 = await prisma.transaction.findFirst({
    where: { year: 2020, categoryId: CAT_ECO, label: { contains: 'Boursorama' } }
  });
  if (renflouement2020) {
    await prisma.transaction.delete({ where: { id: renflouement2020.id } });
    console.log(`✓ Supprimé "Renflouement Boursorama" (${renflouement2020.amount.toNumber()})`);
    totalAdjustment -= renflouement2020.amount.toNumber();
  }

  // ============================================================
  // Recalcul final
  // ============================================================
  console.log('\n=== RÉSULTAT ===');

  // Recalculer le solde total du livret
  const incoming = await prisma.transaction.aggregate({
    where: { destinationAccountId: LIVRET, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  const outgoing = await prisma.transaction.aggregate({
    where: { accountId: LIVRET, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  const bucket = await prisma.bucket.findUnique({ where: { id: BUCKET_ECO } });
  const baseAmount = bucket?.baseAmount.toNumber() ?? 0;

  const totalLivret = -(incoming._sum.amount?.toNumber() ?? 0) + (outgoing._sum.amount?.toNumber() ?? 0);
  console.log('Solde livret COMPLETED (transactions seules):', totalLivret.toFixed(2));
  console.log('Avec baseAmount actuel (' + baseAmount + '):', (totalLivret + baseAmount).toFixed(2));
  console.log('Cible: 2800 (bucket Economies) + 100 (Voyages) = 2900');

  // Calculer le nouveau baseAmount nécessaire
  const newBaseAmount = 2800 - totalLivret;
  console.log('Nouveau baseAmount nécessaire:', newBaseAmount.toFixed(2));

  await prisma.bucket.update({
    where: { id: BUCKET_ECO },
    data: { baseAmount: new Prisma.Decimal(newBaseAmount) },
  });
  console.log('✓ baseAmount mis à jour:', newBaseAmount.toFixed(2));
  console.log('Solde final bucket Economies:', (newBaseAmount + totalLivret).toFixed(2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });
