# Transactions - Vue principale

La page de transactions est le coeur de l'application. Elle affiche toutes les transactions du mois sélectionné.

## Fonctionnalités

### Navigation mensuelle
- Composant `MonthNavigator` avec flèches gauche/droite
- Paramètre URL `?month=2026-02` (format yyyy-MM)
- Par défaut : mois courant
- Hook `useMonthNavigation` dans `lib/hooks/`

### Barre de totaux (TotalsBar)
3 cartes affichant :
- **Total sur compte** : somme des transactions COMPLETED + report cumulé (vert si positif, rouge si négatif)
- **Reste à passer** : somme des transactions PENDING (bleu/orange)
- **Total réel** : forecast (COMPLETED + PENDING) + report cumulé. Représente le solde réel estimé du compte.
  - Si un report existe, une ligne "dont report : X€" s'affiche sous le montant.

### Table des transactions (TransactionsTable)
Colonnes : Libellé | Catégorie | Statut | Montant | Compte | Actions

- **Ligne de report** : en première position, affiche le solde reporté du mois précédent (si non nul)
- **Filtre catégorie** : dropdown persistant au-dessus de la table (pré-sélectionné via searchParam `?category=<id>`)
- **Tri** : colonnes Statut et Montant cliquables (toggle asc/desc/aucun)
- **Sections** (sans tri actif) : deux sections — "Récurrentes" (pliable) pour les transactions sans date, et "Transactions" pour les datées. Si un tri est actif, liste plate unique.
- **Boutons au-dessus de la table** : filtre catégorie, CopyRecurringButton, CompleteAmexButton (si AMEX en attente), affichage total AMEX mensuel
- Les transactions CANCELLED sont affichées en opacité réduite
- Édition inline : tous les champs sont modifiables directement dans la table
- Sélecteurs de catégorie et statut avec pastilles de couleur (catégorie : couleur de la catégorie, statut : orange/vert/rouge)
- Montant centré, 95px de large, sans spinners, vert si positif, rouge si négatif
- La catégorie est **requise** : pas d'option "Aucune" dans le sélecteur de catégorie inline

### Formulaire de création (TransactionFormDialog)
Dialog modal avec les champs (dans cet ordre) :
- **Libellé** (requis)
- **Dépense/Rentrée** : boutons toggle qui inversent le signe du montant (AMEX force "Dépense")
- **Montant** (min 0.01) + **Date** (désactivé si Récurrent)
- **Toggle AMEX** + **Récurrent** (toggle qui désactive le champ date — transaction sans date rattachée au mois)
- **Catégorie** (requis) → **Sous-catégorie** (optionnel, peuplé dynamiquement)
- **Compte** + **Statut** (sur la même ligne, grid 2 colonnes)
- **Bucket** (visible uniquement si le compte est SAVINGS ou INVESTMENT et a des buckets)
- **Note** (visible uniquement si statut CANCELLED, obligatoire)

Pas de champ destination (les virements inter-comptes passent par `/transfers`).

### Actions en ligne (EditableTransactionRow)
Édition inline de chaque champ avec sauvegarde au blur :
- **Libellé** : input texte
- **Catégorie + Sous-catégorie** : double select avec pastilles couleur
- **Statut** : select avec pastilles couleur ; passage en CANCELLED ouvre un dialog pour la raison obligatoire
- **Montant** : input numérique sans spinners, vert/rouge
- **Compte** : select avec toggle **AMEX** (icône carte bleue, visible uniquement pour les comptes CHECKING)
- **Boutons d'action** (fin de ligne) :
  - **Éditer** (icône Pencil) → modal avec : Récurrent (toggle), Date (désactivé si récurrent), Mois budgétaire (input type="month"), Compte, Bucket (si SAVINGS/INVESTMENT)
  - **Supprimer** (icône Trash2) → suppression directe sans confirmation

### Création rapide (NewTransactionRow)
Ligne intégrée directement dans le tableau (dernière ligne) permettant d'ajouter une transaction sans ouvrir le dialog :
- Champs inline : libellé, catégorie (select avec pastilles), montant (input numérique)
- Validation : libellé requis, montant != 0, catégorie requise
- Création au blur ou Enter sur le champ montant
- Réinitialisation automatique après création réussie
- Utilise les mêmes données de formulaire que `TransactionFormDialog` (comptes, catégories)

### Boutons spéciaux

- **CopyRecurringButton** : copie les transactions récurrentes (sans date) de M-1 vers le mois courant
- **CompleteAmexButton** : valide en bloc toutes les transactions AMEX PENDING du mois (visible si count > 0, avec dialog de confirmation)

## Composants (_components/)

| Composant | Type | Description |
|-----------|------|-------------|
| `transactions-table.tsx` | Client | Table principale avec sections, tri, filtres, ligne de report |
| `editable-transaction-row.tsx` | Client | Ligne de transaction avec édition inline au blur |
| `new-transaction-row.tsx` | Client | Ligne de création rapide intégrée au tableau |
| `transaction-form-dialog.tsx` | Client | Dialog modal complet de création/édition |
| `transaction-actions-cell.tsx` | Client | Cellule d'actions en fin de ligne (éditer, supprimer) |
| `month-navigator.tsx` | Client | Navigateur mois/année avec flèches et sélecteurs |
| `totals-bar.tsx` | Client | 3 cards de totaux (réel, en attente, prévisionnel) |
| `copy-recurring-button.tsx` | Client | Bouton copie des récurrentes de M-1 |
| `complete-amex-button.tsx` | Client | Bouton validation en bloc des AMEX PENDING |

## Server Actions (_actions/transaction-actions.ts)

| Fonction | Description |
|----------|-------------|
| `getTransactions(year, month)` | Transactions du mois avec relations, sérialisées en plain objects |
| `getTransactionTotals(year, month)` | Agrégats : réel, en attente, prévisionnel |
| `createTransaction(data)` | Création avec validation Zod |
| `updateTransaction(id, data)` | Mise à jour avec validation Zod |
| `deleteTransaction(id)` | Suppression |
| `markTransactionCompleted(id)` | Passage en COMPLETED |
| `cancelTransaction(id, note)` | Passage en CANCELLED avec note obligatoire |
| `updateTransactionField(id, fields)` | Mise à jour partielle d'un ou plusieurs champs (inclut isAmex) |
| `completeAmexTransactions(year, month)` | Passage en bloc de toutes les transactions AMEX PENDING en COMPLETED |
| `getPreviousMonthBudgetRemaining(year, month)` | Report du mois précédent (voir calcul ci-dessous) |
| `copyRecurringTransactions(year, month)` | Copie les transactions récurrentes (sans date) du mois précédent |
| `getFormData()` | Comptes + catégories (avec couleurs) pour le formulaire (objets plain sans Decimal) |

## Report cumulatif de mois (`getPreviousMonthBudgetRemaining`)

`getPreviousMonthBudgetRemaining(year, month)` délègue à `getCarryOver(year, month)` de `src/lib/monthly-balance.ts`.

Le report est désormais **cumulatif** : il additionne le surplus de tous les mois antérieurs (pas juste M-1), grâce à la table `MonthlyBalance`.

**Formule par mois :**
```
surplus(M) = forecast(M) − Σ max(budgété, dépensé) par catégorie
```

**Report pour le mois M :**
```
carryOver(M) = Σ surplus(i) pour tous les mois i < M
```

La table `MonthlyBalance` est mise à jour automatiquement après chaque mutation de transaction (create, update, delete, mark completed, cancel, update field, copy recurring). Toutes les mutations appellent `revalidatePath` sur `/transactions`, `/transfers` et `/savings`.

Ce montant est :
- Affiché en première ligne du tableau des transactions du mois courant ("Report mois précédent")
- Ajouté au "Total actuel" dans la TotalsBar (`adjustedForecast = forecast + budgetCarryOver`)

## Point technique : sérialisation

`getTransactions()` et `getFormData()` construisent des objets plain explicitement pour convertir les montants (string en PG, number en SQLite) en `number` via `toNumber()` avant passage aux Client Components.


<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>