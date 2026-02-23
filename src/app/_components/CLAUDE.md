# Dashboard Components

## Composants (`dashboard.tsx`)

5 Client Components purs (pas de data fetching), reçoivent des props typées :

| Composant | Description |
|-----------|-------------|
| `SummaryCards` | Grille 3 colonnes : "Reste à vivre" (forecast + carryOver), "Dépenses", "Revenus". Couleurs vert/rouge selon signe |
| `AccountsList` | Liste des comptes avec pastille couleur + solde coloré. Lien → `/accounts` |
| `BudgetAlerts` | Alerte catégories sur-budgétées avec icône AlertTriangle, ProgressBar variant="budget". Trié par remaining ASC (pire en premier) |
| `RecentTransactions` | 5 dernières transactions avec label, badge catégorie, date, montant coloré. Lien → `/transactions` |
| `RecentTransfers` | 5 derniers transferts avec pastilles source → destination, montant en bleu. Lien → `/transfers` |

## Patterns

- Tous les composants sont des Client Components purs (affichage uniquement)
- Formatage via `formatCurrency()` et `formatDate()` de `@/lib/formatters`
- Classe `tabular-nums` pour l'alignement des montants
- Icônes Lucide : Wallet, ArrowDownRight, ArrowUpRight, ArrowRightLeft, AlertTriangle, ArrowRight
