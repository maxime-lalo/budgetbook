# Transaction Actions

Voir la documentation détaillée dans `src/app/transactions/CLAUDE.md` (section "Server Actions").

## Résumé

Fichier unique `transaction-actions.ts` contenant toutes les server actions pour la page transactions.

| Fonction | Description |
|----------|-------------|
| `getTransactions(year, month)` | Transactions du mois avec relations, sérialisées |
| `getTransactionTotals(year, month)` | Agrégats : réel, en attente, prévisionnel |
| `createTransaction(data)` | Délègue à `insertTransaction()` |
| `updateTransaction(id, data)` | Délègue à `updateTransactionById()` |
| `deleteTransaction(id)` | Délègue à `deleteTransactionById()` |
| `markTransactionCompleted(id)` | Passage en COMPLETED |
| `cancelTransaction(id, note)` | Passage en CANCELLED avec note obligatoire |
| `updateTransactionField(id, fields)` | Mise à jour partielle (inline edit) |
| `completeAmexTransactions(year, month)` | Validation en bloc AMEX PENDING → COMPLETED |
| `copyRecurringTransactions(year, month)` | Copie récurrentes de M-1 (batch insert) |
| `searchTransactionsAcrossMonths(query, year)` | Recherche par label sur toute l'année |
| `swapTransactionOrder(idA, idB)` | Échange l'ordre de tri de deux transactions |
| `getPreviousMonthBudgetRemaining(year, month)` | Report cumulé via `getCarryOver()` |
| `getFormData()` | Comptes + catégories pour les formulaires |

Toutes les mutations sont wrappées avec `safeAction()`.
