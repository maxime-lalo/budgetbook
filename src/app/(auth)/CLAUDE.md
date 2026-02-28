# (auth)/ — Routes d'authentification

Route group Next.js pour les pages publiques d'authentification. Layout minimal sans sidebar.

## Layout (`layout.tsx`)

- Conteneur centré (`max-w-md`), fond atténué
- Pas de sidebar ni navigation — pages standalone

## Routes

### `/login` — Connexion

**Page** (`login/page.tsx`) : Server Component, affiche `LoginForm` + lien vers `/register` (si `REGISTRATION_ENABLED`).

**Composant** (`login/_components/login-form.tsx`) : Client Component
- Champs : Identifiant (email ou pseudo LDAP) + Mot de passe
- Appelle `loginAction(identifier, password)` au submit
- Affiche les erreurs de connexion via état local

### `/register` — Inscription

**Page** (`register/page.tsx`) : Server Component, redirige vers `/login` si `REGISTRATION_ENABLED === false`.

**Composant** (`register/_components/register-form.tsx`) : Client Component
- Champs : Nom, Email, Mot de passe (min 8 chars)
- Appelle `registerAction(name, email, password)` au submit
- Crée un compte local avec `seedUserDefaults()` (14 catégories, 2 comptes, préférences)

## Server Actions (`_actions/auth-actions.ts`)

| Fonction | Description |
|----------|-------------|
| `loginAction(identifier, password)` | Tente LDAP d'abord (si configuré), puis auth locale. Crée session JWT |
| `registerAction(name, email, password)` | Crée un user local + seed défauts + session JWT |
| `logoutAction()` | Supprime cookies auth + refresh token en BDD |

### Flow de connexion

1. `loginAction()` tente `authenticateLdap()` si `LDAP_URL` est configuré
2. Si LDAP échoue/absent, tente auth locale via `verifyPassword()`
3. En cas de succès : `signAccessToken()` + `signRefreshToken()` → cookies httpOnly
4. Le hash du refresh token est stocké en BDD (`refreshTokens` table)
5. Redirect vers `/` après connexion

### Flow d'inscription

1. Vérifie que `REGISTRATION_ENABLED` est actif
2. Vérifie que l'email n'existe pas déjà
3. Crée le user avec `hashPassword()`, provider `"local"`
4. Appelle `seedUserDefaults(userId)` pour les données par défaut
5. Crée la session JWT comme pour le login
