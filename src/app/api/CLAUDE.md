# API REST

Endpoints pour intégrations externes (Tasker → n8n → API), sécurisés par Bearer token.

## Authentification

Toutes les routes vérifient le header `Authorization: Bearer <token>` via `validateApiToken()` de `src/lib/api-auth.ts`. Le token est stocké dans la table `api_tokens` et géré depuis `/settings`.

Les tokens sont hashés en SHA-256 avant comparaison avec la BDD.

Sans token valide → `401 Unauthorized`.

## Rate Limiting

Toutes les routes API sont protégées par un rate limiter (60 requêtes/minute par IP).
Dépassement → `429 Too Many Requests` avec header `Retry-After`.
Implémenté dans `src/proxy.ts` (middleware) via `src/lib/api-rate-limit.ts`.

## Routes

### POST `/api/transactions` (`transactions/route.ts`)

Crée une transaction.

**Body JSON :**
| Champ | Requis | Défaut | Description |
|-------|--------|--------|-------------|
| `label` | oui | — | Libellé de la transaction |
| `amount` | oui | — | Montant (négatif = dépense, positif = revenu, != 0) |
| `categoryId` | oui | — | ID de la catégorie |
| `subCategoryId` | non | `null` | ID de la sous-catégorie |
| `accountId` | non | Premier compte CHECKING | ID du compte |
| `date` | non | Aujourd'hui (`YYYY-MM-DD`) | Date de la transaction |
| `status` | non | `PENDING` | Statut (PENDING, COMPLETED, CANCELLED, PRÉVUE) |
| `isAmex` | non | `false` | Transaction AMEX |

**Comportement :**
- `month`/`year` déduits automatiquement de la date
- Validation via schéma Zod dédié (simplifié par rapport au `transactionSchema` UI)
- Appelle `recomputeMonthlyBalance()` + `revalidatePath("/transactions")`
- Retourne 201 avec `{ id, label, amount, date, month, year, status, categoryId, accountId }`
- Erreurs : 400 (JSON invalide ou validation échouée), 401 (pas de token)

### GET `/api/categories` (`categories/route.ts`)

Liste toutes les catégories avec leurs sous-catégories.

**Réponse :** `[{ id, name, color, subCategories: [{ id, name }] }]`
- Trié par nom (locale `fr`)
- Sous-catégories triées par nom (locale `fr`)

### GET `/api/accounts` (`accounts/route.ts`)

Liste tous les comptes.

**Réponse :** `[{ id, name, type }]`
- Trié par `sortOrder`

## Configuration production (Authelia)

En production derrière Authelia, les routes `/api/*` doivent être en bypass pour permettre l'authentification par Bearer token :

```yaml
access_control:
  rules:
    - domain: comptes.domaine.fr
      resources: "^/api/"
      policy: bypass
```
