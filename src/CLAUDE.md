# src/ - Code source

## Organisation

```
src/
├── app/           # Pages et routes (Next.js App Router)
├── components/    # Composants réutilisables
│   ├── ui/        # Shadcn/UI (ne pas modifier manuellement)
│   └── layout/    # Sidebar, mobile-nav, theme
└── lib/           # Utilitaires partagés
    ├── db/                # Drizzle ORM (schéma, singleton, helpers)
    │   ├── schema/pg.ts   # Schéma PostgreSQL
    │   ├── index.ts       # Singleton PostgreSQL
    │   ├── helpers.ts     # toNumber(), toISOString(), round2(), getCheckingAccountIds()
    │   └── seed.ts        # Données de démo
    ├── __tests__/         # Tests unitaires (Vitest)
    ├── validators.ts      # Schémas Zod (toute la validation)
    ├── types.ts           # Types TypeScript partagés
    ├── formatters.ts      # Formatage monnaie, dates, labels
    ├── safe-action.ts     # Wrapper try/catch pour server actions
    ├── transaction-helpers.ts # CRUD partagé transactions/transferts
    ├── monthly-balance.ts # Report cumulatif inter-mois (MonthlyBalance)
    ├── auth/              # Authentification (JWT, password, session, LDAP)
    ├── api-auth.ts        # Validation Bearer token API + hashage SHA-256
    ├── api-rate-limit.ts  # Rate limiting API
    ├── env.ts             # Validation variables d'environnement (Zod)
    ├── logger.ts          # Logger structuré
    ├── revalidate.ts      # revalidateTransactionPages()
    ├── utils.ts           # cn() pour Tailwind (Shadcn)
    └── hooks/             # React hooks custom
```

## Conventions

### Routes (App Router)
Chaque route suit le pattern :
```
src/app/{route}/
  ├── page.tsx              # Server Component (fetch data, passe aux composants)
  ├── _actions/             # Server Actions ("use server")
  │   └── {entity}-actions.ts
  └── _components/          # Client Components ("use client")
      ├── {entity}-form-dialog.tsx
      ├── {entity}-table.tsx
      └── delete-buttons.tsx
```

Le préfixe `_` empêche Next.js de traiter ces dossiers comme des routes.

### Server Actions
- Toutes les mutations UI passent par des Server Actions (pas d'API routes REST côté UI)
- **Exception** : les routes `/api/*` sont des API REST pour les intégrations externes (Tasker/n8n), sécurisées par Bearer token
- Les fonctions de lecture (getXxx) sont aussi dans les fichiers actions pour la co-localisation
- Retournent `{ success: true }` ou `{ error: ... }` pour les mutations -- les composants client vérifient via `"error" in result` (pas `result.error`) pour le narrowing TypeScript
- Appellent `revalidateTransactionPages()` de `@/lib/revalidate` après chaque mutation (invalide `/transactions`, `/transfers` et `/savings`)
- Les mutations sont wrappées avec `safeAction()` de `@/lib/safe-action.ts` qui catch les erreurs inattendues et les log
- Convertissent les montants numériques en `number` via `toNumber()` et les `Date` en `string` via `toISOString()` avant de retourner

### Sérialisation Server → Client
Les requêtes Drizzle retournent des montants en `string` (PG numeric).
**Règle** : toujours convertir via `toNumber()` de `@/lib/db/helpers` et construire des objets plain explicitement dans les server actions avant de les passer aux client components.

### Validation
- Zod 4 pour toute la validation (côté serveur uniquement)
- Les schémas sont centralisés dans `lib/validators.ts`
- `z.coerce.number()` pour les champs FormData (qui arrivent en string)
- `z.preprocess()` pour transformer `""` en `null` (champs optionnels numériques)
- `.refine()` pour les contraintes cross-field (note obligatoire si annulation)

### Formatage
- Monnaie : `Intl.NumberFormat` en EUR/fr-FR
- Dates : `date-fns` avec locale française
- Labels : maps statiques pour AccountType et TransactionStatus
