import type Database from 'better-sqlite3';
import { hasColumn, tableExists } from '../connection';

function renameTable(db: Database.Database, from: string, to: string): void {
  if (tableExists(db, from) && !tableExists(db, to)) {
    db.exec(`ALTER TABLE ${from} RENAME TO ${to}`);
  }
}

function renameColumn(db: Database.Database, table: string, from: string, to: string): void {
  if (tableExists(db, table) && hasColumn(db, table, from) && !hasColumn(db, table, to)) {
    db.exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  }
}

function replaceSourceRefs(db: Database.Database, table: string): void {
  if (!tableExists(db, table) || !hasColumn(db, table, 'source_ref')) return;

  db.exec(`
    UPDATE ${table}
       SET source_ref = CASE
         WHEN source_ref = 'schema.model_category' THEN 'schema.meaning_category'
         WHEN source_ref LIKE 'model-category.%' THEN 'meaning-category.' || substr(source_ref, length('model-category.') + 1)
         WHEN source_ref LIKE 'model.%' THEN 'meaning.' || substr(source_ref, length('model.') + 1)
         ELSE source_ref
       END
     WHERE source_ref = 'schema.model_category'
        OR source_ref LIKE 'model-category.%'
        OR source_ref LIKE 'model.%'
  `);
}

export function migrate056(db: Database.Database): void {
  renameTable(db, 'models', 'meanings');

  renameColumn(db, 'schemas', 'models', 'meanings');
  renameColumn(db, 'schema_meanings', 'source_model', 'source_meaning');
  renameColumn(db, 'schema_fields', 'generated_by_model', 'generated_by_meaning');
  renameColumn(db, 'schema_field_bindings', 'model_id', 'meaning_id');
  renameColumn(db, 'relationships', 'model_id', 'meaning_id');
  renameColumn(db, 'edges', 'model_id', 'meaning_id');

  if (tableExists(db, 'meanings')) {
    db.exec(`
      UPDATE meanings
         SET id = 'meaning-' || substr(id, length('model-') + 1)
       WHERE id LIKE 'model-%'
         AND NOT EXISTS (
           SELECT 1 FROM meanings existing
            WHERE existing.id = 'meaning-' || substr(meanings.id, length('model-') + 1)
         )
    `);
    replaceSourceRefs(db, 'meanings');
  }

  if (tableExists(db, 'objects')) {
    db.exec(`UPDATE objects SET object_type = 'meaning' WHERE object_type = 'model'`);
    db.exec(`
      UPDATE objects
         SET ref_id = 'meaning-' || substr(ref_id, length('model-') + 1)
       WHERE object_type = 'meaning'
         AND ref_id LIKE 'model-%'
         AND EXISTS (
           SELECT 1 FROM meanings
            WHERE meanings.id = 'meaning-' || substr(objects.ref_id, length('model-') + 1)
         )
    `);
  }

  for (const table of ['edges', 'relationships', 'schema_field_bindings']) {
    if (tableExists(db, table) && hasColumn(db, table, 'meaning_id')) {
      db.exec(`
        UPDATE ${table}
           SET meaning_id = 'meaning-' || substr(meaning_id, length('model-') + 1)
         WHERE meaning_id LIKE 'model-%'
      `);
    }
  }

  for (const table of ['schemas', 'instances', 'schema_meanings', 'schema_fields', 'schema_field_bindings', 'relationships', 'network_types', 'node_types', 'edge_types', 'interactive_view_templates']) {
    replaceSourceRefs(db, table);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_meanings_project ON meanings(project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meanings_category_instance ON meanings(category_instance_id)`);
  if (tableExists(db, 'relationships') && hasColumn(db, 'relationships', 'meaning_id')) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_relationships_meaning ON relationships(meaning_id)`);
  }
  if (tableExists(db, 'edges') && hasColumn(db, 'edges', 'meaning_id')) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_meaning ON edges(meaning_id)`);
  }
}
