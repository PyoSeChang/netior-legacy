import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { InstanceEditorPrefs, InstanceEditorPrefsUpdate } from '@netior/shared/types';

export function getEditorPrefs(instanceId: string): InstanceEditorPrefs | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM instance_editor_prefs WHERE instance_id = ?')
    .get(instanceId) as InstanceEditorPrefs | undefined;
}

export function upsertEditorPrefs(instanceId: string, data: InstanceEditorPrefsUpdate): InstanceEditorPrefs {
  const db = getDatabase();
  const existing = db
    .prepare('SELECT * FROM instance_editor_prefs WHERE instance_id = ?')
    .get(instanceId) as InstanceEditorPrefs | undefined;

  const now = new Date().toISOString();

  if (existing) {
    db.prepare(
      `UPDATE instance_editor_prefs
       SET view_mode = ?, float_x = ?, float_y = ?, float_width = ?, float_height = ?, side_split_ratio = ?, updated_at = ?
       WHERE instance_id = ?`,
    ).run(
      data.view_mode !== undefined ? data.view_mode : existing.view_mode,
      data.float_x !== undefined ? data.float_x : existing.float_x,
      data.float_y !== undefined ? data.float_y : existing.float_y,
      data.float_width !== undefined ? data.float_width : existing.float_width,
      data.float_height !== undefined ? data.float_height : existing.float_height,
      data.side_split_ratio !== undefined ? data.side_split_ratio : existing.side_split_ratio,
      now,
      instanceId,
    );
  } else {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO instance_editor_prefs (id, instance_id, view_mode, float_x, float_y, float_width, float_height, side_split_ratio, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      instanceId,
      data.view_mode ?? 'float',
      data.float_x ?? null,
      data.float_y ?? null,
      data.float_width ?? 600,
      data.float_height ?? 450,
      data.side_split_ratio ?? 0.5,
      now,
    );
  }

  return db
    .prepare('SELECT * FROM instance_editor_prefs WHERE instance_id = ?')
    .get(instanceId) as InstanceEditorPrefs;
}
