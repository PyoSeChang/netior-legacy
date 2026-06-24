import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { InteractiveViewState, InteractiveViewStateUpsert } from '@netior/shared/types';

export function getInteractiveViewState(
  instanceId: string,
  viewTemplateId: string,
): InteractiveViewState | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM interactive_view_states WHERE instance_id = ? AND view_template_id = ?')
    .get(instanceId, viewTemplateId) as InteractiveViewState | undefined;
}

export function upsertInteractiveViewState(data: InteractiveViewStateUpsert): InteractiveViewState {
  const db = getDatabase();
  const instance = db.prepare('SELECT id, root_network_id FROM instances WHERE id = ?').get(data.instance_id) as
    | { id: string; root_network_id: string }
    | undefined;
  if (!instance) {
    throw new Error(`Instance not found for interactive view state upsert: ${data.instance_id}`);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO interactive_view_states (
       id, root_network_id, instance_id, view_template_id, state_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(instance_id, view_template_id) DO UPDATE SET
       state_json = excluded.state_json,
       updated_at = excluded.updated_at`,
  ).run(
    id,
    instance.root_network_id,
    data.instance_id,
    data.view_template_id,
    data.state_json,
    now,
    now,
  );

  return db
    .prepare('SELECT * FROM interactive_view_states WHERE instance_id = ? AND view_template_id = ?')
    .get(data.instance_id, data.view_template_id) as InteractiveViewState;
}

export function deleteInteractiveViewState(instanceId: string, viewTemplateId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare('DELETE FROM interactive_view_states WHERE instance_id = ? AND view_template_id = ?')
    .run(instanceId, viewTemplateId);
  return result.changes > 0;
}
