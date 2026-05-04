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

function ensureSchemaTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schemas (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      group_id TEXT REFERENCES type_groups(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      node_shape TEXT,
      file_template TEXT,
      models TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_fields (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      field_type TEXT NOT NULL,
      options TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      required INTEGER NOT NULL DEFAULT 0,
      default_value TEXT,
      ref_schema_id TEXT REFERENCES schemas(id) ON DELETE SET NULL,
      meaning_slot TEXT,
      meaning_key TEXT,
      slot_binding_locked INTEGER NOT NULL DEFAULT 0,
      generated_by_model INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meanings (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      meaning_key TEXT NOT NULL,
      label TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      source_model TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(schema_id, meaning_key)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meaning_slot_bindings (
      id TEXT PRIMARY KEY,
      meaning_id TEXT NOT NULL REFERENCES schema_meanings(id) ON DELETE CASCADE,
      slot_key TEXT NOT NULL,
      target_kind TEXT NOT NULL DEFAULT 'field',
      field_id TEXT REFERENCES schema_fields(id) ON DELETE SET NULL,
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(meaning_id, slot_key, target_kind)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_schemas_project ON schemas(project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_fields_schema ON schema_fields(schema_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_meanings_schema ON schema_meanings(schema_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_meaning_slot_bindings_meaning ON schema_meaning_slot_bindings(meaning_id)`);
}

function restoreSchemasFromMergedModels(db: Database.Database): void {
  if (!tableExists(db, 'models')) return;

  const hasGroupId = hasColumn(db, 'models', 'group_id');
  const hasNodeShape = hasColumn(db, 'models', 'node_shape');
  const hasFileTemplate = hasColumn(db, 'models', 'file_template');
  const candidateConditions = [
    hasGroupId ? 'group_id IS NOT NULL' : null,
    hasNodeShape ? 'node_shape IS NOT NULL' : null,
    hasFileTemplate ? 'file_template IS NOT NULL' : null,
    tableExists(db, 'model_fields') ? 'EXISTS (SELECT 1 FROM model_fields mf WHERE mf.model_id = models.id)' : null,
    tableExists(db, 'model_meanings') ? 'EXISTS (SELECT 1 FROM model_meanings mm WHERE mm.model_id = models.id)' : null,
    tableExists(db, 'concepts') && hasColumn(db, 'concepts', 'model_id')
      ? 'EXISTS (SELECT 1 FROM concepts c WHERE c.model_id = models.id)'
      : null,
  ].filter((condition): condition is string => !!condition);

  if (candidateConditions.length === 0) return;

  const schemaCandidatePredicate = `
    COALESCE(target_kind, 'object') <> 'edge'
    AND (${candidateConditions.join(' OR ')})
  `;
  const groupIdExpr = hasGroupId
    ? "CASE WHEN group_id IS NOT NULL AND EXISTS (SELECT 1 FROM type_groups tg WHERE tg.id = group_id AND tg.kind = 'schema') THEN group_id ELSE NULL END"
    : 'NULL';
  const nodeShapeExpr = hasNodeShape ? 'node_shape' : 'NULL';
  const fileTemplateExpr = hasFileTemplate ? 'file_template' : 'NULL';

  db.exec(`
    INSERT OR IGNORE INTO schemas (
      id, project_id, group_id, name, description, icon, color,
      node_shape, file_template, models, created_at, updated_at
    )
    SELECT id, project_id,
           ${groupIdExpr},
           name, description, icon, color, ${nodeShapeExpr}, ${fileTemplateExpr},
           CASE
             WHEN key IS NOT NULL AND key <> '' THEN json_array(key)
             ELSE '[]'
           END,
           created_at, updated_at
      FROM models
     WHERE ${schemaCandidatePredicate}
  `);

  if (tableExists(db, 'concepts') && hasColumn(db, 'concepts', 'model_id') && hasColumn(db, 'concepts', 'schema_id')) {
    db.exec(`
      UPDATE concepts
         SET schema_id = model_id
       WHERE model_id IS NOT NULL
         AND (schema_id IS NULL OR schema_id = '')
         AND EXISTS (SELECT 1 FROM schemas WHERE schemas.id = concepts.model_id)
    `);
  }
}

function restoreSchemaFields(db: Database.Database): void {
  if (!tableExists(db, 'model_fields')) return;

  db.exec(`
    INSERT OR IGNORE INTO schema_fields (
      id, schema_id, name, field_type, options, sort_order, required,
      default_value, ref_schema_id, meaning_slot, meaning_key,
      slot_binding_locked, generated_by_model, created_at
    )
    SELECT id, model_id, name,
           CASE field_type WHEN 'model_ref' THEN 'schema_ref' ELSE field_type END,
           options, sort_order, required, default_value,
           CASE WHEN ref_model_id IS NOT NULL AND EXISTS (SELECT 1 FROM schemas s WHERE s.id = ref_model_id) THEN ref_model_id ELSE NULL END,
           meaning_slot, meaning_key, slot_binding_locked, generated_by_model, created_at
      FROM model_fields
     WHERE EXISTS (SELECT 1 FROM schemas s WHERE s.id = model_fields.model_id)
  `);

  if (tableExists(db, 'field_meaning_bindings')) {
    db.exec(`
      INSERT OR IGNORE INTO field_meaning_bindings (id, field_id, meaning_key, source, sort_order, created_at)
      SELECT 'field-meaning-' || id || '-' || replace(meaning_key, '.', '_'),
             id,
             meaning_key,
             CASE generated_by_model WHEN 1 THEN 'model' ELSE 'migration' END,
             sort_order,
             created_at
        FROM schema_fields
       WHERE meaning_key IS NOT NULL
         AND meaning_key <> ''
    `);
  }
}

function restoreSchemaMeanings(db: Database.Database): void {
  if (!tableExists(db, 'model_meanings')) return;

  db.exec(`
    INSERT OR IGNORE INTO schema_meanings (
      id, schema_id, meaning_key, label, source, source_model, sort_order, created_at, updated_at
    )
    SELECT id, model_id, meaning_key, label, source, source_model, sort_order, created_at, updated_at
      FROM model_meanings
     WHERE EXISTS (SELECT 1 FROM schemas s WHERE s.id = model_meanings.model_id)
  `);

  if (!tableExists(db, 'model_meaning_slot_bindings')) return;

  db.exec(`
    INSERT OR IGNORE INTO schema_meaning_slot_bindings (
      id, meaning_id, slot_key, target_kind, field_id, required, sort_order, created_at
    )
    SELECT id, meaning_id, slot_key, target_kind,
           CASE WHEN field_id IS NOT NULL AND EXISTS (SELECT 1 FROM schema_fields sf WHERE sf.id = field_id) THEN field_id ELSE NULL END,
           required, sort_order, created_at
      FROM model_meaning_slot_bindings
     WHERE EXISTS (SELECT 1 FROM schema_meanings sm WHERE sm.id = model_meaning_slot_bindings.meaning_id)
  `);
}

export function migrate038(db: Database.Database): void {
  db.exec('PRAGMA foreign_keys = OFF');
  ensureSchemaTables(db);
  restoreSchemasFromMergedModels(db);
  restoreSchemaFields(db);
  restoreSchemaMeanings(db);
  db.exec('PRAGMA foreign_keys = ON');
}
