# Composants

## Structure

```
components/
├── ui/        # Shadcn/UI (auto-générés, ne pas modifier manuellement)
└── layout/    # Navigation et thème
```

## ui/ — Composants Shadcn/UI

Composants installés via `npx shadcn@latest add` :

badge, button, calendar, card, chart, command, dialog, dropdown-menu, form, input, label, popover, progress, scroll-area, select, separator, sheet, skeleton, switch, table, tabs, textarea, tooltip

**Ne pas modifier ces fichiers manuellement.** Utiliser `npx shadcn@latest add <composant>` pour en ajouter.

## layout/ — Navigation et thème

### Sidebar (`sidebar.tsx`)
- Navigation desktop (visible >= md)
- 5 liens : Transactions, Budgets, Catégories, Comptes, Statistiques
- Icônes Lucide : ArrowLeftRight, LayoutDashboard, Tags, Wallet, BarChart3
- Lien actif détecté via `usePathname().startsWith(href)`
- ThemeToggle en bas de la sidebar

### MobileNav (`mobile-nav.tsx`)
- Navigation mobile (visible < md)
- Sheet latéral (Shadcn Sheet) déclenché par bouton hamburger
- Mêmes 5 liens que la sidebar
- Le sheet se ferme automatiquement lors de la navigation (`setOpen(false)`)

### ThemeProvider (`theme-provider.tsx`)
- Wrapper autour de `next-themes` `ThemeProvider`
- Attribut `class`, thème par défaut `system`, `enableSystem`

### ThemeToggle (`theme-toggle.tsx`)
- Bouton avec icônes Sun/Moon en transition (rotation + scale)
- Bascule entre `light` et `dark`
