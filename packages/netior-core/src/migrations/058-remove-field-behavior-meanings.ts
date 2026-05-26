import type Database from 'better-sqlite3';
import { hasColumn, tableExists } from '../connection';

const FIELD_BEHAVIOR_MEANING_KEYS = [
  'instance_select',
  'instance_multi_select',
  'schema_composition',
  'schema_extension',
  'conditional_field',
  'computed_field',
  'derived_collection',
] as const;

function placeholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ');
}

function scrubSchemaMeaningRefs(db: Database.Database): void {
  if (!tableExists(db, 'schemas') || !hasColumn(db, 'schemas', 'meanings')) return;

  const keySet = new Set<string>(FIELD_BEHAVIOR_MEANING_KEYS);
  const rows = db.prepare('SELECT id, meanings FROM schemas WHERE meanings IS NOT NULL AND meanings <> ?').all('[]') as {
    id: string;
    meanings: string | null;
  }[];
  const update = db.prepare('UPDATE schemas SET meanings = ?, updated_at = ? WHERE id = ?');
  const now = new Date().toISOString();

  for (const row of rows) {
    if (!row.meanings) continue;
    let refs: unknown;
    try {
      refs = JSON.parse(row.meanings);
    } catch {
      continue;
    }
    if (!Array.isArray(refs)) continue;
    const nextRefs = refs.filter((ref) => !(typeof ref === 'string' && keySet.has(ref)));
    if (nextRefs.length === refs.length) continue;
    update.run(JSON.stringify(nextRefs), now, row.id);
  }
}

export function migrate058(db: Database.Database): void {
  if (!tableExists(db, 'meanings')) return;

  const keyPlaceholders = placeholders(FIELD_BEHAVIOR_MEANING_KEYS);
  const rows = db.prepare(
    `SELECT id, key
       FROM meanings
      WHERE built_in = 1
        AND key IN (${keyPlaceholders})`,
  ).all(...FIELD_BEHAVIOR_MEANING_KEYS) as { id: string; key: string }[];
  const meaningIds = rows.map((row) => row.id);

  scrubSchemaMeaningRefs(db);

  if (tableExists(db, 'schema_meanings') && hasColumn(db, 'schema_meanings', 'source_meaning')) {
    db.prepare(
      `UPDATE schema_meanings
          SET source = 'manual', source_meaning = NULL
        WHERE source_meaning IN (${keyPlaceholders})`,
    ).run(...FIELD_BEHAVIOR_MEANING_KEYS);
  }

  if (meaningIds.length === 0) return;
  const idPlaceholders = placeholders(meaningIds);

  for (const table of ['schema_field_bindings', 'relationships', 'edges']) {
    if (tableExists(db, table) && hasColumn(db, table, 'meaning_id')) {
      db.prepare(`UPDATE ${table} SET meaning_id = NULL WHERE meaning_id IN (${idPlaceholders})`).run(...meaningIds);
    }
  }

  if (tableExists(db, 'objects')) {
    const objectRows = db.prepare(
      `SELECT id
         FROM objects
        WHERE object_type = 'meaning'
          AND ref_id IN (${idPlaceholders})`,
    ).all(...meaningIds) as { id: string }[];
    const objectIds = objectRows.map((row) => row.id);

    if (objectIds.length > 0) {
      const objectPlaceholders = placeholders(objectIds);
      if (tableExists(db, 'network_nodes')) {
        db.prepare(`DELETE FROM network_nodes WHERE object_id IN (${objectPlaceholders})`).run(...objectIds);
      }
      db.prepare(`DELETE FROM objects WHERE id IN (${objectPlaceholders})`).run(...objectIds);
    }
  }

  db.prepare(`DELETE FROM meanings WHERE id IN (${idPlaceholders})`).run(...meaningIds);
}
