import type Database from 'better-sqlite3';

const SYSTEM_SOURCE_ID = 'netior.system';
const SYSTEM_SOURCE_VERSION = '1';
const MODEL_CATEGORY_SCHEMA_ID_PREFIX = 'schema-';

const MODEL_CATEGORIES = [
  { key: 'time', title: 'Time', sourceRef: 'model-category.time', sortOrder: 0 },
  { key: 'workflow', title: 'Workflow', sourceRef: 'model-category.workflow', sortOrder: 1 },
  { key: 'structure', title: 'Structure', sourceRef: 'model-category.structure', sortOrder: 2 },
  { key: 'knowledge', title: 'Knowledge', sourceRef: 'model-category.knowledge', sortOrder: 3 },
  { key: 'space', title: 'Space', sourceRef: 'model-category.space', sortOrder: 4 },
  { key: 'quant', title: 'Quant', sourceRef: 'model-category.quant', sortOrder: 5 },
  { key: 'governance', title: 'Governance', sourceRef: 'model-category.governance', sortOrder: 6 },
] as const;

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

function addSourceColumns(db: Database.Database, table: string): void {
  if (!tableExists(db, table)) return;
  if (!hasColumn(db, table, 'source_kind')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'project'`);
  }
  if (!hasColumn(db, table, 'source_id')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN source_id TEXT`);
  }
  if (!hasColumn(db, table, 'source_ref')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN source_ref TEXT`);
  }
  if (!hasColumn(db, table, 'source_version')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN source_version TEXT`);
  }
}

function modelCategorySchemaId(projectId: string): string {
  return `${MODEL_CATEGORY_SCHEMA_ID_PREFIX}${projectId}-model_category`;
}

function modelCategoryConceptId(projectId: string, categoryKey: string): string {
  return `concept-${projectId}-model-category-${categoryKey}`;
}

function ensureObject(
  db: Database.Database,
  objectType: string,
  scope: string,
  projectId: string | null,
  refId: string,
  createdAt: string,
): void {
  if (!tableExists(db, 'objects')) return;
  db.prepare(`
    INSERT OR IGNORE INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`object-${objectType}-${refId}`, objectType, scope, projectId, refId, createdAt);
}

function ensureModelCategoryTaxonomy(db: Database.Database): void {
  if (!tableExists(db, 'projects') || !tableExists(db, 'schemas') || !tableExists(db, 'concepts')) return;

  const now = new Date().toISOString();
  const projects = db.prepare('SELECT id FROM projects').all() as { id: string }[];
  const insertSchema = db.prepare(`
    INSERT OR IGNORE INTO schemas (
      id, project_id, name, description, icon, color, node_shape, file_template, models,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, 'Model Category', 'Built-in enum schema for semantic model categories.', 'folder-tree', '#6b7280', 'rounded', NULL, '[]',
      'system', ?, 'schema.model_category', ?, ?, ?)
  `);
  const updateSchema = db.prepare(`
    UPDATE schemas
       SET source_kind = 'system',
           source_id = ?,
           source_ref = 'schema.model_category',
           source_version = ?,
           updated_at = ?
     WHERE id = ?
  `);
  const insertConcept = db.prepare(`
    INSERT OR IGNORE INTO concepts (
      id, project_id, schema_id, recurrence_source_concept_id, recurrence_occurrence_key,
      title, color, icon, content, agent_content,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, 'system', ?, ?, ?, ?, ?)
  `);
  const updateConcept = db.prepare(`
    UPDATE concepts
       SET schema_id = ?,
           source_kind = 'system',
           source_id = ?,
           source_ref = ?,
           source_version = ?,
           updated_at = ?
     WHERE id = ?
  `);

  for (const project of projects) {
    const schemaId = modelCategorySchemaId(project.id);
    insertSchema.run(schemaId, project.id, SYSTEM_SOURCE_ID, SYSTEM_SOURCE_VERSION, now, now);
    updateSchema.run(SYSTEM_SOURCE_ID, SYSTEM_SOURCE_VERSION, now, schemaId);
    ensureObject(db, 'schema', 'project', project.id, schemaId, now);

    for (const category of MODEL_CATEGORIES) {
      const conceptId = modelCategoryConceptId(project.id, category.key);
      insertConcept.run(conceptId, project.id, schemaId, category.title, SYSTEM_SOURCE_ID, category.sourceRef, SYSTEM_SOURCE_VERSION, now, now);
      updateConcept.run(schemaId, SYSTEM_SOURCE_ID, category.sourceRef, SYSTEM_SOURCE_VERSION, now, conceptId);
      ensureObject(db, 'concept', 'project', project.id, conceptId, now);
    }
  }
}

function setModelCategoryConceptIds(db: Database.Database): void {
  if (!tableExists(db, 'models') || !hasColumn(db, 'models', 'category_concept_id')) return;
  if (!hasColumn(db, 'models', 'category')) return;
  db.exec(`
    UPDATE models
       SET category_concept_id = (
         SELECT concepts.id
           FROM concepts
          WHERE concepts.project_id = models.project_id
            AND concepts.source_ref = 'model-category.' || COALESCE(NULLIF(models.category, ''), 'knowledge')
          LIMIT 1
       )
     WHERE category_concept_id IS NULL
  `);
}

function rebuildModelsWithoutCategory(db: Database.Database): void {
  if (!tableExists(db, 'models')) return;
  if (!hasColumn(db, 'models', 'category')) return;

  db.exec(`DROP TABLE IF EXISTS models_new`);
  db.exec(`
    CREATE TABLE models_new (
      id                  TEXT PRIMARY KEY,
      project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key                 TEXT NOT NULL,
      name                TEXT NOT NULL,
      description         TEXT,
      category_concept_id TEXT REFERENCES concepts(id) ON DELETE SET NULL,
      target_kind         TEXT NOT NULL DEFAULT 'object',
      meaning_keys        TEXT NOT NULL DEFAULT '[]',
      core_slots          TEXT NOT NULL DEFAULT '[]',
      optional_slots      TEXT NOT NULL DEFAULT '[]',
      recipe_json         TEXT,
      color               TEXT,
      icon                TEXT,
      line_style          TEXT,
      directed            INTEGER,
      built_in            INTEGER NOT NULL DEFAULT 0,
      source_kind         TEXT NOT NULL DEFAULT 'project',
      source_id           TEXT,
      source_ref          TEXT,
      source_version      TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, key)
    )
  `);

  db.exec(`
    INSERT INTO models_new (
      id, project_id, key, name, description, category_concept_id, target_kind,
      meaning_keys, core_slots, optional_slots, recipe_json, color, icon,
      line_style, directed, built_in, source_kind, source_id, source_ref,
      source_version, created_at, updated_at
    )
    SELECT id, project_id, key, name, description, category_concept_id, COALESCE(target_kind, 'object'),
           COALESCE(meaning_keys, '[]'), COALESCE(core_slots, '[]'), COALESCE(optional_slots, '[]'),
           recipe_json, color, icon, line_style, directed, COALESCE(built_in, 0),
           source_kind, source_id, source_ref, source_version, created_at, updated_at
      FROM models
  `);

  db.exec(`DROP TABLE models`);
  db.exec(`ALTER TABLE models_new RENAME TO models`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_models_project ON models(project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_models_category_concept ON models(category_concept_id)`);
}

export function migrate045(db: Database.Database): void {
  addSourceColumns(db, 'schemas');
  addSourceColumns(db, 'concepts');
  addSourceColumns(db, 'models');
  addSourceColumns(db, 'schema_fields');
  addSourceColumns(db, 'schema_meanings');

  if (tableExists(db, 'models') && !hasColumn(db, 'models', 'category_concept_id')) {
    db.exec(`ALTER TABLE models ADD COLUMN category_concept_id TEXT REFERENCES concepts(id) ON DELETE SET NULL`);
  }

  if (tableExists(db, 'models')) {
    db.exec(`
      UPDATE models
         SET source_kind = CASE WHEN built_in = 1 THEN 'system' ELSE source_kind END,
             source_id = CASE WHEN built_in = 1 THEN '${SYSTEM_SOURCE_ID}' ELSE source_id END,
             source_ref = CASE WHEN built_in = 1 THEN 'model.' || key ELSE source_ref END,
             source_version = CASE WHEN built_in = 1 THEN '${SYSTEM_SOURCE_VERSION}' ELSE source_version END
    `);
  }

  ensureModelCategoryTaxonomy(db);
  setModelCategoryConceptIds(db);
  rebuildModelsWithoutCategory(db);
}
