#!/bin/sh
set -e

DB_PROVIDER="${DB_PROVIDER:-postgresql}"

if [ "$DB_PROVIDER" = "sqlite" ]; then
  DB_PATH="${DATABASE_URL:-file:./dev.db}"
  DB_PATH="${DB_PATH#file:}"
  echo "SQLite mode: pre-migrating schema..."
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const cols = db.pragma('table_info(transactions)').map(c => c.name);
    if (!cols.includes('recurring')) {
      console.log('Adding recurring column...');
      db.exec('ALTER TABLE transactions ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0');
      const r = db.prepare('UPDATE transactions SET recurring = 1 WHERE date IS NULL AND recurring = 0').run();
      console.log('Migrated', r.changes, 'recurring transactions');
    } else {
      console.log('recurring column already exists');
    }
    db.close();
  " || true
  echo "SQLite mode: pushing schema..."
  npx drizzle-kit push --force
else
  echo "PostgreSQL mode: pre-migrating schema..."
  node -e "
    const postgres = require('postgres');
    const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://comptes:comptes@localhost:5432/comptes');
    sql\`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT FALSE\`
      .then(() => sql\`UPDATE transactions SET recurring = TRUE WHERE date IS NULL AND recurring = FALSE\`)
      .then(() => { console.log('Migration done'); return sql.end(); })
      .catch(() => { console.log('Column already exists or no data'); return sql.end(); });
  " || true
  echo "PostgreSQL mode: pushing schema..."
  npx drizzle-kit push --force
fi

echo "Starting server..."
exec node server.js
