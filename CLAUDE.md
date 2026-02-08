# Comptes - Application de Gestion de Finances Personnelles

## Contexte

Remplacement d'un système Excel historique (2019-2026) par une application web fullstack auto-hébergée. L'Excel utilisait une structure horizontale (mois en colonnes) avec ~22 onglets. L'app est dockerisée et déployée sur un serveur personnel derrière un reverse proxy (SSL + auth gérés en amont).

La migration Excel → BDD est un projet séparé ultérieur.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Langage | TypeScript 5, React 19 |
| Base de données | PostgreSQL 17 (dev + prod via Docker) |
| ORM | Prisma 6 |
| Validation | Zod 4 |
| UI | Shadcn/UI + Tailwind CSS 4 + Radix UI |
| Graphiques | Recharts 3 |
| Icônes | Lucide React |
| Notifications | Sonner |
| Thème | next-themes (dark/light/system) |
| Dates | date-fns (locale fr) |
| Monnaie | Intl.NumberFormat (EUR, fr-FR) |
| Package manager | pnpm (workspace monorepo-ready) |
| Conteneurisation | Docker multi-stage + Docker Compose |

## Commandes

```bash
# Développement
docker compose up -d db          # Démarrer PostgreSQL
pnpm install                     # Installer les dépendances
pnpm db:generate                 # Générer le client Prisma
pnpm db:migrate                  # Appliquer les migrations
pnpm db:seed                     # Insérer données de démo
pnpm dev                         # Lancer (localhost:3000)
pnpm db:studio                   # Interface Prisma Studio

# Production
docker compose -f docker-compose.prod.yml up -d --build

# Build
pnpm build                       # prisma generate + next build
pnpm lint                        # ESLint
```

## Architecture

- **Server Actions** pour toutes les mutations (pas d'API routes)
- **`_components/` et `_actions/`** co-localisés par route
- **Navigation mensuelle** via searchParams URL (`?month=2026-02`)
- **Sérialisation explicite** des Decimal Prisma → number avant passage aux Client Components
- **output: standalone** pour Docker

## Structure des dossiers

```
comptes/
├── prisma/                  # Schéma, migrations, seed
├── src/
│   ├── app/                 # Pages (App Router)
│   │   ├── transactions/    # Vue principale mensuelle
│   │   ├── budgets/         # Budgets mensuels par catégorie
│   │   ├── categories/      # CRUD catégories/sous-catégories
│   │   ├── accounts/        # Comptes, buckets, soldes
│   │   └── statistics/      # Graphiques Recharts
│   ├── components/
│   │   ├── ui/              # Shadcn/UI (auto-généré)
│   │   └── layout/          # Sidebar, mobile-nav, theme
│   └── lib/                 # Prisma singleton, validators, formatters, hooks
├── docker-compose.yml       # Dev : Postgres seul
├── docker-compose.prod.yml  # Prod : App + Postgres
└── Dockerfile               # Multi-stage standalone
```

## Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://comptes:comptes_dev@localhost:5432/comptes` |
| `DB_PASSWORD` | Mot de passe DB prod | (dans docker-compose.prod.yml) |

## Conventions importantes

- Les montants sont stockés en `Decimal(12,2)` (jamais de float)
- Montant positif = rentrée d'argent, négatif = dépense
- Les dates de transaction sont `@db.Date` (sans composante horaire)
- `onDelete: Cascade` pour Bucket/SubCategory sous leur parent
- `onDelete: Restrict` pour Transaction → Category (impossible de supprimer une catégorie utilisée par des transactions)
- `categoryId` est **requis** (non nullable) sur les transactions ; seule `subCategoryId` est optionnelle
- Tous les `Decimal` Prisma sont convertis en `number` avant d'être passés aux Client Components
- Les formulaires utilisent `FormData` (categories, accounts) ou objets JSON (transactions)

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
