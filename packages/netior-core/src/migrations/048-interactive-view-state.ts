import type Database from 'better-sqlite3';

export function migrate048(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS interactive_view_states (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      view_template_id TEXT NOT NULL,
      state_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(instance_id, view_template_id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_interactive_view_states_project ON interactive_view_states(project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_interactive_view_states_instance ON interactive_view_states(instance_id)`);
}
