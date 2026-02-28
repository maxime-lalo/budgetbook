# Schema Drizzle ORM (PostgreSQL)

Un seul fichier de schéma (`pg.ts`) pour PostgreSQL.

## Architecture

- **Tables** : définies avec `pgTable`
- **Relations** : définies inline via `relations()` de drizzle-orm (pas de fichier partagé -- nécessaire pour l'inférence de types Drizzle)
- **FK constraints** : définies via `foreignKey()` au niveau table (pas `.references()` sur les colonnes -- bug Drizzle #4308 qui casse l'inférence de types des `one()` relations)
- **Index** : composites pour les requêtes fréquentes (year+month+status, accountId+status, etc.)
- **Multi-user** : toutes les tables de donnees ont une colonne `userId` (FK vers `users.id`, onDelete CASCADE)

## Tables

| Table | Description | PK |
|-------|-------------|-----|
| `users` | Utilisateurs (email unique, name, passwordHash, authProvider, isAdmin) | text id |
| `refreshTokens` | Refresh tokens JWT hashés (tokenHash, expiresAt) | text id |
| `accounts` | Comptes bancaires (CHECKING, CREDIT_CARD, SAVINGS, INVESTMENT) | text id |
| `buckets` | Sous-comptes d'épargne (goal, baseAmount) | text id |
| `categories` | Catégories de dépenses (name unique par user, color) | text id |
| `subCategories` | Sous-catégories (lié à category) | text id |
| `transactions` | Transactions financières (montant, date, statut, etc.) | text id |
| `budgets` | Budgets mensuels par catégorie | text id |
| `monthlyBalances` | Surplus mensuel matérialisé (forecast, committed, surplus) | text id |
| `apiTokens` | Tokens API hashés (token SHA-256, tokenPrefix 8 chars) | text id |
| `appPreferences` | Préférences app (amexEnabled, separateRecurring) -- une par user | text id |

## FK Constraints (via foreignKey() table-level)

| Source | Target | onDelete |
|--------|--------|----------|
| refreshTokens.userId | users.id | CASCADE |
| accounts.userId | users.id | CASCADE |
| accounts.linkedAccountId | accounts.id | SET NULL |
| buckets.accountId | accounts.id | CASCADE |
| categories.userId | users.id | CASCADE |
| subCategories.userId | users.id | CASCADE |
| subCategories.categoryId | categories.id | CASCADE |
| transactions.userId | users.id | CASCADE |
| transactions.accountId | accounts.id | RESTRICT |
| transactions.destinationAccountId | accounts.id | SET NULL |
| transactions.categoryId | categories.id | RESTRICT |
| transactions.subCategoryId | subCategories.id | SET NULL |
| transactions.bucketId | buckets.id | SET NULL |
| budgets.userId | users.id | CASCADE |
| budgets.categoryId | categories.id | CASCADE |
| monthlyBalances.userId | users.id | CASCADE |
| apiTokens.userId | users.id | CASCADE |
| appPreferences.userId | users.id | CASCADE |

## Enums PostgreSQL

- `AccountType` : CHECKING, CREDIT_CARD, SAVINGS, INVESTMENT
- `TransactionStatus` : PENDING, COMPLETED, CANCELLED, PLANNED
- `AuthProvider` : local, ldap

## Index composites

- `transactions_year_month_status_idx` -- requêtes mensuelles filtrées par statut
- `transactions_accountId_status_idx` -- soldes par compte
- `budgets_userId_categoryId_year_month_key` -- unicité budget par user/catégorie/mois (unique)
- `monthly_balances_userId_year_month_key` -- unicité solde par user/mois (unique)
- `categories_userId_name_key` -- unicité nom de catégorie par user (unique)
- `refresh_tokens_userId_idx` -- recherche de tokens par user
