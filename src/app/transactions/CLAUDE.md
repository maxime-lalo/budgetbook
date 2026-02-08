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
- **Total réel** : somme des transactions COMPLETED uniquement (vert si positif, rouge si négatif)
- **Reste à passer** : somme des transactions PENDING (bleu/orange)
- **Total actuel** : réel + pending + report budget du mois précédent. Représente le solde réel du compte.
  - Si un report existe, une ligne "dont report : X€" s'affiche sous le montant.

### Table des transactions (TransactionsTable)
Colonnes : Libellé | Catégorie | Sous-catégorie | Statut | Montant | Actions

- **Ligne de report** : en première position, affiche le solde reporté du mois précédent (si non nul)
- Accepte une prop optionnelle `initialCategory` (via searchParam `?category=<id>`) pour pré-sélectionner le filtre catégorie
- Les transactions CANCELLED sont affichées en opacité réduite
- Édition inline : tous les champs sont modifiables directement dans la table
- Sélecteurs de catégorie et statut avec pastilles de couleur (catégorie : couleur de la catégorie, statut : orange/vert/rouge)
- Montant centré, 95px de large, sans spinners, vert si positif, rouge si négatif
- La catégorie est **requise** : pas d'option "Aucune" dans le sélecteur de catégorie inline

### Formulaire de création (TransactionFormDialog)
Dialog modal avec les champs (dans cet ordre) :
- **Libellé** (requis)
- **Montant** + **Date** + **Récurrent** (toggle qui désactive le champ date)
- **Catégorie** (requis) → **Sous-catégorie** (optionnel)
- **Compte** + **Statut** (sur la même ligne)
- **Toggle AMEX** : switch rapide vers la carte de crédit AMEX (visible si un compte CREDIT_CARD existe)
- **Bucket** (visible uniquement si le compte est SAVINGS ou INVESTMENT et a des buckets)
- **Note** (obligatoire si CANCELLED, optionnel sinon)

### Actions en ligne (EditableTransactionRow)
Boutons inline en bout de ligne (pas de menu dropdown) :
- **Éditer** (icône Pencil) → ouvre une modal avec : Récurrent (toggle), Date, Mois budgétaire, Compte, Bucket (si SAVINGS/INVESTMENT)
- **Supprimer** (icône Trash2) → suppression directe sans confirmation
- **Annuler** → le passage en CANCELLED via le sélecteur de statut ouvre un dialog demandant la raison

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
| `updateTransactionField(id, fields)` | Mise à jour partielle d'un ou plusieurs champs |
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

La table `MonthlyBalance` est mise à jour automatiquement après chaque mutation de transaction (create, update, delete, mark completed, cancel, update field, copy recurring).

Ce montant est :
- Affiché en première ligne du tableau des transactions du mois courant ("Report mois précédent")
- Ajouté au "Total actuel" dans la TotalsBar (`adjustedForecast = forecast + budgetCarryOver`)

## Point technique : sérialisation

`getTransactions()` et `getFormData()` construisent des objets plain explicitement (pas de spread Prisma) pour éviter les erreurs `Decimal objects are not supported` de React.
