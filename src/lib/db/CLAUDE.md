# Database Layer — Drizzle ORM

## Fichiers

| Fichier | Description |
|---------|-------------|
| `index.ts` | Singleton PostgreSQL + export de toutes les tables |
| `helpers.ts` | 8 fonctions de conversion de types et requêtes utilitaires |
| `seed.ts` | Script de seeding complet (catégories, comptes, buckets, transactions, budgets, monthlyBalances) |
| `schema/` | Schémas Drizzle — voir `schema/CLAUDE.md` |

## Singleton (`index.ts`)

- `db` — Instance unique cachée sur `globalThis` (évite les instances multiples en dev)
- PostgreSQL : client postgres.js avec `env.DATABASE_URL`
- Exporte toutes les tables : `users`, `refreshTokens`, `accounts`, `buckets`, `categories`, `subCategories`, `transactions`, `budgets`, `monthlyBalances`, `apiTokens`, `appPreferences`

## Helpers (`helpers.ts`)

| Fonction | Signature | Usage |
|----------|-----------|-------|
| `round2(n)` | `number → number` | Précision monétaire (Math.round * 100 / 100) |
| `toNumber(value)` | `string\|number\|null → number` | Coercition sûre, retourne 0 si null/undefined |
| `toDecimal(value)` | `number → string` | Pour colonnes numeric PG (toString) |
| `toDate(value)` | `Date\|string\|null → Date\|null` | Coercition Date sûre |
| `toISOString(value)` | `Date\|string\|null → string\|null` | Conversion ISO 8601 |
| `toDbTimestamp(value)` | `Date\|string → Date` | Conversion en Date pour colonnes PG timestamp |
| `toDbDate(value)` | `Date\|string → Date` | Conversion en Date pour colonnes PG date |
| `getCheckingAccountIds(userId)` | `string → Promise<string[]>` | Retourne les IDs des comptes CHECKING de l'utilisateur |

## Seed (`seed.ts`)

- Script standalone (crée sa propre instance DB, pas le singleton)
- Nettoyage dans l'ordre FK : monthlyBalances → budgets → transactions → subCategories → categories → buckets → accounts
- 14 catégories avec sous-catégories, 2 comptes, 2 buckets, 9 transactions (7 immédiates + 2 récurrentes), 7 budgets
- Pattern upsert (check exists + update) pour l'idempotence
- IDs générés via `@paralleldrive/cuid2`
- Recalcule `monthlyBalances` pour tous les mois existants
