import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type {
  NetworkEdgeType,
  NetworkEdgeTypeCreate,
  NetworkEdgeTypeUpdate,
  NetworkNodeType,
  NetworkNodeTypeCreate,
  NetworkNodeTypeUpdate,
  NetworkType,
  NetworkTypeCreate,
  NetworkTypeUpdate,
  OntologySourceKind,
} from '@netior/shared/types';

const DEFAULT_JSON = '{}';

function assertProjectOwned(kind: string, row: { source_kind: string; key: string }): void {
  if (row.source_kind !== 'project') {
    throw new Error(`Built-in ${kind} cannot be mutated: ${row.key}`);
  }
}

function sourceKind(value: OntologySourceKind | undefined): OntologySourceKind {
  return value ?? 'project';
}

export function listNetworkTypes(projectId?: string | null): NetworkType[] {
  const db = getDatabase();
  if (projectId) {
    return db.prepare(
      `SELECT * FROM network_types
        WHERE project_id IS NULL OR project_id = ?
        ORDER BY CASE source_kind WHEN 'system' THEN 0 ELSE 1 END, name`,
    ).all(projectId) as NetworkType[];
  }

  return db.prepare(
    `SELECT * FROM network_types
      WHERE project_id IS NULL
      ORDER BY CASE source_kind WHEN 'system' THEN 0 ELSE 1 END, name`,
  ).all() as NetworkType[];
}

export function getNetworkType(id: string): NetworkType | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM network_types WHERE id = ?').get(id) as NetworkType | undefined;
}

export function getNetworkTypeByKey(key: string, projectId?: string | null): NetworkType | undefined {
  const db = getDatabase();
  if (projectId) {
    return db.prepare(
      `SELECT * FROM network_types
        WHERE key = ? AND (project_id = ? OR project_id IS NULL)
        ORDER BY CASE WHEN project_id = ? THEN 0 ELSE 1 END
        LIMIT 1`,
    ).get(key, projectId, projectId) as NetworkType | undefined;
  }

  return db.prepare(
    `SELECT * FROM network_types WHERE key = ? AND project_id IS NULL LIMIT 1`,
  ).get(key) as NetworkType | undefined;
}

export function createNetworkType(data: NetworkTypeCreate): NetworkType {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO network_types (
      id, project_id, key, name, description, source_kind, source_id, source_ref,
      source_version, surface_runtime, grammar_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.project_id ?? null,
    data.key,
    data.name,
    data.description ?? null,
    sourceKind(data.source_kind),
    data.source_id ?? null,
    data.source_ref ?? null,
    data.source_version ?? null,
    data.surface_runtime,
    data.grammar_json ?? DEFAULT_JSON,
    now,
    now,
  );

  return getNetworkType(id) as NetworkType;
}

export function updateNetworkType(id: string, data: NetworkTypeUpdate): NetworkType | undefined {
  const db = getDatabase();
  const existing = getNetworkType(id);
  if (!existing) return undefined;
  assertProjectOwned('network type', existing);

  db.prepare(`
    UPDATE network_types
       SET name = ?,
           description = ?,
           grammar_json = ?,
           updated_at = ?
     WHERE id = ?
  `).run(
    data.name ?? existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.grammar_json ?? existing.grammar_json,
    new Date().toISOString(),
    id,
  );

  return getNetworkType(id);
}

export function deleteNetworkType(id: string): boolean {
  const db = getDatabase();
  const existing = getNetworkType(id);
  if (!existing) return false;
  assertProjectOwned('network type', existing);
  const result = db.prepare('DELETE FROM network_types WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listNodeTypes(networkTypeId: string): NetworkNodeType[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM node_types WHERE network_type_id = ? ORDER BY name',
  ).all(networkTypeId) as NetworkNodeType[];
}

export function getNodeType(id: string): NetworkNodeType | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM node_types WHERE id = ?').get(id) as NetworkNodeType | undefined;
}

export function createNodeType(data: NetworkNodeTypeCreate): NetworkNodeType {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO node_types (
      id, network_type_id, key, name, description, source_kind, source_id, source_ref,
      source_version, renderer_key, presentation_json, projection_json,
      interface_json, placement_json, interaction_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.network_type_id,
    data.key,
    data.name,
    data.description ?? null,
    sourceKind(data.source_kind),
    data.source_id ?? null,
    data.source_ref ?? null,
    data.source_version ?? null,
    data.renderer_key,
    data.presentation_json ?? DEFAULT_JSON,
    data.projection_json ?? DEFAULT_JSON,
    data.interface_json ?? DEFAULT_JSON,
    data.placement_json ?? DEFAULT_JSON,
    data.interaction_json ?? DEFAULT_JSON,
    now,
    now,
  );

  return getNodeType(id) as NetworkNodeType;
}

export function updateNodeType(id: string, data: NetworkNodeTypeUpdate): NetworkNodeType | undefined {
  const db = getDatabase();
  const existing = getNodeType(id);
  if (!existing) return undefined;
  assertProjectOwned('node type', existing);

  db.prepare(`
    UPDATE node_types
       SET name = ?,
           description = ?,
           renderer_key = ?,
           presentation_json = ?,
           projection_json = ?,
           interface_json = ?,
           placement_json = ?,
           interaction_json = ?,
           updated_at = ?
     WHERE id = ?
  `).run(
    data.name ?? existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.renderer_key ?? existing.renderer_key,
    data.presentation_json ?? existing.presentation_json,
    data.projection_json ?? existing.projection_json,
    data.interface_json ?? existing.interface_json,
    data.placement_json ?? existing.placement_json,
    data.interaction_json ?? existing.interaction_json,
    new Date().toISOString(),
    id,
  );

  return getNodeType(id);
}

export function deleteNodeType(id: string): boolean {
  const db = getDatabase();
  const existing = getNodeType(id);
  if (!existing) return false;
  assertProjectOwned('node type', existing);
  const result = db.prepare('DELETE FROM node_types WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listEdgeTypes(networkTypeId: string): NetworkEdgeType[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM edge_types WHERE network_type_id = ? ORDER BY name',
  ).all(networkTypeId) as NetworkEdgeType[];
}

export function getEdgeType(id: string): NetworkEdgeType | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM edge_types WHERE id = ?').get(id) as NetworkEdgeType | undefined;
}

export function createEdgeType(data: NetworkEdgeTypeCreate): NetworkEdgeType {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO edge_types (
      id, network_type_id, key, name, description, source_kind, source_id, source_ref,
      source_version, renderer_key, presentation_json, routing_json,
      interface_json, interaction_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.network_type_id,
    data.key,
    data.name,
    data.description ?? null,
    sourceKind(data.source_kind),
    data.source_id ?? null,
    data.source_ref ?? null,
    data.source_version ?? null,
    data.renderer_key,
    data.presentation_json ?? DEFAULT_JSON,
    data.routing_json ?? DEFAULT_JSON,
    data.interface_json ?? DEFAULT_JSON,
    data.interaction_json ?? DEFAULT_JSON,
    now,
    now,
  );

  return getEdgeType(id) as NetworkEdgeType;
}

export function updateEdgeType(id: string, data: NetworkEdgeTypeUpdate): NetworkEdgeType | undefined {
  const db = getDatabase();
  const existing = getEdgeType(id);
  if (!existing) return undefined;
  assertProjectOwned('edge type', existing);

  db.prepare(`
    UPDATE edge_types
       SET name = ?,
           description = ?,
           renderer_key = ?,
           presentation_json = ?,
           routing_json = ?,
           interface_json = ?,
           interaction_json = ?,
           updated_at = ?
     WHERE id = ?
  `).run(
    data.name ?? existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.renderer_key ?? existing.renderer_key,
    data.presentation_json ?? existing.presentation_json,
    data.routing_json ?? existing.routing_json,
    data.interface_json ?? existing.interface_json,
    data.interaction_json ?? existing.interaction_json,
    new Date().toISOString(),
    id,
  );

  return getEdgeType(id);
}

export function deleteEdgeType(id: string): boolean {
  const db = getDatabase();
  const existing = getEdgeType(id);
  if (!existing) return false;
  assertProjectOwned('edge type', existing);
  const result = db.prepare('DELETE FROM edge_types WHERE id = ?').run(id);
  return result.changes > 0;
}
