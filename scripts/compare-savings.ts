import { readFileSync } from 'fs';

const json = JSON.parse(readFileSync('/Users/maximelalo/Downloads/comptes-export-2026-02-16.json', 'utf-8'));

interface Tx { categoryId: string; year: number; month: number; label: string; amount: string; status: string; }

const ecoTx = json.data.transactions
  .filter((t: Tx) => t.categoryId === 'cmleb3stu0013v5v482ldxpzp')
  .sort((a: Tx, b: Tx) => a.year - b.year || a.month - b.month || a.label.localeCompare(b.label, 'fr'));

// Grouper par année
const byYear: Record<number, Tx[]> = {};
for (const t of ecoTx) {
  if (!(t.year in byYear)) byYear[t.year] = [];
  byYear[t.year].push(t);
}

for (const year of Object.keys(byYear).sort()) {
  const txs = byYear[Number(year)];
  let total = 0;
  console.log('========== ' + year + ' (' + txs.length + ' tx) ==========');
  for (const t of txs) {
    const amt = parseFloat(t.amount);
    total += amt;
    const status = t.status === 'CANCELLED' ? ' [CANCELLED]' : t.status === 'PENDING' ? ' [PENDING]' : '';
    console.log('  M' + String(t.month).padStart(2, '0') + ' | ' + String(amt).padStart(10) + ' | ' + t.label + status);
  }
  console.log('  --> Total ' + year + ': ' + total.toFixed(2));
  console.log();
}

const grandTotal = ecoTx
  .filter((t: Tx) => t.status !== 'CANCELLED')
  .reduce((s: number, t: Tx) => s + parseFloat(t.amount), 0);
console.log('Grand total (hors CANCELLED):', grandTotal.toFixed(2));

// Totaux Excel attendus par année (net des 4 colonnes combinées)
// Calculés manuellement depuis l'Excel fourni
console.log('\n========== COMPARAISON AVEC EXCEL ==========');

// Excel Livret Jeune net par année:
// 2018: 10+300-110-150-40 = 10
// 2019: ~1590
// 2020: 0
// 2022: 0
// 2023: -1590
// 2024: -10
// Total LJ: 0

// Excel Livret A net par année:
// On ne peut pas facilement calculer, comparons plutôt le nombre de transactions
console.log('\nNombre de transactions JSON par année:');
for (const year of Object.keys(byYear).sort()) {
  console.log('  ' + year + ': ' + byYear[Number(year)].length + ' tx');
}
