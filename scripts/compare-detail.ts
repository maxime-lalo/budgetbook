// Totaux Excel par année (calculés manuellement depuis le copier-coller de l'utilisateur)
// Signes: positif = argent vers le livret, négatif = retrait du livret

// LIVRET JEUNE
const LJ: Record<number, number> = {
  2018: 10 + 300 - 110 - 150 - 40,  // = 10
  2019: 1.94 + 1188.06 + 185 + 215 - 50 + 50 - 30 + 30 - 50 + 50 - 1160 + 700 - 50 + 300 + 210 - 324 - 350 + 212 + 162 - 200 - 388 + 288 - 378 - 122 + 470 - 100 - 200 + 200 - 100 + 230 + 577.79 + 22.21,
  2020: -1590 + 1305.02 + 284.98 + 17.98 - 17.98 - 1500 + 1500,
  // 2021: pas de transactions Livret Jeune visibles
  2022: -300 - 600 + 200 + 300 + 300 + 100,
  2023: -400 + 400 - 500 - 400 - 200 + 600 - 900 - 150 - 40,
  2024: -10,
};

// LIVRET A
const LA: Record<number, number> = {
  2019: 50 + 450 - 100 + 300 - 75 + 425 + 350 - 100 - 50 + 200 - 50 - 50 + 350 - 300 - 300 - 700 - 200 - 100 - 80 + 380 - 100 - 100 + 596.55 + 3.45,
  2020: 60 + 140 - 50 - 210 - 50 + 500 + 100 - 1280 + 1020.04 + 369.96 + 600 - 300 - 200 - 500 + 500 + 500 + 200 - 846 + 46 + 0 - 100 - 50 + 1150 - 600 - 100 - 350 + 50 + 500 + 1094.87 + 5.13 - 1200 - 1000 + 1000 - 400 - 150 - 1200 + 150,
  2022: 900 + 3200 - 550 - 250 - 150 - 100 + 700 - 1050 - 400 - 1500 + 600 - 400 - 200 + 0 + 200 + 0,
  2023: 0 + 200 + 200 + 0 + 0 + 0 + 0 + 0 + 190 + 0 + 400 + 190 - 400 - 400 - 200 - 150 + 150 + 150 - 150 + 100 - 300 - 100 - 200 - 90 - 190 - 400,
  2024: 136.06 + 860 + 0 + 0 + 0 + 100 + 0 + 1190 + 0 - 200 + 700 + 0 + 3.94 - 600 - 200 - 300 + 10 - 200 - 500,
  2025: 4.58 + 395.42 + 0 - 500 - 250 + 2350 + 300 + 100 - 600 - 1000 - 500 - 1000 + 1200 - 1000 + 550,
  2026: 214.02 + 1300 + 1100 * 10 + 35.98,
};

// VOYAGES (2026 seulement visible)
const VOY: Record<number, number> = {
  2026: 100 + 200 * 10,  // Fév + Mar-Déc
};

// VETEMENTS (2026 seulement visible)
const VET: Record<number, number> = {
  2026: 0 + 70 * 10,  // Fév + Mar-Déc
};

// JSON totaux (depuis l'output précédent)
const JSON_TOTALS: Record<number, number> = {
  2018: 0,
  2019: -4008.06,
  2020: -3443.30,
  2021: 1154.13,
  2022: -2334.39,
  2023: 2571.78,
  2024: -1367.87,
  2025: -455.42,
  2026: -12914.02,
};

console.log('Année | Excel (LJ+LA+V+Vêt) | JSON total | Écart');
console.log('------|---------------------|------------|------');

let excelCumul = 0;
let jsonCumul = 0;

for (const year of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
  const lj = LJ[year] || 0;
  const la = LA[year] || 0;
  const voy = VOY[year] || 0;
  const vet = VET[year] || 0;
  const excelNet = lj + la + voy + vet;
  // JSON : les montants négatifs = versements vers livret, positifs = retraits
  // Donc le net pour le livret = -JSON_TOTAL (inverser car c'est vu côté checking)
  const jsonNet = -JSON_TOTALS[year];
  const ecart = jsonNet - excelNet;
  excelCumul += excelNet;
  jsonCumul += jsonNet;

  console.log(
    year + ' | ' +
    'LJ=' + lj.toFixed(2).padStart(8) + ' LA=' + la.toFixed(2).padStart(8) +
    ' | Excel=' + excelNet.toFixed(2).padStart(9) +
    ' | JSON=' + jsonNet.toFixed(2).padStart(9) +
    ' | Écart=' + ecart.toFixed(2).padStart(9)
  );
}

console.log();
console.log('Cumul Excel: ' + excelCumul.toFixed(2) + ' (devrait être ~2900)');
console.log('Cumul JSON:  ' + jsonCumul.toFixed(2));
console.log('Écart total: ' + (jsonCumul - excelCumul).toFixed(2));
