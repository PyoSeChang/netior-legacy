import type Database from 'better-sqlite3';

export function migrate041(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_node_exclusions (
      id         TEXT PRIMARY KEY,
      network_id TEXT NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
      object_id  TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(network_id, object_id)
    )
  `);
}
