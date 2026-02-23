# Hooks React Custom

## `useMonthNavigation()` (`use-month-navigation.ts`)

Hook de navigation mensuelle partagé entre les pages.

**Retourne :** `{ year, month, monthParam, previousMonth, nextMonth, navigateToMonth }`

**Comportement :**
1. Lit `?month=` dans l'URL (searchParams) et `localStorage["selected-month"]`
2. Si pas de searchParam mais localStorage existe → redirige pour ajouter le searchParam
3. Parse le mois via `parseMonthParam()` de `@/lib/formatters`
4. Persiste chaque changement dans localStorage
5. Navigation : `previousMonth()` / `nextMonth()` gèrent le wrap année, `navigateToMonth(y, m)` pour navigation directe

**Dépendances :** `useSearchParams`, `useRouter`, `usePathname` (Next.js), `parseMonthParam`/`toMonthParam` (`@/lib/formatters`)
