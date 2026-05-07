import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { ConceptProperty, ConceptPropertyUpsert } from '@netior/shared/types';

export function upsertProperty(data: ConceptPropertyUpsert): ConceptProperty {
  const db = getDatabase();
  const id = randomUUID();
  const concept = db.prepare('SELECT id, schema_id FROM concepts WHERE id = ?').get(data.concept_id) as
    | { id: string; schema_id: string | null }
    | undefined;
  if (!concept) {
    throw new Error(`Concept not found for property upsert: ${data.concept_id}`);
  }

  const field = db.prepare('SELECT id, schema_id FROM schema_fields WHERE id = ?').get(data.field_id) as
    | { id: string; schema_id: string }
    | undefined;
  if (!field) {
    throw new Error(`Schema field not found for property upsert: ${data.field_id}`);
  }

  if (concept.schema_id !== field.schema_id) {
    throw new Error(
      `Schema field does not belong to concept schema: concept=${data.concept_id}, concept_schema=${concept.schema_id ?? 'null'}, field=${data.field_id}, field_schema=${field.schema_id}`,
    );
  }

  db.prepare(
    `INSERT INTO concept_properties (id, concept_id, field_id, value)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(concept_id, field_id) DO UPDATE SET value = excluded.value`,
  ).run(id, data.concept_id, data.field_id, data.value);

  return db.prepare(
    'SELECT * FROM concept_properties WHERE concept_id = ? AND field_id = ?',
  ).get(data.concept_id, data.field_id) as ConceptProperty;
}

export function getByConceptId(conceptId: string): ConceptProperty[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM concept_properties WHERE concept_id = ?')
    .all(conceptId) as ConceptProperty[];
}

export function deleteProperty(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM concept_properties WHERE id = ?').run(id);
  return result.changes > 0;
}
