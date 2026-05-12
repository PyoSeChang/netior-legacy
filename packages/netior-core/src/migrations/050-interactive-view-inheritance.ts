import type Database from 'better-sqlite3';

export function migrate050(db: Database.Database): void {
  const prefColumns = db.prepare('PRAGMA table_info(interactive_view_preferences)').all() as Array<{ name: string }>;
  if (!prefColumns.some((column) => column.name === 'preference_mode')) {
    db.exec(`
      ALTER TABLE interactive_view_preferences
      ADD COLUMN preference_mode TEXT NOT NULL DEFAULT 'inherit'
      CHECK (preference_mode IN ('inherit', 'template', 'none'))
    `);

    db.exec(`
      UPDATE interactive_view_preferences
      SET preference_mode = CASE
        WHEN selected_view_template_id IS NULL THEN 'inherit'
        ELSE 'template'
      END
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS interactive_view_schema_preferences (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      selected_view_template_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(schema_id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_interactive_view_schema_preferences_project ON interactive_view_schema_preferences(project_id)`);
}
