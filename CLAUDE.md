# Comptes - Application de Gestion de Finances Personnelles

## Contexte

Remplacement d'un système Excel historique (2019-2026) par une application web fullstack auto-hébergée. L'Excel utilisait une structure horizontale (mois en colonnes) avec ~22 onglets. L'app est dockerisée et déployée sur un serveur personnel derrière un reverse proxy (SSL + auth gérés en amont).

La migration Excel → BDD est un projet séparé ultérieur.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Langage | TypeScript 5, React 19 |
| Base de données | PostgreSQL 17 ou SQLite (via `DB_PROVIDER`) |
| ORM | Drizzle ORM (dual PostgreSQL / SQLite) |
| Validation | Zod 4 |
| UI | Shadcn/UI + Tailwind CSS 4 + Radix UI |
| Graphiques | Recharts 2 |
| Icônes | Lucide React |
| Notifications | Sonner |
| Thème | next-themes (dark/light/system) |
| Dates | date-fns (locale fr) |
| Monnaie | Intl.NumberFormat (EUR, fr-FR) |
| Package manager | pnpm (workspace monorepo-ready) |
| Conteneurisation | Docker multi-stage + Docker Compose |

## Commandes

```bash
# Développement (PostgreSQL — par défaut)
docker compose up -d db          # Démarrer PostgreSQL
pnpm install                     # Installer les dépendances
pnpm db:push                     # Pousser le schéma en BDD
pnpm db:seed                     # Insérer données de démo
pnpm dev                         # Lancer (localhost:3000)
pnpm db:studio                   # Interface Drizzle Studio

# Développement (SQLite)
DB_PROVIDER=sqlite pnpm db:push  # Créer/synchroniser la base
DB_PROVIDER=sqlite pnpm db:seed  # Insérer données de démo
DB_PROVIDER=sqlite pnpm dev      # Lancer (localhost:3000)

# Production PostgreSQL (2 containers)
docker compose -f docker-compose.prod.yml up -d --build

# Production SQLite (1 seul container)
docker compose -f docker-compose.sqlite.yml up -d --build

# Build
pnpm build                       # next build
pnpm lint                        # ESLint

# Import de données
pnpm db:extract                  # Extraire transactions depuis Excel (Python)
pnpm db:import                   # Importer transactions en BDD (tsx)
```

## Architecture

- **Server Actions** pour toutes les mutations (pas d'API routes REST côté UI)
- **API REST** (`/api/*`) pour les intégrations externes (Tasker/n8n), sécurisée par Bearer token
- **`_components/` et `_actions/`** co-localisés par route
- **Navigation mensuelle** via searchParams URL (`?month=2026-02`) avec persistance localStorage
- **Sérialisation explicite** des montants (numeric/string) → number avant passage aux Client Components
- **output: standalone** pour Docker
- **Transactions récurrentes** : transactions sans date (`date: null`) avec `month`/`year` pour le rattachement budgétaire

## Structure des dossiers

```
comptes/
├── prisma/
│   ├── data/                 # Données importées (JSON BNP, catégories)
│   ├── import-data.ts        # Script d'import BNP → BDD
│   ├── extract-excel.py      # Extraction Excel → JSON
│   └── categorize.py         # Auto-catégorisation des transactions
├── scripts/
│   └── docker-entrypoint.sh  # Entrypoint Docker (drizzle-kit push)
├── src/
│   ├── app/                  # Pages (App Router)
│   │   ├── transactions/     # Vue principale mensuelle
│   │   ├── transfers/        # Virements inter-comptes
│   │   ├── budgets/          # Budgets mensuels par catégorie
│   │   ├── categories/       # CRUD catégories/sous-catégories
│   │   ├── accounts/         # Comptes, buckets, soldes
│   │   ├── statistics/       # Graphiques Recharts
│   │   ├── settings/         # Réglages (token API)
│   │   └── api/              # API REST (transactions, categories, accounts)
│   ├── components/
│   │   ├── ui/               # Shadcn/UI (auto-généré)
│   │   └── layout/           # Sidebar, mobile-nav, theme
│   └── lib/
│       ├── db/               # Drizzle ORM (schéma, singleton, helpers)
│       │   ├── schema/pg.ts  # Schéma PostgreSQL (pgTable, numeric, pgEnum)
│       │   ├── schema/sqlite.ts # Schéma SQLite (sqliteTable, real, text)
│       │   ├── index.ts      # Singleton dual-provider (lit DB_PROVIDER)
│       │   ├── helpers.ts    # toNumber(), toISOString()
│       │   └── seed.ts       # Données de démo
│       ├── validators.ts     # Schémas Zod
│       ├── formatters.ts     # Formatage monnaie, dates
│       ├── monthly-balance.ts # Report cumulatif inter-mois
│       ├── api-auth.ts       # Validation Bearer token
│       └── hooks/            # React hooks custom
├── drizzle.config.ts         # Config Drizzle Kit (conditionnel PG/SQLite)
├── docker-compose.yml        # Dev : Postgres seul
├── docker-compose.prod.yml   # Prod : App + Postgres (2 containers)
├── docker-compose.sqlite.yml # Prod : App seule avec SQLite (1 container)
└── Dockerfile                # Multi-stage standalone (dual provider)
```

## Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DB_PROVIDER` | Provider BDD : `postgresql` (défaut) ou `sqlite` | `sqlite` |
| `DATABASE_URL` | URL de connexion BDD | `postgresql://...` ou `file:./dev.db` |
| `DB_PASSWORD` | Mot de passe DB prod | (dans docker-compose.prod.yml) |

## Database Provider (PostgreSQL / SQLite)

L'app supporte deux providers via `DB_PROVIDER` :
- **`postgresql`** (défaut) : déploiement classique avec 2 containers Docker
- **`sqlite`** : déploiement en 1 seul container avec un fichier `.db` (idéal pour backup simple)

**Architecture Drizzle** : deux fichiers de schéma (`src/lib/db/schema/pg.ts` et `src/lib/db/schema/sqlite.ts`) avec les mêmes tables/colonnes mais des types adaptés au dialecte. Le singleton `src/lib/db/index.ts` choisit le provider au **runtime** via `DB_PROVIDER`. Une seule image Docker suffit pour les deux providers.

## Conventions importantes

- Les montants sont stockés en `numeric(12,2)` (PG) / `real` (SQLite)
- Montant positif = rentrée d'argent, négatif = dépense (les virements sont toujours négatifs côté source)
- Les dates de transaction sont `date` en PostgreSQL (sans composante horaire) et **optionnelles** (`null` pour les transactions récurrentes). En SQLite, stockées en `text`
- Chaque transaction a des champs `month` et `year` séparés de `date` pour le rattachement budgétaire
- `isAmex` (Boolean) marque les transactions faites via carte AMEX ; elles vivent sur le compte courant, pas sur un compte CREDIT_CARD séparé
- `onDelete: Cascade` pour Bucket/SubCategory sous leur parent
- `onDelete: Restrict` pour Transaction → Category (impossible de supprimer une catégorie utilisée par des transactions)
- `categoryId` est **requis** (non nullable) sur les transactions ; seule `subCategoryId` est optionnelle
- Les montants numériques (string en PG, number en SQLite) sont convertis via `toNumber()` avant passage aux Client Components
- Les formulaires utilisent `FormData` (categories, accounts) ou objets JSON (transactions)

## API REST externe

API REST sécurisée par Bearer token pour les intégrations externes (Tasker → n8n → API). Le token est stocké en BDD (table `api_tokens`), géré depuis la page `/settings`.

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/transactions` | POST | Créer une transaction |
| `/api/categories` | GET | Lister catégories + sous-catégories |
| `/api/accounts` | GET | Lister les comptes |

- Authentification : header `Authorization: Bearer <token>`
- Sans token valide → 401 Unauthorized
- L'utilitaire `src/lib/api-auth.ts` centralise la validation du token
- POST `/api/transactions` : `categoryId` requis, `date`/`accountId`/`status` ont des valeurs par défaut
- En production derrière Authelia, ajouter une règle bypass pour `/api/` (policy: bypass)

## Logique financière inter-pages

### Report cumulatif de mois via MonthlyBalance
Le report de mois est désormais **cumulatif** grâce à la table `MonthlyBalance`. Chaque mois a un surplus matérialisé :
```
surplus(M) = forecast(M) − Σ max(budgété, dépensé) par catégorie
```
Le report pour un mois M = `SUM(surplus)` de tous les mois antérieurs (via `getCarryOver()`).

- `forecast` = somme de toutes les transactions COMPLETED + PENDING du mois
- Pour chaque catégorie : `max(budgété, dépensé)` — réserve le budget même si pas encore consommé
- La table `MonthlyBalance` est mise à jour automatiquement après chaque mutation de transaction ou budget (via `recomputeMonthlyBalance()`)
- `getPreviousMonthBudgetRemaining()` délègue à `getCarryOver()` (report cumulé, pas juste M-1)
- Ce report apparaît en première ligne du tableau des transactions et est inclus dans le "Total actuel" de la TotalsBar
- Sur la page budgets, le "Total restant" inclut le carry-over des mois précédents

### Virements inter-comptes
Les transferts entre comptes utilisent le champ `destinationAccountId` (nullable) sur la table `transactions`. Un seul enregistrement par transfert, `amount` toujours négatif côté source. La page `/transfers` offre un formulaire épuré (source → destination → montant) et un historique en cards. Les mutations depuis `/transfers` invalident aussi `/transactions` et `/savings`, et inversement.

### Navigation inter-pages
- Les cards de `/categories` et `/budgets` sont cliquables et redirigent vers `/transactions?category=<id>` avec le filtre pré-sélectionné.
- Le searchParam `category` est lu par la page transactions et passé en prop `initialCategory` au `TransactionsTable`.
