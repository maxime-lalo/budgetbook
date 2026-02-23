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

      // Drop custom indexes (drizzle-kit 0.31.x generates duplicate CREATE INDEX for SQLite)
      const indexes = db.prepare(\"SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex_%'\").all();
      for (const idx of indexes) {
        db.prepare('DROP INDEX IF EXISTS \"' + idx.name + '\"').run();
      }
      if (indexes.length > 0) console.log('Dropped', indexes.length, 'custom indexes');

      // Clean orphaned FK references against intended schema
      // (tables created before FK enforcement may have orphaned references)
      const fkChecks = [
        ['transactions', 'accountId',            'accounts',       'id', false],
        ['transactions', 'destinationAccountId', 'accounts',       'id', true],
        ['transactions', 'categoryId',           'categories',     'id', true],
        ['transactions', 'subCategoryId',        'sub_categories', 'id', true],
        ['transactions', 'bucketId',             'buckets',        'id', true],
        ['budgets',      'categoryId',           'categories',     'id', false],
        ['buckets',      'accountId',            'accounts',       'id', false],
        ['sub_categories','categoryId',          'categories',     'id', false],
        ['accounts',     'linkedAccountId',      'accounts',       'id', true],
      ];
      let totalFixed = 0;
      for (const [table, col, parent, parentCol, nullable] of fkChecks) {
        try {
          const orphans = db.prepare(
            'SELECT COUNT(*) as cnt FROM \"' + table + '\" WHERE \"' + col + '\" IS NOT NULL AND \"' + col + '\" NOT IN (SELECT \"' + parentCol + '\" FROM \"' + parent + '\")'
          ).get();
          if (orphans.cnt > 0) {
            if (nullable) {
              db.prepare('UPDATE \"' + table + '\" SET \"' + col + '\" = NULL WHERE \"' + col + '\" IS NOT NULL AND \"' + col + '\" NOT IN (SELECT \"' + parentCol + '\" FROM \"' + parent + '\")').run();
              console.log('Nulled ' + orphans.cnt + ' orphaned ' + table + '.' + col);
            } else {
              db.prepare('DELETE FROM \"' + table + '\" WHERE \"' + col + '\" NOT IN (SELECT \"' + parentCol + '\" FROM \"' + parent + '\")').run();
              console.log('Deleted ' + orphans.cnt + ' rows from ' + table + ' (orphaned ' + col + ')');
            }
            totalFixed += orphans.cnt;
          }
        } catch(e) { /* table may not exist yet */ }
      }
      if (totalFixed > 0) console.log('Total FK fixes: ' + totalFixed);

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
