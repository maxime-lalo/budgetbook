# Tests Unitaires (Vitest)

## Suites de tests (8 fichiers, 213 tests)

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `helpers.test.ts` | 21 | `toNumber`, `round2`, `toDate`, `toISOString` |
| `formatters.test.ts` | 11 | `formatCurrency`, `parseMonthParam`, `toMonthParam` |
| `validators.test.ts` | 69 | `transactionSchema` : montant, label, accountId, status, destinationAccount, coercition, month range |
| `api-rate-limit.test.ts` | 23 | Rate limiting, décrément remaining, blocage, isolation par IP |
| `api-auth.test.ts` | 13 | `hashToken`, `validateApiToken` (retourne userId ou null), `unauthorizedResponse` |
| `transaction-helpers.test.ts` | 41 | `insertTransaction`, `updateTransactionById`, `deleteTransactionById` avec userId |
| `monthly-balance.test.ts` | 25 | `recomputeMonthlyBalance`, `getCarryOver`, `backfillAllMonthlyBalances` avec userId |
| `safe-action.test.ts` | 10 | `safeAction` wrapper : succes, erreurs, messages custom |

## Conventions

- Framework : Vitest 3 avec config `vitest.config.mts` (ESM, extension `.mts` requise pour Vite 7)
- Pattern : `describe` / `it` / `expect`, tests happy path + edge cases
- Validators : `safeParse()` (non-throwing) pour valider les schémas Zod
- Rate limit : `vi.resetModules()` + import dynamique pour réinitialiser le Map entre tests
- Formatters : assertions par `toContain` (pas de comparaison stricte de chaînes localisées)
