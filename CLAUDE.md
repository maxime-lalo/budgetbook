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
| ORM | Prisma 6 |
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
pnpm db:generate                 # Générer le client Prisma
pnpm db:migrate                  # Appliquer les migrations
pnpm db:seed                     # Insérer données de démo
pnpm dev                         # Lancer (localhost:3000)
pnpm db:studio                   # Interface Prisma Studio

# Développement (SQLite)
DB_PROVIDER=sqlite pnpm db:setup # Générer le schéma SQLite
DB_PROVIDER=sqlite pnpm db:push  # Créer/synchroniser la base
DB_PROVIDER=sqlite pnpm db:seed  # Insérer données de démo
DB_PROVIDER=sqlite pnpm dev      # Lancer (localhost:3000)

# Production PostgreSQL (2 containers)
docker compose -f docker-compose.prod.yml up -d --build

# Production SQLite (1 seul container)
docker compose -f docker-compose.sqlite.yml up -d --build

# Build
pnpm build                       # setup-db + prisma generate + next build
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
- **Sérialisation explicite** des Decimal Prisma → number avant passage aux Client Components
- **output: standalone** pour Docker
- **Transactions récurrentes** : transactions sans date (`date: null`) avec `month`/`year` pour le rattachement budgétaire

## Structure des dossiers

```
comptes/
├── prisma/
│   ├── schema.base.prisma   # Schéma source (commité, syntaxe PostgreSQL)
│   ├── schema.prisma         # Schéma généré (gitignored)
│   ├── data/                 # Données importées (JSON BNP, catégories)
│   ├── import-data.ts        # Script d'import BNP → BDD
│   ├── extract-excel.py      # Extraction Excel → JSON
│   └── categorize.py         # Auto-catégorisation des transactions
├── scripts/
│   ├── setup-db.ts           # Génération du schéma selon DB_PROVIDER
│   └── docker-entrypoint.sh  # Entrypoint Docker (migrate ou db push)
├── src/
│   ├── app/                  # Pages (App Router)
│   │   ├── transactions/     # Vue principale mensuelle
│   │   ├── budgets/          # Budgets mensuels par catégorie
│   │   ├── categories/       # CRUD catégories/sous-catégories
│   │   ├── accounts/         # Comptes, buckets, soldes
│   │   ├── statistics/       # Graphiques Recharts
│   │   ├── settings/         # Réglages (token API)
│   │   └── api/              # API REST (transactions, categories, accounts)
│   ├── components/
│   │   ├── ui/               # Shadcn/UI (auto-généré)
│   │   └── layout/           # Sidebar, mobile-nav, theme
│   └── lib/                  # Prisma singleton, validators, formatters, hooks
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

**Workflow schéma** : `prisma/schema.base.prisma` est le fichier source (commité). Le script `scripts/setup-db.ts` génère `prisma/schema.prisma` (gitignored) en ajustant le provider et supprimant les annotations `@db.*` pour SQLite.

```
prisma/schema.base.prisma  →  scripts/setup-db.ts  →  prisma/schema.prisma (généré)
```

**Toutes les commandes Prisma** (`db:generate`, `db:migrate`, `db:push`, `build`, `postinstall`) chaînent automatiquement `setup-db.ts` avant l'exécution.

## Conventions importantes

- Les montants sont stockés en `Decimal(12,2)` (jamais de float)
- Montant positif = rentrée d'argent, négatif = dépense
- Les dates de transaction sont `@db.Date` en PostgreSQL (sans composante horaire) et **optionnelles** (`null` pour les transactions récurrentes). En SQLite, l'annotation est absente mais date-fns gère le format transparemment
- Chaque transaction a des champs `month` et `year` séparés de `date` pour le rattachement budgétaire
- `isAmex` (Boolean) marque les transactions faites via carte AMEX ; elles vivent sur le compte courant, pas sur un compte CREDIT_CARD séparé
- `onDelete: Cascade` pour Bucket/SubCategory sous leur parent
- `onDelete: Restrict` pour Transaction → Category (impossible de supprimer une catégorie utilisée par des transactions)
- `categoryId` est **requis** (non nullable) sur les transactions ; seule `subCategoryId` est optionnelle
- Tous les `Decimal` Prisma sont convertis en `number` avant d'être passés aux Client Components
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

### Navigation inter-pages
- Les cards de `/categories` et `/budgets` sont cliquables et redirigent vers `/transactions?category=<id>` avec le filtre pré-sélectionné.
- Le searchParam `category` est lu par la page transactions et passé en prop `initialCategory` au `TransactionsTable`.
