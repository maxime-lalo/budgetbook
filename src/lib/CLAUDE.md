# lib/ — Utilitaires partagés

## Fichiers

### db/ (Drizzle ORM)
Module de base de données dual-provider (PostgreSQL / SQLite).

- **`schema/pg.ts`** : Schéma PostgreSQL avec `pgTable`, `numeric(12,2)`, `date`, `timestamp`, `pgEnum`, relations, index
- **`schema/sqlite.ts`** : Schéma SQLite avec `sqliteTable`, `real`, `text`, `integer({ mode: "boolean" })`, relations
- **`index.ts`** : Singleton dual-provider utilisant le pattern `globalThis`. Lit `DB_PROVIDER` au runtime pour choisir le driver (postgres.js ou better-sqlite3). Exporte `db` et toutes les tables.
- **`helpers.ts`** : `toNumber()` (string|number → number), `toISOString()` (Date|string → string), `toDecimal()`, `toDate()`
- **`seed.ts`** : Script de seed standalone (14 catégories, 2 comptes, buckets, transactions d'exemple)

```typescript
import { db, accounts, transactions } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { toNumber } from "@/lib/db/helpers";
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
| `transactionSchema` | `amount != 0`, `categoryId` requis, `date` optionnel (null si récurrent), `month`/`year` séparés, `isAmex` boolean, refine note si CANCELLED |
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

### api-auth.ts
Authentification des API routes REST par Bearer token.

| Fonction | Description |
|----------|-------------|
| `validateApiToken(request)` | Lit le header `Authorization: Bearer <token>`, vérifie en BDD, retourne `boolean` |
| `unauthorizedResponse()` | Retourne `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` |

Utilisé par toutes les routes `/api/*`. Le token est stocké dans la table `api_tokens` et géré depuis `/settings`.

### utils.ts
Fonction `cn()` : merge de classes Tailwind via `clsx` + `twMerge` (standard Shadcn/UI).

## hooks/

### use-month-navigation.ts
Hook React pour la navigation mensuelle par URL searchParams avec **persistance localStorage**.

**Retourne** :
- `year`, `month` : mois courant parsé depuis l'URL
- `monthParam` : format string `"2026-02"`
- `previousMonth()`, `nextMonth()` : navigation M-1 / M+1
- `navigateToMonth(year, month)` : navigation directe

**Comportement** :
- Lit le searchParam `?month=` de l'URL
- Si pas de searchParam mais localStorage contient un mois, redirige automatiquement
- Persiste le mois sélectionné dans localStorage à chaque navigation

**Utilisé par** : `MonthNavigator` (transactions et budgets).
