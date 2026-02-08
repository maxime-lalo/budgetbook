# Comptes

Application web de gestion de finances personnelles, conçue pour remplacer un système Excel historique (2019-2026).

## Fonctionnalités

- **Transactions** : saisie mensuelle avec édition inline, transactions récurrentes, copie du mois précédent
- **Budgets** : allocation mensuelle par catégorie avec suivi des dépenses et report cumulatif
- **Catégories** : gestion hiérarchique (catégories + sous-catégories) avec codes couleur
- **Comptes** : comptes courants, cartes de crédit, épargne et investissement avec buckets d'objectifs
- **Statistiques** : vue annuelle, répartition par catégorie/sous-catégorie, évolution de l'épargne, comparaison N vs N-1

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Langage | TypeScript 5, React 19 |
| Base de données | PostgreSQL 17 |
| ORM | Prisma 6 |
| Validation | Zod 4 |
| UI | Shadcn/UI + Tailwind CSS 4 + Radix UI |
| Graphiques | Recharts 3 |
| Icônes | Lucide React |
| Package manager | pnpm |
| Conteneurisation | Docker multi-stage + Docker Compose |

## Démarrage rapide

### Prérequis

- Node.js 20+
- pnpm
- Docker (pour PostgreSQL)

### Installation

```bash
# Démarrer PostgreSQL
docker compose up -d db

# Installer les dépendances
pnpm install

# Générer le client Prisma et appliquer les migrations
pnpm db:generate
pnpm db:migrate

# (Optionnel) Insérer des données de démonstration
pnpm db:seed

# Lancer le serveur de développement
pnpm dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

### Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Architecture

- **Server Actions** pour toutes les mutations (pas d'API REST)
- **Server Components** pour le rendu initial, **Client Components** pour l'interactivité
- Co-localisation `_actions/` et `_components/` par route
- Navigation mensuelle via `searchParams` URL
- Montants stockés en `Decimal(12,2)`, convertis en `number` avant passage aux composants client

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL |

Copier `.env.example` en `.env` et renseigner les valeurs.
