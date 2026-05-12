import type Database from 'better-sqlite3';

export function migrate049(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS interactive_view_templates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      target_kind TEXT NOT NULL CHECK (target_kind IN ('project', 'schema', 'instance')),
      target_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      source_code TEXT NOT NULL,
      manifest_json TEXT NOT NULL DEFAULT '{}',
      source_kind TEXT NOT NULL CHECK (source_kind IN ('manual', 'narre', 'built_in')) DEFAULT 'manual',
      trust_level TEXT NOT NULL CHECK (trust_level IN ('untrusted', 'validated', 'trusted', 'built_in')) DEFAULT 'untrusted',
      default_runtime TEXT NOT NULL CHECK (default_runtime IN ('host', 'sandbox')) DEFAULT 'sandbox',
      enabled INTEGER NOT NULL DEFAULT 1,
      validation_status TEXT NOT NULL CHECK (validation_status IN ('unknown', 'passed', 'failed')) DEFAULT 'unknown',
      validation_errors_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (
        (target_kind = 'project' AND target_id IS NULL)
        OR (target_kind IN ('schema', 'instance') AND target_id IS NOT NULL)
      )
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS interactive_view_preferences (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      selected_view_template_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(instance_id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_interactive_view_templates_project ON interactive_view_templates(project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_interactive_view_templates_target ON interactive_view_templates(target_kind, target_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_interactive_view_preferences_project ON interactive_view_preferences(project_id)`);
}
