import type Database from 'better-sqlite3';
import { tableExists } from '../connection';

export function migrate059(db: Database.Database): void {
  if (!tableExists(db, 'projects') || !tableExists(db, 'meanings')) return;

  db.exec(`
    INSERT OR IGNORE INTO meanings (
      id, project_id, key, name, description, category_instance_id,
      target_kind, meaning_keys, core_slots, optional_slots, recipe_json,
      color, icon, line_style, directed, built_in,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    SELECT
      'meaning-' || p.id || '-depends_on',
      p.id,
      'depends_on',
      'Depends On',
      'Connects an object to another object it depends on before it can proceed.',
      c.id,
      'relation',
      '[]',
      '[]',
      '[]',
      '{"meanings":[],"rules":[]}',
      NULL,
      'git-branch',
      NULL,
      1,
      1,
      'system',
      'netior.system',
      'meaning.depends_on',
      '1',
      datetime('now'),
      datetime('now')
    FROM projects p
    LEFT JOIN instances c
      ON c.project_id = p.id
     AND c.source_ref = 'meaning-category.workflow'
    WHERE NOT EXISTS (
      SELECT 1
        FROM meanings existing
       WHERE existing.project_id = p.id
         AND existing.key = 'depends_on'
    )
  `);

  if (!tableExists(db, 'objects')) return;

  db.exec(`
    INSERT OR IGNORE INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    SELECT
      'object-meaning-' || p.id || '-depends_on',
      'meaning',
      'project',
      p.id,
      'meaning-' || p.id || '-depends_on',
      datetime('now')
    FROM projects p
    WHERE EXISTS (
      SELECT 1
        FROM meanings m
       WHERE m.id = 'meaning-' || p.id || '-depends_on'
    )
  `);
}
