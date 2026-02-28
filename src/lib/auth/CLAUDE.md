# auth/ — Module d'authentification

Module multi-provider (local + LDAP) pour l'authentification et la gestion de session.

## Fichiers

| Fichier | Description |
|---------|-------------|
| `index.ts` | Barrel export de tout le module |
| `jwt.ts` | Création et vérification de JWT (jose, Edge-compatible) |
| `password.ts` | Hashage et vérification de mots de passe (bcryptjs, Node.js only) |
| `ldap.ts` | Authentification LDAP optionnelle (ldapjs, Node.js only) |
| `session.ts` | Gestion de session utilisateur (cookies httpOnly, guards) |
| `seed-defaults.ts` | Données par défaut pour les nouveaux utilisateurs |

## jwt.ts

| Export | Signature | Description |
|--------|-----------|-------------|
| `signAccessToken` | `(user: AuthUser) => Promise<string>` | JWT HS256, 15min (configurable via `JWT_ACCESS_EXPIRY`) |
| `signRefreshToken` | `(userId: string) => Promise<string>` | JWT HS256, 7j (configurable via `JWT_REFRESH_EXPIRY`) |
| `verifyAccessToken` | `(token: string) => Promise<AccessTokenPayload>` | Payload : `{ sub, email, name, isAdmin, exp }` |
| `verifyRefreshToken` | `(token: string) => Promise<RefreshTokenPayload>` | Payload : `{ sub, exp }` |
| `AccessTokenPayload` | type | Payload du token d'accès |
| `RefreshTokenPayload` | type | Payload du token de rafraîchissement |

**Runtime** : Edge-compatible (jose). Utilisé dans `proxy.ts` et les server actions.

## password.ts

| Export | Signature | Description |
|--------|-----------|-------------|
| `hashPassword` | `(password: string) => Promise<string>` | bcrypt, 12 salt rounds |
| `verifyPassword` | `(password: string, hash: string) => Promise<boolean>` | Comparaison bcrypt |

**Runtime** : Node.js only (bcryptjs). Utilisé dans les server actions auth uniquement.

## ldap.ts

| Export | Signature | Description |
|--------|-----------|-------------|
| `authenticateLdap` | `(identifier: string, password: string) => Promise<LdapUser \| null>` | Auth LDAP, retourne `{ email, name }` ou `null` |

**Activation** : uniquement si `LDAP_URL` est configuré. Retourne `null` si variables LDAP absentes.
**Runtime** : Node.js only (ldapjs).

## session.ts

| Export | Signature | Description |
|--------|-----------|-------------|
| `getCurrentUser` | `() => Promise<AuthUser \| null>` | Lit le cookie `access_token`, vérifie le JWT, retourne l'utilisateur |
| `requireAuth` | `() => Promise<AuthUser>` | Comme `getCurrentUser()` mais redirige vers `/login` si non connecté |
| `requireAdmin` | `() => Promise<AuthUser>` | Comme `requireAuth()` mais throw 403 si pas admin |
| `requireUserId` | `() => Promise<string>` | Raccourci : retourne `user.id` |
| `setAuthCookies` | `(accessToken, refreshToken) => Promise<void>` | Set cookies httpOnly (15min + 7j) |
| `clearAuthCookies` | `() => Promise<void>` | Supprime les cookies auth |

**Pattern d'usage dans les server actions** :
```typescript
const user = await requireAuth(); // redirect si non connecté
const data = await db.query.table.findMany({ where: eq(table.userId, user.id) });
```

## seed-defaults.ts

| Export | Signature | Description |
|--------|-----------|-------------|
| `seedUserDefaults` | `(userId: string) => Promise<void>` | Crée 14 catégories (avec ~42 sous-catégories), 2 comptes, préférences app |

Appelé lors de l'inscription (`registerAction`). Données créées :
- **14 catégories** : Logement, Alimentation, Transport, Santé, Loisirs, Shopping, Abonnements, Éducation, Impôts & Taxes, Épargne, Revenus, Remboursements, Cadeaux, Divers
- **2 comptes** : Compte Courant (CHECKING), Livret A (SAVINGS)
- **Préférences** : `amexEnabled: true`, `separateRecurring: true`
