# Dashboard Actions

## Server Actions (`dashboard-actions.ts`)

Unique fonction publique :

- `getDashboardData(year, month)` — Orchestrateur qui exécute 8 requêtes en `Promise.all()` et retourne un objet agrégé : `totals`, `income`, `expenses`, `carryOver`, `accounts` (avec soldes), `overBudgetCategories`, `recentTransactions` (5 dernières), `recentTransfers` (5 derniers)

### Helpers privés

| Fonction | Description |
|----------|-------------|
| `getTotals()` | Somme comptes CHECKING (completed + pending, sortant - entrant) |
| `getIncomeExpenses()` | Sommes filtrées revenus/dépenses tous comptes |
| `getAccountsWithBalance()` | Map/reduce : transactions (sortant + entrant) + bucket baseAmounts |
| `getOverBudgetCategories()` | Join categories/budgets/transactions, filtre spent > budgeted |
| `getRecentTransactions()` | 5 dernières transactions, triées date DESC puis createdAt DESC |
| `getRecentTransfers()` | 5 derniers transferts (destinationAccountId IS NOT NULL) |

## Patterns

- `Promise.all()` pour paralléliser les 8 requêtes
- Formule solde différente pour SAVINGS/INVESTMENT vs CHECKING
- Budget dépassé = spent > budgeted AND spent > 0 (évite les transferts comme dépassements)
- Tous les montants convertis via `toNumber()` et arrondis via `round2()`
