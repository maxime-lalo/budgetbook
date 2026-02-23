#!/bin/sh
set -e

DB_PROVIDER="${DB_PROVIDER:-postgresql}"

if [ "$DB_PROVIDER" = "sqlite" ]; then
  echo "SQLite mode: pushing schema..."
  npx drizzle-kit push --force
  echo "Migrating recurring transactions..."
  DB_PATH="${DATABASE_URL:-file:./dev.db}"
  DB_PATH="${DB_PATH#file:}"
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    db.exec('UPDATE transactions SET recurring = 1 WHERE date IS NULL AND recurring = 0');
    db.close();
  " 2>/dev/null || true
else
  echo "PostgreSQL mode: pushing schema..."
  npx drizzle-kit push --force
  echo "Migrating recurring transactions..."
  node -e "
    const postgres = require('postgres');
    const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://comptes:comptes@localhost:5432/comptes');
    sql\`UPDATE transactions SET recurring = TRUE WHERE date IS NULL AND recurring = FALSE\`.then(() => sql.end()).catch(() => process.exit(0));
  " 2>/dev/null || true
fi

echo "Starting server..."
exec node server.js
