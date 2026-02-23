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
| `transactionSchema` | `amount != 0`, `categoryId` nullable/optionnel, `date` optionnel (null si récurrent), `month`/`year` séparés, `isAmex` boolean, refine note si CANCELLED |
| `budgetSchema` | `month` 1-12, `year` 2000-2100 |
| `partialTransactionFieldSchema` | Validation partielle pour `updateTransactionField` (tous champs optionnels) |
| `comptesExportSchema` | Validation du format d'export/import complet |

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

Les tokens sont hashés en SHA-256 avant comparaison avec la BDD. La fonction `hashToken(plain)` est aussi exportée pour le hashing lors de la création.

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

### safe-action.ts
Wrapper générique pour les server actions. Catch les erreurs inattendues et les log.

| Fonction | Description |
|----------|-------------|
| `safeAction<T>(fn, errorMessage?)` | Exécute `fn()`, retourne le résultat ou `{ error: string }` en cas d'exception |

### types.ts
Types TypeScript partagés, remplaçant les types locaux définis dans 9+ composants.

| Export | Description |
|--------|-------------|
| `TRANSACTION_STATUSES` | `["PENDING", "COMPLETED", "CANCELLED", "PRÉVUE"] as const` |
| `TransactionStatus` | Union type des statuts |
| `SerializedTransaction` | Shape complète retournée par getTransactions |
| `SerializedTransfer` | Shape pour les virements (avec account.type) |
| `FormAccount` | Shape pour les formulaires (id, name, type, buckets, linkedCards) |
| `FormCategory` | Shape pour les formulaires (id, name, subCategories) |

### transaction-helpers.ts
CRUD partagé pour transactions et transferts, évitant ~150 lignes de duplication.

| Fonction | Description |
|----------|-------------|
| `insertTransaction(data, overrides?, errorMessage?)` | Validation Zod + insert + recompute + revalidate |
| `updateTransactionById(id, data, overrides?, errorMessage?)` | Validation + update + gère changement de mois |
| `deleteTransactionById(id, errorMessage?)` | Fetch year/month + delete + recompute + revalidate |

`TransactionOverrides` : `{ forceNegativeAmount?, forceIsAmex?, forceRecurring? }` -- utilisé par les transferts.

### env.ts
Validation des variables d'environnement via Zod. Exporte un objet `env` typé.

| Variable | Validation |
|----------|------------|
| `DB_PROVIDER` | `"postgresql"` ou `"sqlite"`, défaut `"postgresql"` |
| `DATABASE_URL` | string optionnel |
| `NODE_ENV` | `"development"`, `"production"`, `"test"`, défaut `"development"` |

### logger.ts
Logger structuré pour les server actions et l'API.

| Fonction | Description |
|----------|-------------|
| `logger.error(message, meta?)` | Log d'erreur avec metadata optionnelle |
| `logger.warn(message, meta?)` | Log d'avertissement |
| `logger.info(message, meta?)` | Log d'information |

### revalidate.ts
Helper de revalidation centralisé.

| Fonction | Description |
|----------|-------------|
| `revalidateTransactionPages()` | Appelle `revalidatePath` sur `/transactions`, `/transfers` et `/savings` |

### api-rate-limit.ts
Rate limiting en mémoire pour les API routes.

| Fonction | Description |
|----------|-------------|
| `checkRateLimit(ip)` | Retourne `{ allowed: boolean, remaining: number }` |

Configuration : 60 requêtes/minute par IP, max 10 000 entrées en mémoire avec éviction LRU.

### __tests__/
Tests unitaires Vitest (4 fichiers, 43 tests).

| Fichier | Tests |
|---------|-------|
| `helpers.test.ts` | toNumber, round2, toDate, toISOString (17 tests) |
| `formatters.test.ts` | formatCurrency, parseMonthParam, toMonthParam (11 tests) |
| `validators.test.ts` | transactionSchema, refines (11 tests) |
| `api-rate-limit.test.ts` | checkRateLimit (4 tests) |


<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Feb 23, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #574 | 11:13 AM | ✅ | Deployed Monthly Balance Calculation Fix | ~318 |
| #572 | " | 🔴 | Fixed Monthly Balance Calculation to Filter CHECKING Accounts Only | ~534 |
| #569 | 11:04 AM | 🔴 | Fixed Account Filtering in Monthly Balance Calculation | ~491 |
</claude-mem-context>