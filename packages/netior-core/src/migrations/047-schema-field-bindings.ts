import type Database from 'better-sqlite3';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

function inferBindingKind(fieldType: string): string {
  if (fieldType === 'multi-select' || fieldType === 'tags') return 'instance_multi_select';
  if (fieldType === 'schema_ref' || fieldType === 'object') return 'schema_composition';
  if (fieldType === 'relation' || fieldType === 'select' || fieldType === 'radio') return 'instance_select';
  return 'schema_composition';
}

function inferCardinality(fieldType: string): string {
  if (fieldType === 'multi-select' || fieldType === 'tags') return 'many';
  if (fieldType === 'schema_ref' || fieldType === 'object') return 'object';
  return 'one';
}

function rebuildSchemaFieldsWithoutRefSchemaId(db: Database.Database): void {
  if (!hasColumn(db, 'schema_fields', 'ref_schema_id')) return;

  db.exec(`
    CREATE TABLE schema_fields_new (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      field_type TEXT NOT NULL,
      options TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      required INTEGER NOT NULL DEFAULT 0,
      default_value TEXT,
      meaning_slot TEXT,
      meaning_key TEXT,
      slot_binding_locked INTEGER NOT NULL DEFAULT 0,
      generated_by_model INTEGER NOT NULL DEFAULT 0,
      source_kind TEXT NOT NULL DEFAULT 'project',
      source_id TEXT,
      source_ref TEXT,
      source_version TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO schema_fields_new (
      id, schema_id, name, field_type, options, sort_order, required, default_value,
      meaning_slot, meaning_key, slot_binding_locked, generated_by_model,
      source_kind, source_id, source_ref, source_version, created_at
    )
    SELECT id, schema_id, name,
           CASE field_type WHEN 'schema_ref' THEN 'object' ELSE field_type END,
           options, sort_order, required, default_value,
           meaning_slot, meaning_key, slot_binding_locked, generated_by_model,
           COALESCE(source_kind, 'project'), source_id, source_ref, source_version, created_at
      FROM schema_fields;

    DROP TABLE schema_fields;
    ALTER TABLE schema_fields_new RENAME TO schema_fields;
    CREATE INDEX IF NOT EXISTS idx_schema_fields_schema ON schema_fields(schema_id);
  `);
}

export function migrate047(db: Database.Database): void {
  db.exec(`
    UPDATE models
       SET recipe_json = replace(recipe_json, '"schema_ref"', '"object"')
     WHERE recipe_json LIKE '%"schema_ref"%';

    CREATE TABLE IF NOT EXISTS schema_field_bindings (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL REFERENCES schema_fields(id) ON DELETE CASCADE,
      model_id TEXT REFERENCES models(id) ON DELETE SET NULL,
      binding_kind TEXT NOT NULL,
      source_schema_id TEXT REFERENCES schemas(id) ON DELETE SET NULL,
      source_field_id TEXT REFERENCES schema_fields(id) ON DELETE SET NULL,
      cardinality TEXT NOT NULL DEFAULT 'one',
      read_only INTEGER NOT NULL DEFAULT 0,
      config TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      source_kind TEXT NOT NULL DEFAULT 'project',
      source_id TEXT,
      source_ref TEXT,
      source_version TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_field_bindings_field ON schema_field_bindings(field_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_field_bindings_source_schema ON schema_field_bindings(source_schema_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schema_field_bindings_kind ON schema_field_bindings(binding_kind)`);

  if (!hasColumn(db, 'schema_fields', 'ref_schema_id')) return;

  const fields = db.prepare(`
    SELECT id, field_type, ref_schema_id, source_kind, source_id, source_ref, source_version
      FROM schema_fields
     WHERE ref_schema_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
           FROM schema_field_bindings b
          WHERE b.field_id = schema_fields.id
            AND b.source_schema_id = schema_fields.ref_schema_id
       )
  `).all() as Array<{
    id: string;
    field_type: string;
    ref_schema_id: string;
    source_kind: string | null;
    source_id: string | null;
    source_ref: string | null;
    source_version: string | null;
  }>;

  const insert = db.prepare(`
    INSERT INTO schema_field_bindings (
      id, field_id, model_id, binding_kind, source_schema_id, source_field_id,
      cardinality, read_only, config, sort_order,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, NULL, ?, ?, NULL, ?, 0, NULL, 0, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  for (const field of fields) {
    insert.run(
      `schema-field-binding-${field.id}`,
      field.id,
      inferBindingKind(field.field_type),
      field.ref_schema_id,
      inferCardinality(field.field_type),
      field.source_kind ?? 'project',
      field.source_id ?? null,
      field.source_ref ?? null,
      field.source_version ?? null,
    );
  }

  rebuildSchemaFieldsWithoutRefSchemaId(db);
}
