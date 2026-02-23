// Workaround: drizzle-kit 0.31.x generates duplicate CREATE INDEX for SQLite.
// Drop all custom indexes so push can recreate them cleanly.
// TODO: remove when drizzle-kit 1.0 stable is released.
const Database = require("better-sqlite3");
const dbPath = (process.env.DATABASE_URL ?? "").replace("file:", "") || "/app/data/comptes.db";
try {
  const db = new Database(dbPath);
  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex_%'")
    .all();
  for (const idx of indexes) {
    db.prepare(`DROP INDEX IF EXISTS "${idx.name}"`).run();
  }
  if (indexes.length > 0) console.log("Dropped", indexes.length, "custom indexes");
  db.close();
} catch {
  /* DB may not exist yet on first run */
}
