import type Database from 'better-sqlite3';

export function migrate051(db: Database.Database): void {
  db.exec(`
    DELETE FROM interactive_view_states
    WHERE view_template_id IN (
      SELECT id FROM interactive_view_templates
      WHERE target_kind = 'project'
         OR source_kind = 'built_in'
         OR trust_level = 'built_in'
    )
  `);

  db.exec(`
    DELETE FROM interactive_view_preferences
    WHERE selected_view_template_id IN (
      SELECT id FROM interactive_view_templates
      WHERE target_kind = 'project'
         OR source_kind = 'built_in'
         OR trust_level = 'built_in'
    )
  `);

  db.exec(`
    DELETE FROM interactive_view_schema_preferences
    WHERE selected_view_template_id IN (
      SELECT id FROM interactive_view_templates
      WHERE target_kind = 'project'
         OR source_kind = 'built_in'
         OR trust_level = 'built_in'
    )
  `);

  db.exec(`
    CREATE TABLE interactive_view_templates_next (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      target_kind TEXT NOT NULL CHECK (target_kind IN ('schema', 'instance')),
      target_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      source_code TEXT NOT NULL,
      manifest_json TEXT NOT NULL DEFAULT '{}',
      source_kind TEXT NOT NULL CHECK (source_kind IN ('manual', 'narre')) DEFAULT 'manual',
      trust_level TEXT NOT NULL CHECK (trust_level IN ('untrusted', 'validated', 'trusted')) DEFAULT 'untrusted',
      default_runtime TEXT NOT NULL CHECK (default_runtime IN ('host', 'sandbox')) DEFAULT 'sandbox',
      enabled INTEGER NOT NULL DEFAULT 1,
      validation_status TEXT NOT NULL CHECK (validation_status IN ('unknown', 'passed', 'failed')) DEFAULT 'unknown',
      validation_errors_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (target_kind IN ('schema', 'instance') AND target_id IS NOT NULL)
    )
  `);

  db.exec(`
    INSERT INTO interactive_view_templates_next (
      id, project_id, target_kind, target_id, name, description, source_code,
      manifest_json, source_kind, trust_level, default_runtime, enabled,
      validation_status, validation_errors_json, created_at, updated_at
    )
    SELECT
      id, project_id, target_kind, target_id, name, description, source_code,
      manifest_json, source_kind, trust_level, default_runtime, enabled,
      validation_status, validation_errors_json, created_at, updated_at
    FROM interactive_view_templates
    WHERE target_kind IN ('schema', 'instance')
      AND target_id IS NOT NULL
      AND source_kind IN ('manual', 'narre')
      AND trust_level IN ('untrusted', 'validated', 'trusted')
  `);

  db.exec(`DROP TABLE interactive_view_templates`);
  db.exec(`ALTER TABLE interactive_view_templates_next RENAME TO interactive_view_templates`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_interactive_view_templates_project ON interactive_view_templates(project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_interactive_view_templates_target ON interactive_view_templates(target_kind, target_id)`);
}
