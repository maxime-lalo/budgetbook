FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies ---
FROM base AS deps
ARG DB_PROVIDER=postgresql
ENV DB_PROVIDER=${DB_PROVIDER}
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY prisma/schema.base.prisma prisma/schema.base.prisma
COPY scripts/setup-db.ts scripts/setup-db.ts
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS builder
ARG DB_PROVIDER=postgresql
ENV DB_PROVIDER=${DB_PROVIDER}
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy URL pour le build — conditionnel selon le provider
RUN if [ "$DB_PROVIDER" = "sqlite" ]; then \
      DATABASE_URL="file:./dummy.db" pnpm build; \
    else \
      DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm build; \
    fi

# --- Prisma CLI ---
FROM node:22-alpine AS prisma-cli
WORKDIR /prisma-cli
RUN npm init -y && npm install prisma@6

# --- Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Dossier pour la base SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI for runtime migrations
COPY --from=prisma-cli /prisma-cli/node_modules /prisma-cli/node_modules

# Entrypoint script
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
