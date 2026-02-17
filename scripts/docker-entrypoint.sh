#!/bin/sh
set -e

DB_PROVIDER="${DB_PROVIDER:-postgresql}"

if [ "$DB_PROVIDER" = "sqlite" ]; then
  echo "SQLite mode: pushing schema..."
  /prisma-cli/node_modules/.bin/prisma db push --skip-generate
else
  echo "PostgreSQL mode: running migrations..."
  /prisma-cli/node_modules/.bin/prisma migrate deploy
fi

echo "Starting server..."
exec node server.js
