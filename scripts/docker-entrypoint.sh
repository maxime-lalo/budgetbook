#!/bin/sh
set -e

DB_PROVIDER="${DB_PROVIDER:-postgresql}"

if [ "$DB_PROVIDER" = "sqlite" ]; then
  echo "SQLite mode: migrating PRÉVUE → PLANNED..."
  node -e "
    const Database = require('better-sqlite3');
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '/app/data/comptes.db';
    try {
      const db = new Database(dbPath);
      const r = db.prepare(\"UPDATE transactions SET status = 'PLANNED' WHERE status = 'PRÉVUE'\").run();
      if (r.changes > 0) console.log('Migrated', r.changes, 'transactions');
      db.close();
    } catch(e) { /* table may not exist yet on first run */ }
  " || true
  echo "SQLite mode: dropping custom indexes (drizzle-kit push bug workaround)..."
  node -e "
    const Database = require('better-sqlite3');
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '/app/data/comptes.db';
    try {
      const db = new Database(dbPath);
      const rows = db.prepare(\"SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex_%'\").all();
      for (const row of rows) {
        db.prepare('DROP INDEX IF EXISTS \"' + row.name + '\"').run();
      }
      if (rows.length > 0) console.log('Dropped', rows.length, 'custom indexes');
      db.close();
    } catch(e) { /* DB may not exist yet on first run */ }
  " || true
  echo "SQLite mode: pushing schema..."
  npx drizzle-kit push --force
else
  echo "PostgreSQL mode: pushing schema..."
  npx drizzle-kit push --force
fi

echo "Starting server..."
exec node server.js
