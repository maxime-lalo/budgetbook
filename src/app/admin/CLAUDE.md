# Admin — Panel d'administration

Page d'administration réservée aux utilisateurs avec `isAdmin: true`.

## Accès

- Protégée par `requireAdmin()` (throw 403 si non admin)
- Lien "Admin" visible dans la sidebar uniquement pour les admins

## Page (`page.tsx`) — Server Component

- Affiche les stats globales (nombre d'utilisateurs, transactions, comptes, catégories)
- Affiche la liste des utilisateurs via `UserList`

## Server Actions (`_actions/admin-actions.ts`)

| Fonction | Description |
|----------|-------------|
| `getUsers()` | Tous les utilisateurs avec stats (nb transactions, nb comptes, date création, provider, isAdmin) |
| `deleteUser(userId)` | Supprime un utilisateur + cascade toutes ses données |
| `toggleAdmin(userId, isAdmin)` | Active/désactive le rôle admin |
| `getGlobalStats()` | Compteurs globaux : utilisateurs, transactions, comptes, catégories |

## Composants (`_components/`)

### UserList (`user-list.tsx`) — Client Component

Tableau des utilisateurs avec :
- Email, Nom, Provider (local/ldap), Date de création
- Nombre de transactions et comptes
- Checkbox admin (toggle via `toggleAdmin()`)
- Bouton supprimer (avec protection : impossible de se supprimer soi-même)

## Sécurité

- Toutes les actions vérifient `requireAdmin()` avant toute opération
- L'utilisateur courant ne peut pas se supprimer ni se retirer le rôle admin
