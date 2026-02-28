# transactions/print/ — Vue impression

Page d'impression des transactions du mois courant.

## Page (`page.tsx`) — Server Component

- Lit le searchParam `?month=` (format `yyyy-MM`)
- Charge les mêmes données que la page transactions principale
- Affiche un tableau simplifié optimisé pour l'impression (pas d'actions, pas d'édition inline)

## Composants (`_components/`)

### PrintButton (`print-button.tsx`) — Client Component

- Bouton qui déclenche `window.print()`
- Masqué à l'impression via `print:hidden`
