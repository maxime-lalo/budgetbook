# BudgetBook

A personal finance management web app, built to replace a historical Excel system (2019-2026).

## Features

- **Transactions**: monthly entry with inline editing, recurring transactions, copy from previous month
- **Budgets**: monthly allocation per category with expense tracking and cumulative carry-over
- **Categories**: hierarchical management (categories + subcategories) with color codes
- **Accounts**: checking, credit card, savings and investment accounts with goal-based buckets
- **Statistics**: yearly overview, category/subcategory breakdown, savings evolution, year-over-year comparison
- **REST API**: Bearer token-secured endpoints for external integrations (Tasker, n8n)
- **Settings**: API token management (generate, view, regenerate)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5, React 19 |
| Database | PostgreSQL 17 |
| ORM | Prisma 6 |
| Validation | Zod 4 |
| UI | Shadcn/UI + Tailwind CSS 4 + Radix UI |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Notifications | Sonner |
| Theme | next-themes (dark/light/system) |
| Dates | date-fns (locale fr) |
| Package manager | pnpm |
| Containerization | Docker multi-stage + Docker Compose |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- Docker (for PostgreSQL)

### Installation

```bash
# Start PostgreSQL
docker compose up -d db

# Install dependencies
pnpm install

# Generate Prisma client and apply migrations
pnpm db:generate
pnpm db:migrate

# (Optional) Seed demo data
pnpm db:seed

# Start the development server
pnpm dev
```

The app is available at [http://localhost:3000](http://localhost:3000).

### Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Architecture

- **Server Actions** for all UI mutations (no REST API on the frontend side)
- **REST API** (`/api/*`) for external integrations, secured by Bearer token
- **Server Components** for initial render, **Client Components** for interactivity
- Co-located `_actions/` and `_components/` per route
- Monthly navigation via URL `searchParams`
- Amounts stored as `Decimal(12,2)`, converted to `number` before passing to client components

## REST API

Endpoints for external integrations (e.g. Tasker → n8n → API), secured by Bearer token.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transactions` | POST | Create a transaction |
| `/api/categories` | GET | List categories with subcategories |
| `/api/accounts` | GET | List accounts |

### Authentication

Generate a token from the `/settings` page, then use it as a Bearer token:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/categories
```

### Create a transaction

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"label": "Groceries", "amount": -45.90, "categoryId": "<id>"}'
```

Optional fields: `date` (default: today), `accountId` (default: first checking account), `status` (default: PENDING), `subCategoryId`, `isAmex`.

### Authelia configuration

When deployed behind Authelia, add a bypass rule for API routes:

```yaml
access_control:
  rules:
    - domain: comptes.example.com
      resources: "^/api/"
      policy: bypass
```

## Project Structure

```
comptes/
├── prisma/                  # Schema, migrations, seed, import scripts
├── src/
│   ├── app/
│   │   ├── transactions/    # Monthly transactions view (main page)
│   │   ├── budgets/         # Monthly budgets per category
│   │   ├── categories/      # Category/subcategory CRUD
│   │   ├── accounts/        # Accounts & buckets management
│   │   ├── statistics/      # Charts & analytics (Recharts)
│   │   ├── settings/        # Settings (API token management)
│   │   └── api/             # REST API (transactions, categories, accounts)
│   ├── components/
│   │   ├── ui/              # Shadcn/UI (auto-generated)
│   │   └── layout/          # Sidebar, mobile-nav, theme
│   └── lib/                 # Prisma singleton, validators, formatters, hooks
├── docker-compose.yml       # Dev: PostgreSQL only
├── docker-compose.prod.yml  # Prod: App + PostgreSQL
└── Dockerfile               # Multi-stage standalone build
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server (localhost:3000) |
| `pnpm build` | Production build (prisma generate + next build) |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Prisma Studio GUI |
| `pnpm db:generate` | Generate Prisma client |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL |
| `DB_PASSWORD` | Database password (production only) |

Copy `.env.example` to `.env` and fill in the values.

## License

This project is licensed under [CC BY-NC 4.0](LICENSE). Non-commercial use only. For commercial licensing, contact the author.
