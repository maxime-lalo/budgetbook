# Database Layer — Drizzle ORM

## Fichiers

| Fichier | Description |
|---------|-------------|
| `index.ts` | Singleton dual-provider (PG/SQLite) + export de toutes les tables |
| `helpers.ts` | 7 fonctions de conversion de types (montants, dates, timestamps) |
| `seed.ts` | Script de seeding complet (catégories, comptes, buckets, transactions, budgets, monthlyBalances) |
| `schema/` | Schémas Drizzle — voir `schema/CLAUDE.md` |

## Singleton (`index.ts`)

- `provider` — Constante runtime depuis `env.DB_PROVIDER` (`"postgresql"` ou `"sqlite"`)
- `db` — Instance unique cachée sur `globalThis` (évite les instances multiples en dev)
- SQLite : active `WAL` mode + `foreign_keys = ON` via pragmas
- PostgreSQL : client postgres.js avec `env.DATABASE_URL`
- **Type bridge** : l'instance SQLite est castée en `PgDb` (structurellement compatible pour le DML)
- Exporte toutes les tables : `accounts`, `buckets`, `categories`, `subCategories`, `transactions`, `budgets`, `monthlyBalances`, `apiTokens`, `appPreferences`

## Helpers (`helpers.ts`)

| Fonction | Signature | Usage |
|----------|-----------|-------|
| `round2(n)` | `number → number` | Précision monétaire (Math.round * 100 / 100) |
| `toNumber(value)` | `string\|number\|null → number` | Coercition sûre, retourne 0 si null/undefined |
| `toDecimal(value)` | `number → string` | Pour colonnes numeric PG (toString) |
| `toDate(value)` | `Date\|string\|null → Date\|null` | Coercition Date sûre |
| `toISOString(value)` | `Date\|string\|null → string\|null` | Conversion ISO 8601 (gère dates texte SQLite) |
| `toDbTimestamp(value)` | `Date\|string → Date` | Timestamp provider-aware (ISO string pour SQLite, Date pour PG) |
| `toDbDate(value)` | `Date\|string → Date` | Date-only provider-aware ("YYYY-MM-DD" pour SQLite, Date pour PG) |

## Seed (`seed.ts`)

- Script standalone (crée sa propre instance DB, pas le singleton)
- Nettoyage dans l'ordre FK : monthlyBalances → budgets → transactions → subCategories → categories → buckets → accounts
- 14 catégories avec sous-catégories, 2 comptes, 2 buckets, 9 transactions (7 immédiates + 2 récurrentes), 7 budgets
- Pattern upsert (check exists + update) pour l'idempotence
- IDs générés via `@paralleldrive/cuid2`
- Recalcule `monthlyBalances` pour tous les mois existants
