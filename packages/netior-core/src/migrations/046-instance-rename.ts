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

export function migrate046(db: Database.Database): void {
  renameTable(db, 'concepts', 'instances');
  renameTable(db, 'concept_properties', 'instance_properties');
  renameTable(db, 'concept_editor_prefs', 'instance_editor_prefs');

  renameColumn(db, 'instances', 'recurrence_source_concept_id', 'recurrence_source_instance_id');
  renameColumn(db, 'instance_properties', 'concept_id', 'instance_id');
  renameColumn(db, 'instance_editor_prefs', 'concept_id', 'instance_id');
  renameColumn(db, 'models', 'category_concept_id', 'category_instance_id');

  if (tableExists(db, 'objects')) {
    db.exec(`
      UPDATE objects
         SET object_type = 'instance'
       WHERE object_type = 'concept'
    `);
  }

  if (tableExists(db, 'objects')) {
    db.exec(`
      UPDATE objects
         SET id = 'object-instance-' || substr(id, length('object-concept-') + 1)
       WHERE id LIKE 'object-concept-%'
         AND NOT EXISTS (
           SELECT 1
             FROM objects existing
            WHERE existing.id = 'object-instance-' || substr(objects.id, length('object-concept-') + 1)
         )
    `);
  }

  if (tableExists(db, 'network_nodes')) {
    db.exec(`
      UPDATE network_nodes
         SET object_id = 'object-instance-' || substr(object_id, length('object-concept-') + 1)
       WHERE object_id LIKE 'object-concept-%'
         AND EXISTS (
           SELECT 1
             FROM objects
            WHERE objects.id = 'object-instance-' || substr(network_nodes.object_id, length('object-concept-') + 1)
         )
    `);
  }

  if (tableExists(db, 'network_node_exclusions')) {
    db.exec(`
      UPDATE network_node_exclusions
         SET object_id = 'object-instance-' || substr(object_id, length('object-concept-') + 1)
       WHERE object_id LIKE 'object-concept-%'
         AND EXISTS (
           SELECT 1
             FROM objects
            WHERE objects.id = 'object-instance-' || substr(network_node_exclusions.object_id, length('object-concept-') + 1)
         )
    `);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_instance_properties_instance ON instance_properties(instance_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_instance_properties_field ON instance_properties(field_id)`);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_recurrence_source_key
    ON instances (recurrence_source_instance_id, recurrence_occurrence_key)
    WHERE recurrence_source_instance_id IS NOT NULL
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_models_category_instance ON models(category_instance_id)`);
}
