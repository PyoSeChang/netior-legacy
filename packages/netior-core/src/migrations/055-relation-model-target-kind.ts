import type Database from 'better-sqlite3';
import { hasColumn, tableExists } from '../connection';

const RENAMED_SYSTEM_MODELS = [
  { oldKey: 'contains_relation', newKey: 'contains', name: 'Contains' },
  { oldKey: 'entry_portal_relation', newKey: 'entry_portal', name: 'Entry Portal' },
  { oldKey: 'parent_relation', newKey: 'parent', name: 'Parent Relation' },
] as const;

function updateModelReference(
  db: Database.Database,
  table: string,
  column: string,
  oldId: string,
  newId: string,
): void {
  if (!tableExists(db, table) || !hasColumn(db, table, column)) return;
  db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(newId, oldId);
}

export function migrate055(db: Database.Database): void {
  if (!tableExists(db, 'models')) return;

  db.exec(`UPDATE models SET target_kind = 'relation' WHERE target_kind = 'edge'`);

  const rows = db.prepare(`
    SELECT id, project_id, key
      FROM models
     WHERE key IN ('contains_relation', 'entry_portal_relation', 'parent_relation')
        OR source_ref IN ('model.contains_relation', 'model.entry_portal_relation', 'model.parent_relation')
  `).all() as Array<{ id: string; project_id: string; key: string }>;

  for (const row of rows) {
    const mapping = RENAMED_SYSTEM_MODELS.find((entry) => (
      row.key === entry.oldKey || row.id.endsWith(`-${entry.oldKey}`)
    ));
    if (!mapping) continue;

    const newId = row.id.endsWith(`-${mapping.oldKey}`)
      ? row.id.slice(0, -mapping.oldKey.length) + mapping.newKey
      : `model-${row.project_id}-${mapping.newKey}`;
    const existing = db.prepare('SELECT id FROM models WHERE id = ? OR (project_id = ? AND key = ?)').get(
      newId,
      row.project_id,
      mapping.newKey,
    ) as { id: string } | undefined;
    const targetId = existing?.id ?? newId;

    updateModelReference(db, 'edges', 'model_id', row.id, targetId);
    updateModelReference(db, 'relationships', 'model_id', row.id, targetId);

    if (tableExists(db, 'objects')) {
      const existingObject = db.prepare(
        "SELECT id FROM objects WHERE object_type = 'model' AND ref_id = ?",
      ).get(targetId) as { id: string } | undefined;
      if (existingObject) {
        db.prepare("DELETE FROM objects WHERE object_type = 'model' AND ref_id = ?").run(row.id);
      } else {
        db.prepare("UPDATE objects SET ref_id = ? WHERE object_type = 'model' AND ref_id = ?").run(targetId, row.id);
      }
    }

    if (existing) {
      db.prepare('DELETE FROM models WHERE id = ?').run(row.id);
      db.prepare(`
        UPDATE models
           SET key = ?,
               name = COALESCE(NULLIF(name, ''), ?),
               target_kind = 'relation',
               source_ref = CASE WHEN built_in = 1 THEN ? ELSE source_ref END,
               updated_at = datetime('now')
         WHERE id = ?
      `).run(mapping.newKey, mapping.name, `model.${mapping.newKey}`, targetId);
    } else {
      db.prepare(`
        UPDATE models
           SET id = ?,
               key = ?,
               name = ?,
               target_kind = 'relation',
               source_ref = CASE WHEN built_in = 1 THEN ? ELSE source_ref END,
               updated_at = datetime('now')
         WHERE id = ?
      `).run(targetId, mapping.newKey, mapping.name, `model.${mapping.newKey}`, row.id);
    }
  }
}
