import type Database from 'better-sqlite3';

export function migrate003(db: Database.Database): void {
  if (!hasColumn(db, 'relation_assertions', 'subject_kind_id')) {
    db.exec(`
      ALTER TABLE relation_assertions
      ADD COLUMN subject_kind_id TEXT REFERENCES kinds(id) ON DELETE SET NULL
    `);
  }

  if (!hasColumn(db, 'relation_assertions', 'object_kind_id')) {
    db.exec(`
      ALTER TABLE relation_assertions
      ADD COLUMN object_kind_id TEXT REFERENCES kinds(id) ON DELETE SET NULL
    `);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_relation_assertions_subject_kind
      ON relation_assertions(subject_kind_id);
    CREATE INDEX IF NOT EXISTS idx_relation_assertions_object_kind
      ON relation_assertions(object_kind_id);
  `);
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  return (db.pragma(`table_info(${table})`) as { name: string }[]).some((entry) => entry.name === column);
}
