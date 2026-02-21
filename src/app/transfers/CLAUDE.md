# Transfers - Virements inter-comptes

Page dédiée aux transferts entre comptes. Les virements utilisent le champ `destinationAccountId` (nullable) de la table `transactions`. Un seul enregistrement par virement, `amount` toujours négatif côté source.

## Fonctionnalités

### Navigation mensuelle
- Réutilise le composant `MonthNavigator` de `transactions/_components/`
- Paramètre URL `?month=2026-02`

### Formulaire simplifié (TransferFormDialog)
Dialog modal en mode création ou édition. Champs :
- **Libellé** (requis)
- **Montant** (positif, min 0.01) + **Date** (requis, pas de toggle récurrent)
- **Compte source** (Select avec pastille couleur + type de compte)
- **Bouton swap** (icône `ArrowUpDown`) : inverse source et destination en un clic
- **Compte destination** (Select filtrant la source, avec `key={accountId}` pour forcer le remontage Radix)
- **Bucket** (visible si source OU destination est SAVINGS/INVESTMENT avec buckets, priorité destination)
- **Catégorie** (pré-sélection auto sur catégorie contenant "virement", "épargne" ou "transfert")
- **Sous-catégorie** (conditionnel)
- **Statut** (PENDING ou COMPLETED uniquement)
- **Note** (optionnelle)

Pas de toggle dépense/rentrée, pas d'AMEX, pas de récurrent.

Le montant saisi est toujours positif ; la server action applique `-Math.abs()` avant insertion.

### Historique (TransferList)
- Affichage en **cards** (pas de table)
- Chaque card : icône `ArrowRightLeft` bleue, label, Source → Destination (pastilles couleur), catégorie, bucket, badge statut coloré, date, note
- Montant affiché positif (`Math.abs`), couleur bleue
- Badges statut : orange (PENDING), vert (COMPLETED), rouge (CANCELLED)
- Boutons Pencil (→ TransferFormDialog mode édition) et Trash2 (→ suppression directe)
- État vide : icône + "Aucun virement ce mois-ci."
- CANCELLED : card en `opacity-50`

## Composants (_components/)

| Composant | Type | Description |
|-----------|------|-------------|
| `transfer-form-dialog.tsx` | Client | Dialog de création/édition de virement |
| `transfer-list.tsx` | Client | Liste de cards des virements du mois |

## Server Actions (_actions/transfer-actions.ts)

| Fonction | Description |
|----------|-------------|
| `getTransfers(year, month)` | Virements du mois (filtre `isNotNull(destinationAccountId)`), avec relations account/destinationAccount/category/subCategory/bucket |
| `getTransferFormData()` | Comptes (avec buckets, couleur, type) + catégories (avec sous-catégories), triées par `localeCompare('fr')` |
| `createTransfer(data)` | Création avec `-Math.abs(amount)`, `isAmex: false`, validation via `transactionSchema` |
| `updateTransfer(id, data)` | Mise à jour, gère changement de mois |
| `deleteTransfer(id)` | Suppression |

Toutes les mutations appellent `recomputeMonthlyBalance` et `revalidatePath` sur `/transfers`, `/transactions` et `/savings`.

## Point technique : Radix Select et swap

Le Select de destination utilise `key={accountId}` pour forcer un remontage complet quand la source change. Sans cela, Radix Select ne met pas à jour sa valeur correctement quand elle pointe vers un item qui n'existait pas dans la liste d'options du render précédent (cas du bouton swap).
