# src/ - Code source

## Organisation

```
src/
├── app/           # Pages et routes (Next.js App Router)
├── components/    # Composants réutilisables
│   ├── ui/        # Shadcn/UI (ne pas modifier manuellement)
│   └── layout/    # Sidebar, mobile-nav, theme
└── lib/           # Utilitaires partagés
    ├── prisma.ts          # Singleton Prisma
    ├── validators.ts      # Schémas Zod (toute la validation)
    ├── formatters.ts      # Formatage monnaie, dates, labels
    ├── monthly-balance.ts # Report cumulatif inter-mois (MonthlyBalance)
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
- Toutes les mutations passent par des Server Actions (pas d'API routes REST)
- Les fonctions de lecture (getXxx) sont aussi dans les fichiers actions pour la co-localisation
- Retournent `{ success: true }` ou `{ error: ... }` pour les mutations
- Appellent `revalidatePath()` après chaque mutation
- Convertissent les `Decimal` Prisma en `number` et les `Date` en `string` avant de retourner

### Sérialisation Server → Client
Les objets Prisma contiennent des types non-sérialisables (`Decimal`, potentiellement `Date` dans les relations).
**Règle** : toujours construire des objets plain explicitement dans les server actions avant de les passer aux client components. Ne jamais faire de spread `...prismaObject` si l'objet contient des Decimal.

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
