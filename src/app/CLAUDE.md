# app/ - Routes et pages

## Layout racine (layout.tsx)

- Langue : `fr`
- Font : Geist Sans + Geist Mono
- Structure : Sidebar (desktop) + MobileNav (mobile) + main content
- ThemeProvider (next-themes) : attribut `class`, défaut `system`
- Toaster (sonner) : position bottom-right, richColors

## Page d'accueil (page.tsx)

Redirect immédiat vers `/transactions` (la vue principale).

## Routes

| Route | Description | Paramètres URL |
|-------|-------------|----------------|
| `/transactions` | Vue mensuelle des transactions | `?month=2026-02&category=<id>` |
| `/budgets` | Budgets mensuels par catégorie | `?month=2026-02` |
| `/categories` | CRUD catégories et sous-catégories | - |
| `/accounts` | CRUD comptes et buckets | - |
| `/statistics` | Graphiques et analyses | `?year=2026&account=xxx` |

## Navigation

- **Sidebar** (desktop, >= md) : 5 liens + toggle thème en bas
- **MobileNav** (mobile, < md) : Sheet latéral avec les mêmes liens
- **MonthNavigator** : composant dans `transactions/_components/` réutilisé par `/budgets`, avec :
  - Flèches gauche/droite
  - Sélecteur de mois (dropdown 12 mois en français)
  - Sélecteur d'année (dropdown 2017 → année courante)
  - Bouton "Aujourd'hui" (masqué si déjà sur le mois courant)
  - Persistance du mois sélectionné via localStorage
- Le mois courant est le défaut si pas de paramètre `?month`

### Navigation inter-pages (catégorie → transactions)
- Les **cards catégories** (`/categories`) et les **cards budget** (`/budgets`) sont entièrement cliquables
- Clic → navigation vers `/transactions?category=<id>` avec le filtre de catégorie pré-sélectionné
- Effet hover : ombre + léger soulèvement (`hover:shadow-lg hover:-translate-y-0.5`)
- Les éléments interactifs (boutons edit/delete, input budget) restent cliquables indépendamment (z-index ou `stopPropagation`)

## Pattern des pages

Les pages sont des **Server Components async** qui :
1. Lisent les `searchParams` (await car Promise en Next.js 16)
2. Appellent les server actions pour fetch les données
3. Convertissent les Decimal/Date côté serveur
4. Passent des objets plain aux Client Components
