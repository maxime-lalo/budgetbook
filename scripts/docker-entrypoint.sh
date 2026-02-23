#!/bin/sh
set -e

DB_PROVIDER="${DB_PROVIDER:-postgresql}"

if [ "$DB_PROVIDER" = "sqlite" ]; then
  node scripts/drop-indexes.js || true
  npx drizzle-kit push --force
fi

echo "Starting server..."
exec node server.js
