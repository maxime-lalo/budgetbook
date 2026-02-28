# prisma/ - Scripts d'import et données

Ce dossier contient les scripts d'import de données et les fichiers de données associés. Le schéma de base de données est désormais géré par Drizzle ORM dans `src/lib/db/schema/`.

## Scripts d'import et utilitaires

| Fichier | Description |
|---------|-------------|
| `import-data.ts` | Import de transactions depuis `data/transactions-bnp.json` en BDD (tsx) |
| `extract-excel.py` | Extraction de transactions depuis un export Excel BNP → JSON |
| `categorize.py` | Auto-catégorisation des transactions importées |
| `migrate-transfers.ts` | Backfill `destinationAccountId` sur les transactions de virement existantes |

Le dossier `data/` contient les fichiers JSON d'import (ignoré par git sauf `categories.json`).

## Commandes

```bash
pnpm db:extract   # Extraire transactions depuis Excel (Python)
pnpm db:import    # Importer transactions en BDD (tsx prisma/import-data.ts)
```
