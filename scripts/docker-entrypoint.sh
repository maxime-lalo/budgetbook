#!/bin/sh
set -e

DB_PROVIDER="${DB_PROVIDER:-postgresql}"

if [ "$DB_PROVIDER" = "sqlite" ]; then
  echo "SQLite mode: pre-push migrations..."
  node -e "
    const Database = require('better-sqlite3');
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '/app/data/comptes.db';
    try {
      const db = new Database(dbPath);
      db.pragma('foreign_keys = OFF');

      // Migrate PRÉVUE → PLANNED
      try {
        const r = db.prepare(\"UPDATE transactions SET status = 'PLANNED' WHERE status = 'PRÉVUE'\").run();
        if (r.changes > 0) console.log('Migrated', r.changes, 'PRÉVUE → PLANNED');
      } catch(e) { /* table may not exist yet */ }

      // Drop custom indexes (drizzle-kit 0.31.x generates duplicate CREATE INDEX for SQLite)
      const indexes = db.prepare(\"SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex_%'\").all();
      for (const idx of indexes) {
        db.prepare('DROP INDEX IF EXISTS \"' + idx.name + '\"').run();
      }
      if (indexes.length > 0) console.log('Dropped', indexes.length, 'custom indexes');

      // Manual schema migrations — add missing columns so drizzle-kit push
      // detects 'No changes' and skips table rebuilds (which fail on FK checks)
      const columns = db.prepare(\"PRAGMA table_info('api_tokens')\").all();
      if (!columns.find(c => c.name === 'tokenPrefix')) {
        db.prepare(\"ALTER TABLE api_tokens ADD COLUMN tokenPrefix text NOT NULL DEFAULT ''\").run();
        console.log('Added tokenPrefix column to api_tokens');
      }

      // Fix orphaned FK references (data predating FK enforcement)
      const violations = db.pragma('foreign_key_check');
      if (violations.length > 0) {
        console.log('Found', violations.length, 'FK violations, cleaning up...');
        const fkCache = {};
        let nulled = 0, deleted = 0;
        for (const v of violations) {
          const cacheKey = v.table + '_' + v.fkid;
          if (!fkCache[cacheKey]) {
            const fks = db.pragma('foreign_key_list(\"' + v.table + '\")');
            fkCache[cacheKey] = fks.find(f => f.id === v.fkid);
          }
          const fk = fkCache[cacheKey];
          if (fk) {
            try {
              db.prepare('UPDATE \"' + v.table + '\" SET \"' + fk.from + '\" = NULL WHERE rowid = ?').run(v.rowid);
              nulled++;
            } catch(e) {
              // Column is NOT NULL — delete the row
              db.prepare('DELETE FROM \"' + v.table + '\" WHERE rowid = ?').run(v.rowid);
              deleted++;
            }
          }
        }
        console.log('FK cleanup: ' + nulled + ' nulled, ' + deleted + ' deleted');
      }

      db.close();
    } catch(e) { console.log('Pre-push skipped (first run):', e.message); }
  " || true
  echo "SQLite mode: pushing schema..."
  npx drizzle-kit push --force
else
  echo "PostgreSQL mode: pushing schema..."
  npx drizzle-kit push --force
fi

echo "Starting server..."
exec node server.js
