# Comptes & Buckets

## Fonctionnalités

### Liste des comptes
Chaque compte est affiché dans une Card avec :
- Pastille de couleur + nom
- Badge du type (Compte courant, Carte de crédit, Épargne, Investissement)
- Badge "Lié à {nom}" si le compte est une carte liée à un compte courant
- **Solde calculé** : somme des transactions COMPLETED du compte (vert/rouge). Pour les comptes SAVINGS/INVESTMENT, le signe est inversé (négatif = versement = solde augmente)
- Boutons éditer/supprimer

### CRUD Comptes (AccountFormDialog)
Champs :
- **Nom** (requis)
- **Type** (select : CHECKING, CREDIT_CARD, SAVINGS, INVESTMENT)
- **Couleur** (color picker)
- **Ordre** d'affichage
- **Compte lié** (select, pour les cartes de crédit → lier à un compte courant)

### Buckets
Affichés sous chaque compte dans la Card :
- Pastille couleur + nom
- Solde (somme des transactions COMPLETED référençant ce bucket)
- Si objectif défini : montant / objectif + barre de progression
- Boutons éditer/supprimer
- Bouton "Bucket" pour en ajouter un nouveau

### CRUD Buckets (BucketFormDialog)
Champs :
- **Nom** (requis)
- **Couleur** (color picker)
- **Objectif EUR** (optionnel, >= 0) — `""` transformé en `null` via Zod preprocess
- **Ordre** d'affichage

## Logique AMEX

Le toggle "AMEX" dans le formulaire de transaction sélectionne automatiquement le compte CREDIT_CARD. Le prélèvement mensuel AMEX sur le compte courant est une transaction manuelle de type débit.

## Logique Buckets

- Tout compte peut avoir des buckets
- Les transactions d'épargne ciblent un bucket via le sélecteur (visible si compte SAVINGS/INVESTMENT)
- Solde bucket = somme transactions COMPLETED qui le référencent (signe inversé car buckets sur comptes épargne)
- Solde réel du compte = somme de toutes ses transactions COMPLETED (signe inversé pour SAVINGS/INVESTMENT)

## Server Actions (_actions/account-actions.ts)

| Fonction | Description |
|----------|-------------|
| `getAccounts()` | Tous les comptes avec buckets, soldes, relations — objets plain |
| `getCheckingAccounts()` | Comptes courants pour le select de liaison |
| `createAccount(formData)` | Création avec validation Zod |
| `updateAccount(id, formData)` | Mise à jour |
| `deleteAccount(id)` | Suppression (cascade sur buckets) |
| `createBucket(formData)` | Création bucket |
| `updateBucket(id, formData)` | Mise à jour bucket |
| `deleteBucket(id)` | Suppression bucket |
| `getBucketBalance(bucketId)` | Somme des transactions COMPLETED du bucket (signe inversé) |

## Sérialisation

`getAccounts()` construit explicitement les objets retournés avec :
- `bucket.goal` → `.toNumber()` ou `null`
- `transaction.amount` → `.toNumber()`
- Relations `linkedAccount` et `linkedCards` réduites à `{ id, name }`
