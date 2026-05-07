import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

export function migrate043(db: Database.Database): void {
  if (!hasColumn(db, 'concepts', 'model_id')) return;

  const schemaIdExpr = hasColumn(db, 'concepts', 'schema_id')
    ? `
      CASE
        WHEN schema_id IS NOT NULL AND schema_id <> '' THEN schema_id
        WHEN model_id IS NOT NULL AND EXISTS (SELECT 1 FROM schemas WHERE schemas.id = concepts.model_id) THEN model_id
        ELSE NULL
      END
    `
    : `
      CASE
        WHEN model_id IS NOT NULL AND EXISTS (SELECT 1 FROM schemas WHERE schemas.id = concepts.model_id) THEN model_id
        ELSE NULL
      END
    `;

  db.exec(`
    CREATE TABLE concepts_new (
      id                           TEXT PRIMARY KEY,
      project_id                   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      schema_id                    TEXT REFERENCES schemas(id) ON DELETE SET NULL,
      recurrence_source_concept_id TEXT REFERENCES concepts(id) ON DELETE SET NULL,
      recurrence_occurrence_key    TEXT,
      title                        TEXT NOT NULL,
      color                        TEXT,
      icon                         TEXT,
      content                      TEXT,
      agent_content                TEXT,
      created_at                   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO concepts_new (
      id, project_id, schema_id, recurrence_source_concept_id,
      recurrence_occurrence_key, title, color, icon, content,
      agent_content, created_at, updated_at
    )
    SELECT id, project_id, ${schemaIdExpr}, recurrence_source_concept_id,
           recurrence_occurrence_key, title, color, icon, content,
           agent_content, created_at, updated_at
      FROM concepts;

    DROP TABLE concepts;
    ALTER TABLE concepts_new RENAME TO concepts;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_concepts_recurrence_source_key
    ON concepts (recurrence_source_concept_id, recurrence_occurrence_key)
    WHERE recurrence_source_concept_id IS NOT NULL
      AND recurrence_occurrence_key IS NOT NULL;
  `);
}
