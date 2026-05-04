import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function fieldMeaningBindingsTargetsSchemaFields(db: Database.Database): boolean {
  if (!tableExists(db, 'field_meaning_bindings')) return true;
  const foreignKeys = db.prepare('PRAGMA foreign_key_list(field_meaning_bindings)').all() as Array<{
    table: string;
    from: string;
  }>;
  return foreignKeys.some((fk) => fk.from === 'field_id' && fk.table === 'schema_fields');
}

export function migrate039(db: Database.Database): void {
  if (!tableExists(db, 'field_meaning_bindings') || fieldMeaningBindingsTargetsSchemaFields(db)) {
    return;
  }

  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(`DROP TABLE IF EXISTS field_meaning_bindings_new`);
  db.exec(`
    CREATE TABLE field_meaning_bindings_new (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL REFERENCES schema_fields(id) ON DELETE CASCADE,
      meaning_key TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      strength REAL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(field_id, meaning_key)
    )
  `);

  db.exec(`
    INSERT OR IGNORE INTO field_meaning_bindings_new (
      id, field_id, meaning_key, source, strength, sort_order, created_at
    )
    SELECT id, field_id, meaning_key, source, strength, sort_order, created_at
      FROM field_meaning_bindings
     WHERE EXISTS (SELECT 1 FROM schema_fields WHERE schema_fields.id = field_meaning_bindings.field_id)
  `);

  db.exec(`DROP TABLE field_meaning_bindings`);
  db.exec(`ALTER TABLE field_meaning_bindings_new RENAME TO field_meaning_bindings`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_field_meaning_bindings_field ON field_meaning_bindings(field_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_field_meaning_bindings_meaning ON field_meaning_bindings(meaning_key)`);
  db.exec('PRAGMA foreign_keys = ON');
}
