# lib/ — Utilitaires partagés

## Fichiers

### db/ (Drizzle ORM)
Module de base de données PostgreSQL.

- **`schema/pg.ts`** : Schéma PostgreSQL avec `pgTable`, `numeric(12,2)`, `date`, `timestamp`, `pgEnum`, relations, index. Inclut les tables `users` et `refreshTokens` pour l'authentification, avec `userId` FK sur toutes les tables de donnees
- **`index.ts`** : Singleton PostgreSQL utilisant le pattern `globalThis`. Client postgres.js avec `env.DATABASE_URL`. Exporte `db` et toutes les tables (dont `users`, `refreshTokens`)
- **`helpers.ts`** : `toNumber()` (string|number → number), `toISOString()` (Date|string → string), `toDecimal()`, `toDate()`, `getCheckingAccountIds(userId)`
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

Constantes : `ACCOUNT_TYPE_LABELS`, `STATUS_LABELS` (maps string → label français), `STATUS_COLORS` (maps statut → classe Tailwind bg), `STATUS_ORDER` (maps statut → ordre de tri), `DEFAULT_COLOR` (`"#6b7280"`), `FILTER_ALL` (`"__all__"`), `FILTER_NONE` (`"__none__"`).

### monthly-balance.ts
Gestion du report cumulatif inter-mois via la table `MonthlyBalance`.

| Fonction | Description |
|----------|-------------|
| `recomputeMonthlyBalance(year, month, userId)` | Recalcule et upsert le surplus du mois (forecast - committed) pour l'utilisateur |
| `getCarryOver(year, month, userId)` | Retourne le report cumulé = `SUM(surplus)` de tous les mois antérieurs à (year, month) pour l'utilisateur |
| `backfillAllMonthlyBalances(userId)` | Recalcule le surplus pour tous les mois distincts présents dans les transactions de l'utilisateur |

Appelée automatiquement après chaque mutation de transaction ou budget.

### api-auth.ts
Authentification des API routes REST par Bearer token.

| Fonction | Description |
|----------|-------------|
| `hashToken(token)` | Hashe un token en SHA-256 (utilisé lors de la creation et validation) |
| `validateApiToken(request)` | Lit le header `Authorization: Bearer <token>`, vérifie en BDD, retourne `string | null` (userId si valide, null sinon) |
| `unauthorizedResponse()` | Retourne `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` |

Utilisé par toutes les routes `/api/*`. Le token est stocké dans la table `api_tokens` et géré depuis `/settings`.

### auth/
Module d'authentification multi-provider (local + LDAP). Exporte depuis `index.ts`.

| Fichier | Description |
|---------|-------------|
| `password.ts` | `hashPassword(plain)`, `verifyPassword(plain, hash)` -- bcrypt/scrypt |
| `jwt.ts` | `signAccessToken(payload)`, `signRefreshToken(userId)`, `verifyAccessToken(token)`, `verifyRefreshToken(token)`. Types exportés : `AccessTokenPayload`, `RefreshTokenPayload` |
| `session.ts` | `getCurrentUser()`, `requireAuth()`, `requireAdmin()`, `requireUserId()`, `setAuthCookies(access, refresh)`, `clearAuthCookies()` |
| `ldap.ts` | `authenticateLdap(identifier, password)` -- authentification LDAP optionnelle (identifier = pseudo ou email) |
| `seed-defaults.ts` | `seedUserDefaults(userId)` -- crée les données par défaut pour un nouvel utilisateur |

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
| `TRANSACTION_STATUSES` | `["PENDING", "COMPLETED", "CANCELLED", "PLANNED"] as const` |
| `TransactionStatus` | Union type des statuts |
| `SerializedTransaction` | Shape complète retournée par getTransactions |
| `SerializedTransfer` | Shape pour les virements (avec account.type) |
| `FormAccount` | Shape pour les formulaires (id, name, type, buckets, linkedCards) |
| `FormCategory` | Shape pour les formulaires (id, name, subCategories) |

### transaction-helpers.ts
CRUD partagé pour transactions et transferts, évitant ~150 lignes de duplication.

| Fonction | Description |
|----------|-------------|
| `insertTransaction(data, userId, overrides?, errorMessage?)` | Validation Zod + insert + recompute + revalidate |
| `updateTransactionById(id, userId, data, overrides?, errorMessage?)` | Validation + update + gère changement de mois |
| `deleteTransactionById(id, userId, errorMessage?)` | Fetch year/month + delete + recompute + revalidate |

`TransactionOverrides` : `{ forceNegativeAmount?, forceIsAmex?, forceRecurring? }` -- utilisé par les transferts.

### env.ts
Validation des variables d'environnement via Zod. Exporte un objet `env` typé.

| Variable | Validation |
|----------|------------|
| `DATABASE_URL` | string optionnel |
| `NODE_ENV` | `"development"`, `"production"`, `"test"`, défaut `"development"` |
| `JWT_SECRET` | string min 32 chars (défaut dev fourni) |
| `JWT_ACCESS_EXPIRY` | string, défaut `"15m"` |
| `JWT_REFRESH_EXPIRY` | string, défaut `"7d"` |
| `LDAP_URL` | string optionnel |
| `LDAP_BIND_DN` | string optionnel |
| `LDAP_BIND_PASSWORD` | string optionnel |
| `LDAP_SEARCH_BASE` | string optionnel |
| `LDAP_SEARCH_FILTER` | string, défaut `"(uid={{identifier}})"` |
| `REGISTRATION_ENABLED` | boolean (string "true"/"false" → bool), défaut `true` |
| `LOG_LEVEL` | `"debug"` \| `"info"` \| `"warn"` \| `"error"`, optionnel (défaut: debug en dev, info en prod) |

### logger.ts
Logger structuré pour les server actions et l'API.

| Fonction | Description |
|----------|-------------|
| `logger.debug(message, meta?)` | Log de débogage (filtré par LOG_LEVEL) |
| `logger.info(message, meta?)` | Log d'information |
| `logger.warn(message, meta?)` | Log d'avertissement |
| `logger.error(message, meta?)` | Log d'erreur avec metadata optionnelle |

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
Tests unitaires Vitest (9 fichiers, 206 tests).

| Fichier | Tests |
|---------|-------|
| `helpers.test.ts` | toNumber, round2, toDate, toISOString |
| `formatters.test.ts` | formatCurrency, parseMonthParam, toMonthParam (11 tests) |
| `validators.test.ts` | transactionSchema, refines |
| `api-rate-limit.test.ts` | checkRateLimit |
| `api-auth.test.ts` | hashToken, validateApiToken, unauthorizedResponse |
| `transaction-helpers.test.ts` | insertTransaction, updateTransactionById, deleteTransactionById (40 tests) |
| `monthly-balance.test.ts` | recomputeMonthlyBalance, getCarryOver, backfillAllMonthlyBalances (25 tests) |
| `safe-action.test.ts` | safeAction wrapper |
| `logger.test.ts` | logger.debug, logger.info, logger.warn, logger.error, niveaux de log |
