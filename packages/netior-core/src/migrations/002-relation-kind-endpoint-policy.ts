import type Database from 'better-sqlite3';

export function migrate002(db: Database.Database): void {
  if (!hasColumn(db, 'relation_kinds', 'endpoint_policy_shape')) {
    db.exec(`
      ALTER TABLE relation_kinds
      ADD COLUMN endpoint_policy_shape TEXT NOT NULL DEFAULT 'many_to_many'
        CHECK (endpoint_policy_shape IN ('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'))
    `);
  }

  if (!tableExists(db, 'relation_kind_endpoint_pairs')) {
    db.exec(`
      CREATE TABLE relation_kind_endpoint_pairs (
        id TEXT PRIMARY KEY,
        relation_kind_id TEXT NOT NULL REFERENCES relation_kinds(id) ON DELETE CASCADE,
        subject_kind_id TEXT NOT NULL REFERENCES kinds(id) ON DELETE CASCADE,
        object_kind_id TEXT NOT NULL REFERENCES kinds(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(relation_kind_id, subject_kind_id, object_kind_id)
      );

      CREATE INDEX idx_relation_kind_endpoint_pairs_relation_kind
        ON relation_kind_endpoint_pairs(relation_kind_id);
      CREATE INDEX idx_relation_kind_endpoint_pairs_subject_kind
        ON relation_kind_endpoint_pairs(subject_kind_id);
      CREATE INDEX idx_relation_kind_endpoint_pairs_object_kind
        ON relation_kind_endpoint_pairs(object_kind_id);
    `);
  }
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  return (db.pragma(`table_info(${table})`) as { name: string }[]).some((entry) => entry.name === column);
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table),
  );
}
