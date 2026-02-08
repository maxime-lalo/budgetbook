# lib/ — Utilitaires partagés

## Fichiers

### prisma.ts
Singleton Prisma Client utilisant le pattern `globalThis` pour éviter les connexions multiples en développement (hot reload).

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
```

### validators.ts
Schémas Zod 4 centralisés pour toutes les entités. Conventions :
- `z.coerce.number()` pour les champs FormData (string → number)
- `z.preprocess()` pour transformer `""` en `null` (champs numériques optionnels comme `bucket.goal`)
- `.refine()` pour les contraintes cross-field (note obligatoire si transaction CANCELLED)
- Messages d'erreur en français

| Schéma | Particularités |
|--------|---------------|
| `accountSchema` | `type` = enum 4 valeurs, `linkedAccountId` optionnel |
| `bucketSchema` | `goal` = preprocess `""` → `null`, puis `number.nonnegative().nullable()` |
| `categorySchema` | Basique (nom, couleur, icône, ordre) |
| `subCategorySchema` | `categoryId` requis |
| `transactionSchema` | `amount != 0`, `categoryId` requis, `date` coercé en Date, refine note si CANCELLED |
| `budgetSchema` | `month` 1-12, `year` 2000-2100 |

Types exportés : `AccountInput`, `BucketInput`, `CategoryInput`, `SubCategoryInput`, `TransactionInput`, `BudgetInput`.

### formatters.ts
Fonctions de formatage avec locale française :

| Fonction | Description |
|----------|-------------|
| `formatCurrency(amount)` | `Intl.NumberFormat` EUR/fr-FR |
| `formatDate(date)` | `dd MMM yyyy` (ex: "15 janv. 2026") |
| `formatMonthYear(date)` | `MMMM yyyy` (ex: "janvier 2026") |
| `parseMonthParam(month?)` | Parse `"2026-02"` → `{ year: 2026, month: 2 }`, défaut = mois courant |
| `toMonthParam(year, month)` | Inverse : `(2026, 2)` → `"2026-02"` |

Constantes : `ACCOUNT_TYPE_LABELS`, `STATUS_LABELS` (maps string → label français).

### monthly-balance.ts
Gestion du report cumulatif inter-mois via la table `MonthlyBalance`.

| Fonction | Description |
|----------|-------------|
| `recomputeMonthlyBalance(year, month)` | Recalcule et upsert le surplus du mois (forecast - committed) |
| `getCarryOver(year, month)` | Retourne le report cumulé = `SUM(surplus)` de tous les mois antérieurs à (year, month) |
| `backfillAllMonthlyBalances()` | Recalcule le surplus pour tous les mois distincts présents dans les transactions |

Appelée automatiquement après chaque mutation de transaction ou budget.

### utils.ts
Fonction `cn()` : merge de classes Tailwind via `clsx` + `twMerge` (standard Shadcn/UI).

## hooks/

### use-month-navigation.ts
Hook React pour la navigation mensuelle par URL searchParams.

**Retourne** :
- `year`, `month` : mois courant parsé depuis l'URL
- `monthParam` : format string `"2026-02"`
- `previousMonth()`, `nextMonth()` : navigation M-1 / M+1
- `navigateToMonth(year, month)` : navigation directe

**Utilisé par** : `MonthNavigator` (transactions et budgets).
