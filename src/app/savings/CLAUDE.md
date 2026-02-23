# Savings — Vue annuelle épargne

## Pages

- `page.tsx` — Server Component async, navigation par année via `?year=` searchParam. Appelle `getSavingsTransactions()` et `getSavingsTotals()` en parallèle avec `getFormData()`. Réutilise `TransactionsTable`, `TotalsBar`, `TransactionFormDialog` de `/transactions` avec des props adaptées (`flatLayout`, `hideCopyRecurring`, `amexEnabled={false}`)

## Server Actions (`_actions/savings-actions.ts`)

- `getSavingsTransactions(year)` — Récupère toutes les transactions des comptes SAVINGS/INVESTMENT pour une année, y compris les transferts entrants. Sérialise via `toNumber()`/`toISOString()`
- `getSavingsTotals(year)` — Agrège les soldes réels/en attente/prévisionnels des comptes épargne. Inclut les `baseAmount` des buckets dans le calcul

## Composants (`_components/`)

- `YearNavigator` — Client Component, navigation annuelle avec chevrons, select (2017 → année courante), bouton "année courante". Persiste dans `localStorage["selected-savings-year"]`, fallback sur `localStorage["selected-month"]`

## Particularités

- Filtre par **type de compte** (SAVINGS/INVESTMENT), pas par ID
- Tri : `recurring` en premier (0), puis non-récurrentes (1)
- Réutilise les composants `/transactions` — pas de table/formulaire dédié
