import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { getDefaultOwnerNetworkIdForWorldDb } from './network-scope';
import type {
  Relationship,
  RelationshipCreate,
  RelationshipListFilters,
  RelationshipUpdate,
} from '@netior/shared/types';

function validateJsonObject(raw: string | null | undefined, label: string): string | null {
  if (raw == null || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must decode to a JSON object`);
    }
    return JSON.stringify(parsed);
  } catch (error) {
    throw new Error(`${label} must be valid JSON object text: ${(error as Error).message}`);
  }
}

export function listRelationships(filters: RelationshipListFilters): Relationship[] {
  const db = getDatabase();
  const where = ['root_network_id = ?'];
  const values: unknown[] = [filters.root_network_id];

  if (filters.source_object_id) {
    where.push('source_object_id = ?');
    values.push(filters.source_object_id);
  }
  if (filters.target_object_id) {
    where.push('target_object_id = ?');
    values.push(filters.target_object_id);
  }
  if (filters.meaning_id) {
    where.push('meaning_id = ?');
    values.push(filters.meaning_id);
  }

  return db.prepare(`
    SELECT * FROM relationships
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
  `).all(...values) as Relationship[];
}

export function getRelationship(id: string): Relationship | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM relationships WHERE id = ?').get(id) as Relationship | undefined;
}

export function createRelationship(data: RelationshipCreate): Relationship {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const propertiesJson = validateJsonObject(data.properties_json, 'properties_json');
  const ownerNetworkId = data.owner_network_id ?? getDefaultOwnerNetworkIdForWorldDb(db, data.root_network_id);

  db.prepare(`
    INSERT INTO relationships (
      id, root_network_id, owner_network_id, source_object_id, target_object_id, meaning_id, description,
      properties_json, source_kind, source_id, source_ref, source_version,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.root_network_id,
    ownerNetworkId,
    data.source_object_id,
    data.target_object_id,
    data.meaning_id ?? null,
    data.description ?? null,
    propertiesJson,
    data.source_kind ?? 'world',
    data.source_id ?? null,
    data.source_ref ?? null,
    data.source_version ?? null,
    now,
    now,
  );

  return getRelationship(id) as Relationship;
}

export function updateRelationship(id: string, data: RelationshipUpdate): Relationship | undefined {
  const db = getDatabase();
  const existing = getRelationship(id);
  if (!existing) return undefined;

  const nextPropertiesJson = data.properties_json !== undefined
    ? validateJsonObject(data.properties_json, 'properties_json')
    : existing.properties_json;

  db.prepare(`
    UPDATE relationships
       SET owner_network_id = ?,
           meaning_id = ?,
           description = ?,
           properties_json = ?,
           source_kind = ?,
           source_id = ?,
           source_ref = ?,
           source_version = ?,
           updated_at = ?
     WHERE id = ?
  `).run(
    data.owner_network_id !== undefined ? data.owner_network_id : existing.owner_network_id,
    data.meaning_id !== undefined ? data.meaning_id : existing.meaning_id,
    data.description !== undefined ? data.description : existing.description,
    nextPropertiesJson,
    data.source_kind !== undefined ? data.source_kind : existing.source_kind,
    data.source_id !== undefined ? data.source_id : existing.source_id,
    data.source_ref !== undefined ? data.source_ref : existing.source_ref,
    data.source_version !== undefined ? data.source_version : existing.source_version,
    new Date().toISOString(),
    id,
  );

  return getRelationship(id);
}

export function deleteRelationship(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM relationships WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listRelationshipOccurrences(relationshipId: string): Array<{
  edge_id: string;
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type_id: string | null;
}> {
  const db = getDatabase();
  return db.prepare(`
    SELECT id AS edge_id, network_id, source_node_id, target_node_id, edge_type_id
      FROM edges
     WHERE relationship_id = ?
     ORDER BY created_at DESC
  `).all(relationshipId) as Array<{
    edge_id: string;
    network_id: string;
    source_node_id: string;
    target_node_id: string;
    edge_type_id: string | null;
  }>;
}
