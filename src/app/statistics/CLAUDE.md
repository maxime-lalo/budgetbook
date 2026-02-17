# Statistiques

## Fonctionnalités

### Filtres (StatisticsFilters)
- **Année** : sélecteur couvrant les 8 dernières années
- **Compte** : sélecteur avec option "Tous les comptes"
- Les filtres mettent à jour les searchParams URL (`?year=2026&account=xxx`)

### 5 graphiques et tableaux

#### 1. Vue annuelle (YearlyOverviewChart)
- **Type** : AreaChart
- **Données** : revenus vs dépenses par mois sur l'année
- **Axes** : mois (fr) en X, montant EUR en Y
- Deux aires colorées : revenus (vert) et dépenses (rouge)

#### 2. Épargne (SavingsOverviewChart)
- **Type** : AreaChart (même style que la vue annuelle)
- **Données** : solde cumulé des comptes SAVINGS + INVESTMENT mois par mois
- Le signe des montants est inversé (négatif = versement = épargne augmente)
- Prend en compte les transactions des années précédentes comme point de départ
- Courbe verte (#10b981)

#### 3. Répartition par catégorie (CategoryBreakdownChart)
- **Type** : BarChart horizontal
- **Données** : total des dépenses par catégorie (valeur absolue)
- Barres colorées avec la couleur de chaque catégorie via `<Cell>`

#### 4. Répartition par sous-catégorie (SubCategoryBreakdownChart)
- **Type** : BarChart horizontal
- **Données** : dépenses par sous-catégorie, filtrées par catégorie sélectionnée
- Sélecteur de catégorie (avec pastilles de couleur) pour filtrer
- Composant client avec `useState` pour la catégorie active

#### 5. Comparaison par catégorie N vs N-1 (CategoryComparisonTable)
- **Type** : Tableau HTML (pas de graphique Recharts)
- **Colonnes** : Catégorie (pastille couleur), Mois actuel, Moy. mens., Total annuel, % mois, % annuel, Moy. N-1, Diff N-1
- Diff colorée : vert si < -5% (amélioration), rouge si > +5% (dégradation)
- Ligne de totaux en pied de tableau
- Occupe 2 colonnes (`lg:col-span-2`)

## Server Actions (_actions/statistics-actions.ts)

| Fonction | Description |
|----------|-------------|
| `getYearlyOverview(year, accountId?)` | Agrège revenus/dépenses par mois (boucle 12 mois) |
| `getCategoryBreakdown(year, accountId?)` | `groupBy` categoryId, dépenses de l'année |
| `getSubCategoryBreakdown(year, accountId?)` | `groupBy` categoryId + subCategoryId, retourne `{ items, categories }` |
| `getCategoryYearComparison(year, month, accountId?)` | Comparaison par catégorie : mois actuel, moyenne, total annuel, N-1 |
| `getSavingsOverview(year)` | Solde cumulé des comptes épargne/investissement par mois (signe inversé) |
| `getAccounts()` | Liste des comptes pour le filtre |

## Points techniques
- Les agrégations utilisent `db.select().groupBy()` et `sql` template literals (Drizzle)
- Les montants numériques sont convertis en `number` via `toNumber()` côté serveur
- Le filtrage par compte est optionnel (si `accountId` est fourni, ajouté au `where`)
- Les données sont fetchées en parallèle dans `page.tsx` (6 appels concurrents)
- Le tri des catégories utilise `localeCompare('fr')` en JavaScript pour gérer les accents français
