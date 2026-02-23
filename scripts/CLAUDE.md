# Scripts Utilitaires

## Fichiers

| Script | Type | Description |
|--------|------|-------------|
| `docker-entrypoint.sh` | Bash | Entrypoint Docker : `drizzle-kit push --force` puis `node server.js`. Provider-aware via `DB_PROVIDER` |
| `compare-savings.ts` | TypeScript | Compare les transactions épargne d'un export JSON avec le baseline Excel. Groupement par année, totaux |
| `deep-compare.ts` | TypeScript | Réconciliation détaillée année par année entre export JSON et baseline Excel hardcodé. Table avec écarts, détail ligne par ligne pour variances > 10€ |
| `compare-detail.ts` | TypeScript | Comparaison résumée des totaux annuels (LJ + LA + Voyages + Vêtements vs JSON) |

## Notes

- Les scripts de comparaison (`compare-*.ts`) sont des outils one-shot pour la migration Excel → BDD
- Ils lisent un export JSON local (`~/Downloads/comptes-export-*.json`)
- Les montants sont inversés (JSON côté compte courant, Excel côté compte épargne)
- `docker-entrypoint.sh` utilise `set -e` pour fail-fast
