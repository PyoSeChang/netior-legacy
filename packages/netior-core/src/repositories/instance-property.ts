import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { InstanceProperty, InstancePropertyUpsert } from '@netior/shared/types';

export function upsertProperty(data: InstancePropertyUpsert): InstanceProperty {
  const db = getDatabase();
  const id = randomUUID();
  const instance = db.prepare('SELECT id, schema_id FROM instances WHERE id = ?').get(data.instance_id) as
    | { id: string; schema_id: string | null }
    | undefined;
  if (!instance) {
    throw new Error(`Instance not found for property upsert: ${data.instance_id}`);
  }

  const field = db.prepare('SELECT id, schema_id FROM schema_fields WHERE id = ?').get(data.field_id) as
    | { id: string; schema_id: string }
    | undefined;
  if (!field) {
    throw new Error(`Schema field not found for property upsert: ${data.field_id}`);
  }

  if (instance.schema_id !== field.schema_id) {
    throw new Error(
      `Schema field does not belong to instance schema: instance=${data.instance_id}, instance_schema=${instance.schema_id ?? 'null'}, field=${data.field_id}, field_schema=${field.schema_id}`,
    );
  }

  db.prepare(
    `INSERT INTO instance_properties (id, instance_id, field_id, value)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(instance_id, field_id) DO UPDATE SET value = excluded.value`,
  ).run(id, data.instance_id, data.field_id, data.value);

  return db.prepare(
    'SELECT * FROM instance_properties WHERE instance_id = ? AND field_id = ?',
  ).get(data.instance_id, data.field_id) as InstanceProperty;
}

export function getByInstanceId(instanceId: string): InstanceProperty[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM instance_properties WHERE instance_id = ?')
    .all(instanceId) as InstanceProperty[];
}

export function deleteProperty(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM instance_properties WHERE id = ?').run(id);
  return result.changes > 0;
}
