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
Colonnes : Date | Libellé | Compte | Catégorie | Statut | Montant | Actions

- **Ligne de report** : en première position, affiche le solde reporté du mois précédent (si non nul)
- Accepte une prop optionnelle `initialCategory` (via searchParam `?category=<id>`) pour pré-sélectionner le filtre catégorie
- Les transactions CANCELLED sont affichées en opacité réduite
- Badge de statut coloré (default=COMPLETED, secondary=PENDING, destructive=CANCELLED)
- Montant vert si positif, rouge si négatif
- Notes affichées sous le libellé (tronquées)
- Catégories avec pastille de couleur + sous-catégorie séparée par " > "
- Bucket affiché sous la catégorie si présent
- La catégorie est **requise** : pas d'option "Aucune" dans le sélecteur de catégorie inline

### Formulaire (TransactionFormDialog)
Dialog modal avec les champs :
- **Libellé** (requis)
- **Montant** (requis, != 0) — positif = revenu, négatif = dépense
- **Date** (requis, input type=date)
- **Toggle AMEX** : switch rapide qui change automatiquement le compte sélectionné vers la carte de crédit AMEX (visible uniquement en création, si un compte CREDIT_CARD existe)
- **Compte** (requis)
- **Catégorie** (requis) → **Sous-catégorie** (optionnel, dépendant, la liste se met à jour quand on change de catégorie)
- **Bucket** (visible uniquement si le compte est SAVINGS ou INVESTMENT et a des buckets)
- **Statut** (PENDING par défaut)
- **Note** (obligatoire si CANCELLED, optionnel sinon)

### Actions en ligne (TransactionActionsCell)
Menu dropdown avec :
- **Marquer réalisée** (visible si PENDING) → passe en COMPLETED
- **Annuler** (visible si pas CANCELLED) → ouvre un dialog demandant la raison, passe en CANCELLED
- **Supprimer** → confirmation browser + suppression

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
| `getPreviousMonthBudgetRemaining(year, month)` | Report du mois précédent (voir calcul ci-dessous) |
| `copyRecurringTransactions(year, month)` | Copie les transactions récurrentes (sans date) du mois précédent |
| `getFormData()` | Comptes + catégories pour le formulaire (objets plain sans Decimal) |

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
