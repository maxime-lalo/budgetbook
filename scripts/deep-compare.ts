import { readFileSync } from 'fs';

const json = JSON.parse(readFileSync('/Users/maximelalo/Downloads/comptes-export-2026-02-16.json', 'utf-8'));
const ecoTx = json.data.transactions
  .filter((t: any) => t.categoryId === 'cmleb3stu0013v5v482ldxpzp' && t.status !== 'CANCELLED')
  .sort((a: any, b: any) => a.year - b.year || a.month - b.month);

// ============================================================
// EXCEL DATA - montants uniquement (positif = vers livret, négatif = retrait)
// On ignore la colonne Livret Jeune (net = 0)
// On ne prend que Livret A + Voyages + Vêtements
// ============================================================

const excelLA: Record<number, { label: string; amount: number }[]> = {
  2019: [
    { label: 'Économies ouverture', amount: 50 },
    { label: 'Économies Janvier', amount: 450 },
    { label: 'Retrait saint valentin', amount: -100 },
    { label: 'Économies Février', amount: 300 },
    { label: 'Galère mars', amount: -75 },
    { label: 'Économies Mars', amount: 425 },
    { label: 'Économies Avril', amount: 350 },
    { label: 'Commande ASOS mai', amount: -100 },
    { label: 'Retrait galère mai', amount: -50 },
    { label: 'Remboursement salle', amount: 200 },
    { label: 'Retrait galère mai', amount: -50 },
    { label: 'Retrait galère Mai', amount: -50 },
    { label: 'Économies Mai', amount: 350 },
    { label: 'Préparatifs Espagne', amount: -300 },
    { label: 'Préparatifs Espagne 2', amount: -300 },
    { label: 'Vacances Espagne', amount: -700 },
    { label: 'Espagne', amount: -200 },
    { label: 'Jambon Espagne', amount: -100 },
    { label: 'Avance Camille', amount: -80 },
    { label: 'Économies Juillet', amount: 380 },
    { label: 'Galère Août', amount: -100 },
    { label: 'Avance', amount: -100 },
    { label: 'Economies Décembre', amount: 596.55 },
    { label: 'Rémunération nette', amount: 3.45 },
  ],
  2020: [
    { label: 'Espèces Noël', amount: 60 },
    { label: 'Dépôt chèques Noël', amount: 140 },
    { label: 'Galère Janvier', amount: -50 },
    { label: 'Avance bouteilles Nicolas', amount: -210 },
    { label: 'Galère Janvier', amount: -50 },
    { label: 'Economies Février', amount: 500 },
    { label: 'Remboursement Livret', amount: 100 },
    { label: 'Prêt Camille', amount: -1280 },
    { label: 'Remboursement Camille', amount: 1020.04 },
    { label: 'Économies février', amount: 369.96 },
    { label: 'Economies mars', amount: 600 },
    { label: 'Frais inscription école', amount: -300 },
    { label: 'Récupération Avril', amount: -200 },
    { label: 'Écrans', amount: -500 },
    { label: 'Economies Avril', amount: 500 },
    { label: 'Economies Mai', amount: 500 },
    { label: 'Economies Juin', amount: 200 },
    { label: 'Airbnb', amount: -846 },
    { label: 'Airbnb remb', amount: 46 },
    // Juillet = pas d'économies (0)
    { label: 'Galère aout', amount: -100 },
    { label: 'Galère aout', amount: -50 },
    { label: 'Économies août', amount: 1150 },
    { label: 'Crypto + galère', amount: -600 },
    { label: 'Galère', amount: -100 },
    { label: 'ImagineR', amount: -350 },
    { label: 'Économies Septembre', amount: 50 },
    { label: 'Économies Novembre', amount: 500 },
    { label: 'Économies Décembre', amount: 1094.87 },
    { label: 'Intérêts', amount: 5.13 },
    { label: 'Réservation Airbnb', amount: -1200 },
    // ANNULE Remboursement Airbnb
    // ANNULE Economies Mars
    { label: 'Appart galère', amount: -1000 },
    { label: 'Remboursement', amount: 1000 },
    { label: 'chaud juillet', amount: -400 },
    { label: 'Chaud juillet', amount: -150 },
    { label: 'Espagne', amount: -1200 },
    { label: 'Equilibre', amount: 150 },
  ],
  // Pas de 2021 dans l'Excel Livret A !
  2022: [
    { label: 'Economies Mai', amount: 900 },
    { label: 'Prime LCL', amount: 3200 },
    { label: 'Matelas', amount: -550 },
    { label: 'Léo + tatouage', amount: -250 },
    { label: 'Voyage amsterdam', amount: -150 },
    { label: 'Galère Juin', amount: -100 },
    { label: 'Economies Juin', amount: 700 },
    { label: 'Tel + galère', amount: -1050 },
    { label: 'C la merde mdr', amount: -400 },
    { label: 'New York', amount: -1500 },
    // AOUT Remboursement New York (pas de montant visible)
    { label: 'Economies Août', amount: 600 },
    { label: 'BON', amount: -400 },
    { label: 'ImagineR', amount: -200 },
    { label: 'Economies Septembre', amount: 0 },
    { label: 'Economies Octobre', amount: 200 },
    { label: 'Economies Décembre', amount: 0 },
  ],
  2023: [
    { label: 'Economies Janvier', amount: 0 },
    { label: 'Economies Février', amount: 200 },
    { label: 'Economies Mars', amount: 200 },
    { label: 'Economies Avril', amount: 0 },
    { label: 'Economies Mai', amount: 0 },
    { label: 'Economies Juin', amount: 0 },
    { label: 'Economies Juillet', amount: 0 },
    { label: 'Economies Août', amount: 0 },
    { label: 'Economies Septembre', amount: 190 },
    { label: 'Economies Octobre', amount: 0 },
    { label: 'Economies Novembre', amount: 400 },
    { label: 'Economies Décembre', amount: 190 },
    { label: 'Janvier', amount: -400 },
    { label: 'Mph', amount: -400 },
    { label: 'Mph', amount: -200 },
    { label: 'Carte graphique', amount: -150 },
    { label: 'Remboursement Carte graphique', amount: 150 },
    { label: 'Lunalogic', amount: 150 },
    { label: 'Avance Mai', amount: -150 },
    { label: 'Remboursement Avance Mai', amount: 100 },
    { label: 'Avance Poêles/Psy', amount: -300 },
    { label: 'Avance', amount: -100 },
    { label: 'Avance', amount: -200 },
    { label: 'Vacances', amount: -90 },
    { label: "J'en ai marre", amount: -190 },
    { label: 'imagineR', amount: -400 },
  ],
  2024: [
    { label: 'Economies Janvier', amount: 136.06 },
    { label: 'Economies Février', amount: 860 },
    { label: 'Economies Mars', amount: 0 },
    { label: 'Economies Avril', amount: 0 },
    { label: 'Economies Mai', amount: 0 },
    { label: 'Economies Juin', amount: 100 },
    { label: 'Economies Juillet', amount: 0 },
    { label: 'Economies Août', amount: 1190 },
    { label: 'Economies Septembre', amount: 0 },
    { label: 'Economies Octobre', amount: -200 },
    { label: 'Economies Novembre', amount: 700 },
    { label: 'Economies Décembre', amount: 0 },
    { label: 'Intérêts 2023', amount: 3.94 },
    { label: 'Frigo', amount: -600 },
    { label: 'Dentiste', amount: -200 },
    { label: 'Meubles IKEA', amount: -300 },
    { label: 'Ouverture Fortunéo', amount: 10 },
    { label: 'Juillet', amount: -200 },
    { label: 'Chats', amount: -500 },
  ],
  2025: [
    { label: 'Intérêts 2024', amount: 4.58 },
    { label: 'Economies Janvier', amount: 395.42 },
    { label: 'Economies Février', amount: 0 },
    { label: 'Ski', amount: -500 },
    { label: 'Ski', amount: -250 },
    { label: 'Economies Mars', amount: 2350 },
    // Impôts = - (dash, pas de montant)
    { label: 'Economies Avril', amount: 300 },
    { label: 'Economies Mai', amount: 100 },
    { label: 'Economies Juin', amount: -600 },
    { label: 'Economies Juillet', amount: -1000 },
    { label: 'Economies Aout', amount: -500 },
    { label: 'Economies Septembre', amount: -1000 },
    { label: 'Economies Octobre', amount: 1200 },
    { label: 'Economies Novembre', amount: -1000 },
    { label: 'Economies Décembre', amount: 550 },
  ],
  2026: [
    { label: 'Janvier', amount: 214.02 },
    { label: 'Février', amount: 1300 },
    { label: 'Mars', amount: 1100 },
    { label: 'Avril', amount: 1100 },
    { label: 'Mai', amount: 1100 },
    { label: 'Juin', amount: 1100 },
    { label: 'Juillet', amount: 1100 },
    { label: 'Août', amount: 1100 },
    { label: 'Septembre', amount: 1100 },
    { label: 'Octobre', amount: 1100 },
    { label: 'Novembre', amount: 1100 },
    { label: 'Décembre', amount: 1100 },
    { label: 'Intérêts 2025', amount: 35.98 },
  ],
};

// Livret Jeune (pour info)
const excelLJ: Record<number, number> = {
  2018: 10 + 300 - 110 - 150 - 40,
  2019: 1.94 + 1188.06 + 185 + 215 - 50 + 50 - 30 + 30 - 50 + 50 - 1160 + 700 - 50 + 300 + 210 - 324 - 350 + 212 + 162 - 200 - 388 + 288 - 378 - 122 + 470 - 100 - 200 + 200 - 100 + 230 + 577.79 + 22.21,
  2020: -1590 + 1305.02 + 284.98 + 17.98 - 17.98 - 1500 + 1500,
  2022: -300 - 600 + 200 + 300 + 300 + 100,
  2023: -400 + 400 - 500 - 400 - 200 + 600 - 900 - 150 - 40,
  2024: -10,
};

// ============================================================
// COMPARAISON
// ============================================================

// JSON amounts grouped by year (du point de vue du livret : on inverse le signe)
const jsonByYear: Record<number, { label: string; amount: number; month: number }[]> = {};
for (const t of ecoTx) {
  if (!(t.year in jsonByYear)) jsonByYear[t.year] = [];
  // amount dans le JSON est du point de vue checking : négatif = sort du checking = entre au livret
  // On inverse pour comparer avec l'Excel (qui est du point de vue livret)
  jsonByYear[t.year].push({ label: t.label, amount: -parseFloat(t.amount), month: t.month });
}

console.log('='.repeat(80));
console.log('COMPARAISON DÉTAILLÉE PAR ANNÉE (montants du point de vue du livret)');
console.log('Positif = argent vers le livret, Négatif = retrait du livret');
console.log('='.repeat(80));

let totalEcart = 0;

for (const year of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
  const excelEntries = excelLA[year] || [];
  const jsonEntries = jsonByYear[year] || [];
  const ljNet = excelLJ[year] || 0;

  const excelTotal = excelEntries.reduce((s, e) => s + e.amount, 0);
  const excelNonZero = excelEntries.filter(e => e.amount !== 0);
  const jsonTotal = jsonEntries.reduce((s, e) => s + e.amount, 0);
  const ecart = jsonTotal - excelTotal;
  totalEcart += ecart;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`ANNÉE ${year}`);
  console.log(`Excel LA: ${excelNonZero.length} tx non-nulles, total = ${excelTotal.toFixed(2)}`);
  console.log(`JSON:     ${jsonEntries.length} tx, total = ${jsonTotal.toFixed(2)}`);
  console.log(`LJ net:   ${ljNet.toFixed(2)}`);
  console.log(`ÉCART:    ${ecart.toFixed(2)} (JSON - Excel LA)`);
  console.log(`Écart - LJ = ${(ecart - ljNet).toFixed(2)}`);

  if (Math.abs(ecart) > 10) {
    console.log(`\n  --- JSON (${jsonEntries.length} tx) ---`);
    for (const t of jsonEntries) {
      console.log(`    M${String(t.month).padStart(2, '0')} | ${String(t.amount.toFixed(2)).padStart(10)} | ${t.label}`);
    }
    console.log(`\n  --- Excel LA (${excelEntries.length} tx) ---`);
    for (const e of excelEntries) {
      if (e.amount !== 0) {
        console.log(`         ${String(e.amount.toFixed(2)).padStart(10)} | ${e.label}`);
      }
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`ÉCART TOTAL: ${totalEcart.toFixed(2)}`);
console.log('Si les données JSON incluent le Livret Jeune mélangé au Livret A,');
console.log('on soustrait le LJ cumulé (qui vaut 0) → écart reste ' + totalEcart.toFixed(2));
