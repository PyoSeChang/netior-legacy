import type Database from 'better-sqlite3';
import { hasColumn, tableExists } from '../connection';

function addColumn(db: Database.Database, table: string, column: string, definition: string): void {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function migrate054(db: Database.Database): void {
  if (!tableExists(db, 'objects') || !tableExists(db, 'edges') || !tableExists(db, 'networks')) {
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS relationships (
      id               TEXT PRIMARY KEY,
      project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_object_id TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      target_object_id TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      model_id         TEXT REFERENCES models(id) ON DELETE SET NULL,
      description      TEXT,
      properties_json  TEXT,
      source_kind      TEXT NOT NULL DEFAULT 'project',
      source_id        TEXT,
      source_ref       TEXT,
      source_version   TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_relationships_project ON relationships(project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_relationships_source_object ON relationships(source_object_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_relationships_target_object ON relationships(target_object_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_relationships_model ON relationships(model_id)`);

  addColumn(db, 'edges', 'relationship_id', 'TEXT REFERENCES relationships(id) ON DELETE SET NULL');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_relationship ON edges(relationship_id)`);

  db.exec(`
    INSERT OR IGNORE INTO relationships (
      id, project_id, source_object_id, target_object_id, model_id, description,
      properties_json, source_kind, source_id, source_ref, source_version,
      created_at, updated_at
    )
    SELECT
      'relationship-' || e.id,
      n.project_id,
      src.object_id,
      tgt.object_id,
      e.model_id,
      e.description,
      json_object('migratedFromEdgeId', e.id),
      'project',
      NULL,
      NULL,
      NULL,
      e.created_at,
      e.created_at
    FROM edges e
    JOIN networks n ON n.id = e.network_id
    JOIN network_nodes src ON src.id = e.source_node_id
    JOIN network_nodes tgt ON tgt.id = e.target_node_id
    WHERE e.relationship_id IS NULL
      AND n.project_id IS NOT NULL
  `);

  db.exec(`
    UPDATE edges
       SET relationship_id = 'relationship-' || id
     WHERE relationship_id IS NULL
       AND EXISTS (
         SELECT 1 FROM relationships
          WHERE relationships.id = 'relationship-' || edges.id
       )
  `);
}
