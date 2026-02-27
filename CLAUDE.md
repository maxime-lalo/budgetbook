# Comptes - Application de Gestion de Finances Personnelles

## Contexte

Remplacement d'un système Excel historique (2019-2026) par une application web fullstack auto-hébergée. L'Excel utilisait une structure horizontale (mois en colonnes) avec ~22 onglets. L'app est dockerisée et déployée sur un serveur personnel derrière un reverse proxy (SSL géré en amont).

Application **multi-utilisateurs** avec authentification propre (locale + LDAP), isolation totale des données par utilisateur, et panel admin.

La migration Excel → BDD est un projet séparé ultérieur.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Langage | TypeScript 5, React 19 |
| Base de données | PostgreSQL 17 |
| ORM | Drizzle ORM (PostgreSQL) |
| Auth | JWT via jose (Edge-compatible) + bcryptjs |
| LDAP | ldapjs (optionnel) |
| Validation | Zod 4 |
| UI | Shadcn/UI + Tailwind CSS 4 + Radix UI |
| Graphiques | Recharts 2 |
| Icônes | Lucide React |
| Notifications | Sonner |
| Thème | next-themes (dark/light/system) |
| Dates | date-fns (locale fr) |
| Monnaie | Intl.NumberFormat (EUR, fr-FR) |
| Package manager | pnpm (workspace monorepo-ready) |
| Tests | Vitest 3 |
| Conteneurisation | Docker multi-stage + Docker Compose |

## Commandes

```bash
# Développement
docker compose up -d db          # Démarrer PostgreSQL
pnpm install                     # Installer les dépendances
pnpm db:push                     # Pousser le schéma en BDD
pnpm db:seed                     # Insérer données de démo (admin@comptes.local / admin)
pnpm dev                         # Lancer (localhost:3000)
pnpm db:studio                   # Interface Drizzle Studio

# Production (2 containers)
JWT_SECRET=<min-32-chars> docker compose -f docker-compose.prod.yml up -d --build

# Build
pnpm build                       # next build
pnpm lint                        # ESLint

# Tests
pnpm test                        # Vitest (watch mode)
pnpm test:run                    # Vitest (run once, CI)

# Import de données
pnpm db:extract                  # Extraire transactions depuis Excel (Python)
pnpm db:import                   # Importer transactions en BDD (tsx)
```

## Architecture

- **Multi-utilisateurs** : chaque table de données a un `userId` (FK → users), isolation complète
- **Authentification** : JWT (access_token 15min + refresh_token 7j) stockés en cookies httpOnly
- **LDAP optionnel** : si `LDAP_URL` est configuré, l'auth LDAP est tentée en premier
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
│   ├── proxy.ts              # Middleware auth + sécurité (JWT, headers)
│   ├── app/                  # Pages (App Router)
│   │   ├── (auth)/           # Pages auth (login, register) — layout sans sidebar
│   │   ├── admin/            # Panel admin (gestion utilisateurs)
│   │   ├── error.tsx         # Error boundary
│   │   ├── global-error.tsx  # Global error boundary
│   │   ├── not-found.tsx     # Page 404
│   │   ├── loading.tsx       # Loading skeleton
│   │   ├── transactions/     # Vue principale mensuelle
│   │   ├── transfers/        # Virements inter-comptes
│   │   ├── budgets/          # Budgets mensuels par catégorie
│   │   ├── categories/       # CRUD catégories/sous-catégories
│   │   ├── accounts/         # Comptes, buckets, soldes
│   │   ├── statistics/       # Graphiques Recharts
│   │   ├── settings/         # Réglages (token API, préférences)
│   │   └── api/              # API REST (transactions, categories, accounts, auth/refresh)
│   ├── components/
│   │   ├── ui/               # Shadcn/UI (auto-généré)
│   │   └── layout/           # Sidebar, mobile-nav, theme, user-provider
│   └── lib/
│       ├── auth/             # Authentification (JWT, password, LDAP, session)
│       │   ├── jwt.ts         # sign/verify access & refresh tokens (jose)
│       │   ├── password.ts    # hash/verify passwords (bcryptjs)
│       │   ├── ldap.ts        # LDAP authentication (optionnel)
│       │   ├── session.ts     # getCurrentUser, requireAuth, requireAdmin, cookies
│       │   ├── seed-defaults.ts # Données par défaut pour les nouveaux utilisateurs
│       │   └── index.ts       # Re-exports
│       ├── db/               # Drizzle ORM (schéma, singleton, helpers)
│       │   ├── schema/pg.ts   # Schéma PostgreSQL (users, refreshTokens, + data tables)
│       │   ├── index.ts       # Singleton PostgreSQL
│       │   ├── helpers.ts     # toNumber(), toISOString(), round2(), getCheckingAccountIds(userId)
│       │   └── seed.ts        # Données de démo (admin + catégories + transactions)
│       ├── __tests__/         # Tests unitaires (Vitest)
│       ├── validators.ts      # Schémas Zod (toute la validation)
│       ├── types.ts           # Types TypeScript partagés (AuthUser, SerializedTransaction, etc.)
│       ├── formatters.ts      # Formatage monnaie, dates, labels
│       ├── safe-action.ts     # Wrapper try/catch pour server actions
│       ├── transaction-helpers.ts # CRUD partagé transactions/transferts (avec userId)
│       ├── monthly-balance.ts # Report cumulatif inter-mois (avec userId)
│       ├── api-auth.ts        # Validation Bearer token → userId + hashage SHA-256
│       ├── api-rate-limit.ts  # Rate limiting (60/min par IP)
│       ├── env.ts             # Validation variables d'environnement (Zod)
│       ├── logger.ts          # Logger structuré (error/warn/info)
│       ├── revalidate.ts      # revalidateTransactionPages()
│       ├── utils.ts           # cn() pour Tailwind
│       └── hooks/             # React hooks custom
├── drizzle.config.ts         # Config Drizzle Kit (PostgreSQL)
├── docker-compose.yml        # Dev : Postgres seul
├── docker-compose.prod.yml   # Prod : App + Postgres (2 containers)
└── Dockerfile                # Multi-stage standalone
```

## Variables d'environnement

| Variable | Description | Requis | Exemple |
|----------|-------------|--------|---------|
| `DATABASE_URL` | URL de connexion PostgreSQL | Oui | `postgresql://comptes:pwd@localhost:5432/comptes` |
| `JWT_SECRET` | Secret JWT (min 32 chars) | Oui | `super-secret-key-at-least-32-chars` |
| `JWT_ACCESS_EXPIRY` | Durée access token | Non (défaut "15m") | `"15m"` |
| `JWT_REFRESH_EXPIRY` | Durée refresh token | Non (défaut "7d") | `"7d"` |
| `DB_PASSWORD` | Mot de passe DB prod | Prod seulement | (dans docker-compose.prod.yml) |
| `LDAP_URL` | URL du serveur LDAP | Non | `ldap://ldap.example.com` |
| `LDAP_BIND_DN` | DN de bind LDAP | Non | `cn=admin,dc=example,dc=com` |
| `LDAP_BIND_PASSWORD` | Mot de passe bind LDAP | Non | - |
| `LDAP_SEARCH_BASE` | Base de recherche LDAP | Non | `ou=users,dc=example,dc=com` |
| `LDAP_SEARCH_FILTER` | Filtre de recherche LDAP | Non | `(uid={{identifier}})` |

## Authentification

### Flow d'authentification
1. **Register** (`/register`) : crée un user + `seedUserDefaults()` (14 catégories, 2 comptes, préférences) + tokens JWT
2. **Login** (`/login`) : tente LDAP d'abord (si configuré), puis auth locale (bcrypt). Crée des tokens JWT.
3. **Middleware** (`proxy.ts`, Edge Runtime) : vérifie le `access_token` JWT. Si expiré → redirect `/api/auth/refresh?returnTo=...`. Si absent → redirect `/login`.
4. **Refresh** (`/api/auth/refresh`, Node.js) : vérifie le `refresh_token` JWT + hash en BDD → nouveau access token → redirect.
5. **Logout** : supprime cookies + refresh token en BDD → redirect `/login`.

### Tables auth
- **`users`** : id, email (unique), name, passwordHash (nullable pour LDAP), authProvider ("local"|"ldap"), isAdmin, timestamps
- **`refreshTokens`** : id, userId (FK CASCADE), tokenHash (unique), expiresAt, createdAt

### Pattern dans les server actions
```typescript
const user = await requireAuth(); // redirect /login si non connecté
// Toutes les requêtes DB sont scopées par user.id :
const data = await db.query.table.findMany({ where: eq(table.userId, user.id) });
```

### Rôle admin
- `requireAdmin()` : vérifie `isAdmin` ou throw 403
- Page `/admin` : liste des utilisateurs, stats, gestion (toggle admin, suppression)
- Lien "Admin" visible dans la sidebar uniquement pour les admins

## Conventions importantes

- Les montants sont stockés en `numeric(12,2)` (string en PG)
- Montant positif = rentrée d'argent, négatif = dépense (les virements sont toujours négatifs côté source)
- Les dates de transaction sont `date` en PostgreSQL (sans composante horaire) et **optionnelles** (`null` pour les transactions récurrentes)
- Chaque transaction a des champs `month` et `year` séparés de `date` pour le rattachement budgétaire
- `isAmex` (Boolean) marque les transactions faites via carte AMEX ; elles vivent sur le compte courant, pas sur un compte CREDIT_CARD séparé
- `onDelete: Cascade` pour Bucket/SubCategory sous leur parent, et pour toutes les FK userId → users
- `onDelete: Restrict` pour Transaction → Category (impossible de supprimer une catégorie utilisée par des transactions)
- `categoryId` est nullable sur les transactions (optionnel pour les virements) ; seule les transactions UI le requièrent via Zod
- Les montants numériques (string en PG) sont convertis via `toNumber()` avant passage aux Client Components
- Les formulaires utilisent `FormData` (categories, accounts) ou objets JSON (transactions)
- `buckets` n'a PAS de `userId` (scopé via account)

## Conventions architecturales

- **`safeAction`** : toutes les mutations server actions sont wrappées avec `safeAction()` de `src/lib/safe-action.ts` qui catch les erreurs inattendues, les log via `logger`, et retourne `{ error: string }`
- **Types partagés** : les types `AuthUser`, `SerializedTransaction`, `FormAccount`, `FormCategory` etc. sont centralisés dans `src/lib/types.ts` (pas de types locaux dans les composants)
- **CRUD partagé** : `src/lib/transaction-helpers.ts` centralise `insertTransaction(data, userId, overrides?, errorMessage?)`, `updateTransactionById(id, userId, data, overrides?, errorMessage?)`, `deleteTransactionById(id, userId, errorMessage?)` — utilisé par `transaction-actions.ts` et `transfer-actions.ts` (avec `TransactionOverrides` pour les virements)
- **Revalidation** : `revalidateTransactionPages()` de `src/lib/revalidate.ts` invalide `/transactions`, `/transfers` et `/savings` en un appel
- **Pattern erreur** : les composants client utilisent `"error" in result` (pas `result.error`) pour le narrowing TypeScript sur les retours de server actions
- **FK constraints** : définies via `foreignKey()` au niveau table (pas `.references()` sur les colonnes) pour éviter un bug d'inférence de types Drizzle ORM (#4308)
- **Edge Runtime** : `jose` fonctionne en Edge (middleware/proxy.ts). `bcryptjs` et `ldapjs` sont Node.js only → utilisés uniquement dans les server actions, jamais dans le proxy.
- **UserProvider** : React context (`src/components/layout/user-provider.tsx`) fournissant `AuthUser` aux client components via `useUser()` / `useRequiredUser()`

## API REST externe

API REST sécurisée par Bearer token pour les intégrations externes (Tasker → n8n → API). Le token est stocké en BDD (table `api_tokens`), géré depuis la page `/settings`. Chaque token est associé à un `userId`.

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/transactions` | POST | Créer une transaction |
| `/api/categories` | GET | Lister catégories + sous-catégories |
| `/api/accounts` | GET | Lister les comptes |

- Authentification : header `Authorization: Bearer <token>`
- `validateApiToken()` retourne le `userId` associé au token (ou `null`)
- Sans token valide → 401 Unauthorized
- POST `/api/transactions` : `categoryId` requis, `date`/`accountId`/`status` ont des valeurs par défaut
- POST `/api/transactions` : `status` accepte aussi `PRÉVUE` (en plus de PENDING, COMPLETED, CANCELLED)
- **Rate limiting** : 60 requêtes/minute par IP via `src/lib/api-rate-limit.ts`
- **Hashage tokens** : les tokens sont hashés en SHA-256 avant stockage en BDD ; seul le préfixe (8 chars) est visible dans l'UI

## Logique financière inter-pages

### Report cumulatif de mois via MonthlyBalance
Le report de mois est désormais **cumulatif** grâce à la table `MonthlyBalance`. Chaque mois a un surplus matérialisé :
```
surplus(M) = forecast(M) − Σ max(budgété, dépensé) par catégorie
```
Le report pour un mois M = `SUM(surplus)` de tous les mois antérieurs (via `getCarryOver(year, month, userId)`).

- `forecast` = somme de toutes les transactions COMPLETED + PENDING du mois
- Pour chaque catégorie : `max(budgété, dépensé)` — réserve le budget même si pas encore consommé
- La table `MonthlyBalance` est mise à jour automatiquement après chaque mutation de transaction ou budget (via `recomputeMonthlyBalance(year, month, userId)`)
- `getPreviousMonthBudgetRemaining()` délègue à `getCarryOver()` (report cumulé, pas juste M-1)
- Ce report apparaît en première ligne du tableau des transactions et est inclus dans le "Total actuel" de la TotalsBar
- Sur la page budgets, le "Total restant" inclut le carry-over des mois précédents

### Virements inter-comptes
Les transferts entre comptes utilisent le champ `destinationAccountId` (nullable) sur la table `transactions`. Un seul enregistrement par transfert, `amount` toujours négatif côté source. La page `/transfers` offre un formulaire épuré (source → destination → montant) et un historique en cards. Les mutations depuis `/transfers` invalident aussi `/transactions` et `/savings`, et inversement.

### Navigation inter-pages
- Les cards de `/categories` et `/budgets` sont cliquables et redirigent vers `/transactions?category=<id>` avec le filtre pré-sélectionné.
- Le searchParam `category` est lu par la page transactions et passé en prop `initialCategory` au `TransactionsTable`.
