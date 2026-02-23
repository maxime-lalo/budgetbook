# Tests Unitaires (Vitest)

## Suites de tests (4 fichiers, 43 tests)

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `helpers.test.ts` | 17 | `toNumber` (5), `round2` (4), `toDate` (4), `toISOString` (4) |
| `formatters.test.ts` | 11 | `formatCurrency` (4), `parseMonthParam` (4), `toMonthParam` (3) |
| `validators.test.ts` | 11 | `transactionSchema` : montant, label, accountId, status (PRÉVUE, CANCELLED+note), destinationAccount, coercition, month range |
| `api-rate-limit.test.ts` | 4 | Limite 60/min, décrément remaining, blocage 61e requête, isolation par IP |

## Conventions

- Framework : Vitest 3 avec config `vitest.config.mts` (ESM, extension `.mts` requise pour Vite 7)
- Pattern : `describe` / `it` / `expect`, tests happy path + edge cases
- Validators : `safeParse()` (non-throwing) pour valider les schémas Zod
- Rate limit : `vi.resetModules()` + import dynamique pour réinitialiser le Map entre tests
- Formatters : assertions par `toContain` (pas de comparaison stricte de chaînes localisées)
