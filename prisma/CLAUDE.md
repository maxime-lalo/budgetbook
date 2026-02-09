# Prisma - Schéma et base de données

## Modèles

### Account (table: `accounts`)
Représente un compte bancaire physique.

| Champ | Type | Description |
|-------|------|-------------|
| id | cuid | Identifiant unique |
| name | String | "Compte Courant", "AMEX", "Livret A" |
| type | AccountType | CHECKING, CREDIT_CARD, SAVINGS, INVESTMENT |
| color | String? | Couleur d'affichage (hex) |
| icon | String? | Nom d'icône Lucide |
| sortOrder | Int | Ordre d'affichage |
| linkedAccountId | String? | Self-relation pour lier une carte de crédit à un compte courant |

**Self-relation "AmexLink"** : Un compte CREDIT_CARD peut être lié à un compte CHECKING. `linkedAccount` = le compte courant parent, `linkedCards` = les cartes liées à ce compte.

**Relations Transaction** : `transactions` (source, via `TransactionSource`) et `incomingTransfers` (destination, via `TransactionDestination` pour les virements entre comptes).

### Bucket (table: `buckets`)
Sous-enveloppe virtuelle d'un compte (épargne par objectif).

| Champ | Type | Description |
|-------|------|-------------|
| name | String | "Voyages", "Fonds d'urgence" |
| accountId | String | Référence au compte parent (cascade delete) |
| goal | Decimal(12,2)? | Objectif d'épargne |
| color | String? | Couleur d'affichage |
| baseAmount | Decimal(12,2) | Montant de base (défaut 0), solde initial pré-existant |
| sortOrder | Int | Ordre d'affichage (défaut 0) |

Le solde d'un bucket = baseAmount + somme des transactions qui le référencent (status COMPLETED).

### Category (table: `categories`)
Catégorie de dépense/revenu.

| Champ | Type | Description |
|-------|------|-------------|
| name | String | Unique. "Alimentation", "Transport", etc. |
| color | String? | Couleur hex |
| icon | String? | Nom d'icône Lucide |

### SubCategory (table: `sub_categories`)
Sous-catégorie, unique par combinaison (categoryId, name).

### Transaction (table: `transactions`)
Mouvement financier.

| Champ | Type | Description |
|-------|------|-------------|
| label | String | Libellé ("Courses Carrefour") |
| amount | Decimal(12,2) | Positif = revenu, négatif = dépense |
| date | Date? | Date de la transaction (sans heure), **optionnel** — `null` pour les transactions récurrentes |
| month | Int | Mois de rattachement budgétaire (1-12) |
| year | Int | Année de rattachement budgétaire |
| status | TransactionStatus | PENDING, COMPLETED, CANCELLED |
| note | String? | Obligatoire si status = CANCELLED |
| accountId | String | Compte concerné |
| categoryId | String | Catégorie (**requis**, Restrict on delete) |
| subCategoryId | String? | Sous-catégorie (SetNull on delete) |
| bucketId | String? | Bucket cible pour épargne (SetNull on delete) |
| destinationAccountId | String? | Compte destinataire pour les virements entre comptes |
| isAmex | Boolean | `true` si transaction faite via carte AMEX (débit différé sur compte courant) |

**date optionnel** : les transactions récurrentes (loyer, abonnements) n'ont pas de date précise. Elles sont rattachées à un mois via `month`/`year`.

**month/year séparés de date** : permettent le rattachement budgétaire indépendant de la date réelle. Par ex. une transaction datée du 31 janvier peut être rattachée au budget de février.

**categoryId est non nullable** : chaque transaction doit avoir une catégorie. `onDelete: Restrict` empêche la suppression d'une catégorie utilisée par des transactions.

**isAmex** : remplace l'ancien compte CREDIT_CARD séparé. Les transactions AMEX vivent sur le compte courant avec `isAmex: true`. Le total AMEX mensuel est affiché dans la barre de filtre de la page transactions.

**Index** : (accountId, date), (categoryId), (date), (status), (year, month), (isAmex, status), (destinationAccountId).

### Budget (table: `budgets`)
Enveloppe budgétaire mensuelle par catégorie.

| Champ | Type | Description |
|-------|------|-------------|
| categoryId | String | Catégorie (cascade delete) |
| month | Int | 1-12 |
| year | Int | Année |
| amount | Decimal(12,2) | Montant budgété |

**Contrainte unique** : (categoryId, year, month).

### MonthlyBalance (table: `monthly_balances`)
Matérialise le surplus budgétaire de chaque mois pour permettre un report cumulatif inter-mois.

| Champ | Type | Description |
|-------|------|-------------|
| year | Int | Année |
| month | Int | 1-12 |
| forecast | Decimal(12,2) | Somme des transactions COMPLETED + PENDING |
| committed | Decimal(12,2) | Σ max(budgété, dépensé) par catégorie |
| surplus | Decimal(12,2) | forecast - committed |

**Contrainte unique** : (year, month).
**Index** : (year, month).

Mis à jour automatiquement après chaque mutation de transaction ou budget via `recomputeMonthlyBalance()`. Le carry-over pour un mois M = `SUM(surplus)` de tous les mois antérieurs.

### ApiToken (table: `api_tokens`)
Token d'authentification pour l'API REST externe.

| Champ | Type | Description |
|-------|------|-------------|
| id | cuid | Identifiant unique |
| token | String | Token UUID, unique |
| name | String | Nom du token (défaut "default") |
| createdAt | DateTime | Date de création |

Un seul token actif à la fois. Régénérer un token supprime tous les précédents. Géré depuis la page `/settings`.

## Scripts d'import et utilitaires

| Fichier | Description |
|---------|-------------|
| `import-data.ts` | Import de transactions depuis `data/transactions-bnp.json` en BDD (tsx) |
| `extract-excel.py` | Extraction de transactions depuis un export Excel BNP → JSON |
| `categorize.py` | Auto-catégorisation des transactions importées |
| `migrate-transfers.ts` | Backfill `destinationAccountId` sur les transactions de virement existantes |

Le dossier `data/` contient les fichiers JSON d'import (ignoré par git sauf `categories.json`).

## Seed (prisma/seed.ts)

Données de démonstration :
- **14 catégories** avec sous-catégories : Logement, Alimentation, Transport, Santé, Loisirs, Shopping, Abonnements, Éducation, Impôts & Taxes, Épargne, Revenus, Remboursements, Cadeaux, Divers
- **2 comptes** : Compte Courant (CHECKING), Livret A (SAVINGS)
- **2 buckets** : Fonds d'urgence (objectif 10 000 EUR), Voyages (objectif 3 000 EUR)
- **10 transactions** d'exemple pour le mois courant
- **7 budgets** pour le mois courant
- **Backfill MonthlyBalance** : calcul et insertion du surplus pour chaque mois distinct

Les IDs des comptes et buckets sont fixes (`checking-main`, `savings-main`, `bucket-emergency`, `bucket-travel`) pour permettre des upserts idempotents. Les transactions AMEX de démonstration utilisent `isAmex: true` sur le compte courant.

## Commandes

```bash
pnpm db:migrate             # Créer/appliquer les migrations
pnpm db:push                # Pousser le schéma sans migration
pnpm db:seed                # Exécuter le seed (tsx prisma/seed.ts)
pnpm db:generate            # Générer le client Prisma
pnpm db:studio              # Interface graphique Prisma Studio
```
