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

function rebuildSchemasWithoutGroupId(db: Database.Database): void {
  if (!hasColumn(db, 'schemas', 'group_id')) return;

  db.exec(`
    CREATE TABLE schemas_new (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL,
      name          TEXT NOT NULL,
      description   TEXT,
      icon          TEXT,
      color         TEXT,
      node_shape    TEXT,
      file_template TEXT,
      models        TEXT NOT NULL DEFAULT '[]',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    INSERT INTO schemas_new (
      id, project_id, name, description, icon, color, node_shape,
      file_template, models, created_at, updated_at
    )
    SELECT id, project_id, name, description, icon, color, node_shape,
           file_template, COALESCE(models, '[]'), created_at, updated_at
      FROM schemas;

    DROP TABLE schemas;
    ALTER TABLE schemas_new RENAME TO schemas;
    CREATE INDEX IF NOT EXISTS idx_schemas_project ON schemas(project_id);
  `);
}

function rebuildModelsWithoutGroupId(db: Database.Database): void {
  if (!hasColumn(db, 'models', 'group_id')) return;

  db.exec(`
    CREATE TABLE models_new (
      id             TEXT PRIMARY KEY,
      project_id     TEXT NOT NULL,
      key            TEXT NOT NULL,
      name           TEXT NOT NULL,
      description    TEXT,
      category       TEXT NOT NULL DEFAULT 'knowledge',
      target_kind    TEXT NOT NULL DEFAULT 'object',
      meaning_keys   TEXT NOT NULL DEFAULT '[]',
      core_slots     TEXT NOT NULL DEFAULT '[]',
      optional_slots TEXT NOT NULL DEFAULT '[]',
      recipe_json    TEXT,
      color          TEXT,
      icon           TEXT,
      line_style     TEXT,
      directed       INTEGER,
      built_in       INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, key)
    );

    INSERT INTO models_new (
      id, project_id, key, name, description, category, target_kind,
      meaning_keys, core_slots, optional_slots, recipe_json, color, icon,
      line_style, directed, built_in, created_at, updated_at
    )
    SELECT id, project_id, key, name, description, category, COALESCE(target_kind, 'object'),
           COALESCE(meaning_keys, '[]'), COALESCE(core_slots, '[]'), COALESCE(optional_slots, '[]'),
           recipe_json, color, icon, line_style, directed, COALESCE(built_in, 0), created_at, updated_at
      FROM models;

    DROP TABLE models;
    ALTER TABLE models_new RENAME TO models;
    CREATE INDEX IF NOT EXISTS idx_models_project ON models(project_id);
  `);
}

export function migrate042(db: Database.Database): void {
  if (tableExists(db, 'objects')) {
    db.exec(`DELETE FROM objects WHERE object_type = 'type_group'`);
  }

  rebuildSchemasWithoutGroupId(db);
  rebuildModelsWithoutGroupId(db);

  db.exec('DROP TABLE IF EXISTS type_groups');
}
