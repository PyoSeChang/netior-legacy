import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function conceptPropertiesTargetsSchemaFields(db: Database.Database): boolean {
  if (!tableExists(db, 'concept_properties')) return true;
  const foreignKeys = db.prepare('PRAGMA foreign_key_list(concept_properties)').all() as Array<{
    table: string;
    from: string;
  }>;
  return foreignKeys.some((fk) => fk.from === 'field_id' && fk.table === 'schema_fields');
}

export function migrate044(db: Database.Database): void {
  if (!tableExists(db, 'concept_properties') || conceptPropertiesTargetsSchemaFields(db)) {
    return;
  }

  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(`DROP TABLE IF EXISTS concept_properties_new`);
  db.exec(`
    CREATE TABLE concept_properties_new (
      id TEXT PRIMARY KEY,
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      field_id TEXT NOT NULL REFERENCES schema_fields(id) ON DELETE CASCADE,
      value TEXT,
      UNIQUE(concept_id, field_id)
    )
  `);

  db.exec(`
    INSERT OR IGNORE INTO concept_properties_new (id, concept_id, field_id, value)
    SELECT id, concept_id, field_id, value
      FROM concept_properties
     WHERE EXISTS (SELECT 1 FROM concepts WHERE concepts.id = concept_properties.concept_id)
       AND EXISTS (SELECT 1 FROM schema_fields WHERE schema_fields.id = concept_properties.field_id)
  `);

  db.exec(`DROP TABLE concept_properties`);
  db.exec(`ALTER TABLE concept_properties_new RENAME TO concept_properties`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_concept_properties_concept ON concept_properties(concept_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_concept_properties_field ON concept_properties(field_id)`);
  db.exec('PRAGMA foreign_keys = ON');
}
