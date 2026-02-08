# Statistiques

## Fonctionnalités

### Filtres (StatisticsFilters)
- **Année** : sélecteur couvrant les 8 dernières années
- **Compte** : sélecteur avec option "Tous les comptes"
- Les filtres mettent à jour les searchParams URL (`?year=2026&account=xxx`)

### 4 graphiques Recharts

#### 1. Vue annuelle (YearlyOverviewChart)
- **Type** : AreaChart
- **Données** : revenus vs dépenses par mois sur l'année
- **Axes** : mois (fr) en X, montant EUR en Y
- Deux aires colorées : revenus (vert) et dépenses (rouge)

#### 2. Répartition par catégorie (CategoryBreakdownChart)
- **Type** : BarChart horizontal
- **Données** : total des dépenses par catégorie (valeur absolue)
- Barres colorées avec la couleur de chaque catégorie
- Layout vertical (catégories en Y, montants en X)

#### 3. Comparaison N vs N-1 (YearComparisonChart)
- **Type** : LineChart
- **Données** : dépenses mensuelles de l'année courante vs l'année précédente
- Deux lignes : année en cours (bleu) et année précédente (gris)

#### 4. Revenus vs Dépenses (IncomeVsExpensesChart)
- **Type** : BarChart groupé
- **Données** : barres revenus et dépenses côte à côte par mois
- Revenus en vert, dépenses en rouge

## Server Actions (_actions/statistics-actions.ts)

| Fonction | Description |
|----------|-------------|
| `getYearlyOverview(year, accountId?)` | Agrège revenus/dépenses par mois (boucle 12 mois) |
| `getCategoryBreakdown(year, accountId?)` | `groupBy` categoryId, dépenses de l'année |
| `getYearComparison(year, accountId?)` | Compare N vs N-1, dépenses mensuelles |
| `getAccounts()` | Liste des comptes pour le filtre |

## Points techniques
- Les agrégations utilisent `prisma.transaction.aggregate` et `groupBy`
- Les `Decimal` sont convertis en `number` via `.toNumber()` côté serveur
- Le filtrage par compte est optionnel (si `accountId` est fourni, ajouté au `where`)
- Les données sont fetchées en parallèle dans `page.tsx` (4 appels concurrents)
