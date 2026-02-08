# BudgetBook

A personal finance management web app, built to replace a historical Excel system (2019-2026).

## Features

- **Transactions**: monthly entry with inline editing, recurring transactions, copy from previous month
- **Budgets**: monthly allocation per category with expense tracking and cumulative carry-over
- **Categories**: hierarchical management (categories + subcategories) with color codes
- **Accounts**: checking, credit card, savings and investment accounts with goal-based buckets
- **Statistics**: yearly overview, category/subcategory breakdown, savings evolution, year-over-year comparison

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5, React 19 |
| Database | PostgreSQL 17 |
| ORM | Prisma 6 |
| Validation | Zod 4 |
| UI | Shadcn/UI + Tailwind CSS 4 + Radix UI |
| Charts | Recharts 3 |
| Icons | Lucide React |
| Package manager | pnpm |
| Containerization | Docker multi-stage + Docker Compose |

## Getting Started

### Prerequisites

- Node.js 20+
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

- **Server Actions** for all mutations (no REST API)
- **Server Components** for initial render, **Client Components** for interactivity
- Co-located `_actions/` and `_components/` per route
- Monthly navigation via URL `searchParams`
- Amounts stored as `Decimal(12,2)`, converted to `number` before passing to client components

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL |

Copy `.env.example` to `.env` and fill in the values.

## License

This project is licensed under [CC BY-NC 4.0](LICENSE). Non-commercial use only. For commercial licensing, contact the author.
