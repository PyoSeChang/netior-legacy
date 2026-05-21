import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { Network, NetworkNode, NetworkObjectType, ObjectRecord } from '@netior/shared/types';
import { listModelCategoriesForProjectDb } from './model-category';

type NetworkScope = 'app' | 'project';
type SystemNetworkKind = 'universe' | 'ontology';
type OntologyObjectRole = 'model' | 'model_category';

const DEFAULT_NETWORK_TYPE_ID = 'network-type-default';
const DEFAULT_BASIC_NODE_TYPE_ID = 'node-type-default-basic';

function insertNetworkLayout(db: Database.Database, networkId: string, now: string): void {
  db.prepare(
    `INSERT INTO layouts (id, layout_type, network_id, context_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), 'freeform', networkId, null, now, now);
}

function ensureNetworkLayout(db: Database.Database, networkId: string): string | null {
  const existing = db.prepare('SELECT id FROM layouts WHERE network_id = ?').get(networkId) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO layouts (id, layout_type, network_id, context_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, 'freeform', networkId, null, now, now);
  return id;
}

function getObjectForDb(
  db: Database.Database,
  objectType: NetworkObjectType,
  refId: string,
): ObjectRecord | undefined {
  return db.prepare(
    'SELECT * FROM objects WHERE object_type = ? AND ref_id = ?',
  ).get(objectType, refId) as ObjectRecord | undefined;
}

function insertObject(
  db: Database.Database,
  objectType: NetworkObjectType,
  scope: NetworkScope,
  projectId: string | null,
  refId: string,
  now: string,
): ObjectRecord {
  const id = randomUUID();

  db.prepare(
    `INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, objectType, scope, projectId, refId, now);

  return db.prepare('SELECT * FROM objects WHERE id = ?').get(id) as ObjectRecord;
}

function ensureObjectForDb(
  db: Database.Database,
  objectType: NetworkObjectType,
  scope: NetworkScope,
  projectId: string | null,
  refId: string,
  createdAt?: string,
): ObjectRecord {
  const existing = getObjectForDb(db, objectType, refId);
  if (existing) return existing;

  return insertObject(db, objectType, scope, projectId, refId, createdAt ?? new Date().toISOString());
}

function insertSystemNetwork(
  db: Database.Database,
  data: {
    projectId: string | null;
    name: string;
    scope: NetworkScope;
    kind: SystemNetworkKind;
    parentNetworkId: string | null;
  },
): Network {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO networks (id, project_id, network_type_id, name, scope, kind, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.projectId, DEFAULT_NETWORK_TYPE_ID, data.name, data.scope, data.kind, data.parentNetworkId, now, now);

  insertNetworkLayout(db, id, now);
  ensureObjectForDb(db, 'network', data.scope, data.projectId, id, now);

  return db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network;
}

function normalizeSystemNetwork(
  db: Database.Database,
  network: Network,
  data: {
    name: string;
    scope: NetworkScope;
    kind: SystemNetworkKind;
    parentNetworkId: string | null;
  },
): Network {
  if (
    network.name === data.name
    && network.scope === data.scope
    && network.kind === data.kind
    && network.parent_network_id === data.parentNetworkId
    && network.network_type_id === DEFAULT_NETWORK_TYPE_ID
  ) {
    ensureObjectForDb(db, 'network', data.scope, network.project_id, network.id, network.created_at);
    ensureNetworkLayout(db, network.id);
    return network;
  }

  db.prepare(
    `UPDATE networks
        SET name = ?, scope = ?, kind = ?, parent_network_id = ?, network_type_id = ?, updated_at = ?
      WHERE id = ?`,
  ).run(data.name, data.scope, data.kind, data.parentNetworkId, DEFAULT_NETWORK_TYPE_ID, new Date().toISOString(), network.id);

  ensureObjectForDb(db, 'network', data.scope, network.project_id, network.id, network.created_at);
  ensureNetworkLayout(db, network.id);
  return db.prepare('SELECT * FROM networks WHERE id = ?').get(network.id) as Network;
}

function insertNetworkNode(
  db: Database.Database,
  networkId: string,
  objectId: string,
  nodeType: string,
  metadata: string | null,
  now: string,
): NetworkNode {
  const id = randomUUID();

  db.prepare(
    `INSERT INTO network_nodes (id, network_id, object_id, node_type, node_type_id, parent_node_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, networkId, objectId, nodeType, DEFAULT_BASIC_NODE_TYPE_ID, null, metadata, now, now);

  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

function preserveCollapsedState(
  db: Database.Database,
  layoutId: string,
  nodeId: string,
  positionJson: string,
): string {
  const existing = db.prepare(
    'SELECT position_json FROM layout_nodes WHERE layout_id = ? AND node_id = ?',
  ).get(layoutId, nodeId) as { position_json: string | null } | undefined;
  if (!existing?.position_json) return positionJson;

  try {
    const next = JSON.parse(positionJson) as Record<string, unknown>;
    const current = JSON.parse(existing.position_json) as Record<string, unknown>;
    if (next.collapsed === undefined && current.collapsed === true) {
      next.collapsed = true;
      return JSON.stringify(next);
    }
  } catch {
    return positionJson;
  }

  return positionJson;
}

function setNodePosition(db: Database.Database, layoutId: string, nodeId: string, positionJson: string): void {
  const nextPositionJson = preserveCollapsedState(db, layoutId, nodeId, positionJson);
  db.prepare(
    `INSERT INTO layout_nodes (id, layout_id, node_id, position_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(layout_id, node_id) DO UPDATE SET position_json = excluded.position_json`,
  ).run(randomUUID(), layoutId, nodeId, nextPositionJson);
}

function ensureNodePosition(db: Database.Database, layoutId: string, nodeId: string, positionJson: string): void {
  const existing = db.prepare(
    'SELECT id FROM layout_nodes WHERE layout_id = ? AND node_id = ?',
  ).get(layoutId, nodeId) as { id: string } | undefined;
  if (existing) return;

  setNodePosition(db, layoutId, nodeId, positionJson);
}

export function ensureObjectNodeInNetworkForDb(
  db: Database.Database,
  data: {
    networkId: string;
    objectId: string;
    nodeType?: string;
    metadata?: string | null;
    positionJson?: string;
  },
): NetworkNode {
  const nodeType = data.nodeType ?? 'basic';
  const metadata = data.metadata ?? null;
  const existing = db.prepare(
    'SELECT * FROM network_nodes WHERE network_id = ? AND object_id = ?',
  ).get(data.networkId, data.objectId) as NetworkNode | undefined;

  const layoutId = data.positionJson ? ensureNetworkLayout(db, data.networkId) : null;
  if (existing) {
    if (existing.node_type !== nodeType || existing.node_type_id !== DEFAULT_BASIC_NODE_TYPE_ID || existing.metadata !== metadata) {
      db.prepare(
        'UPDATE network_nodes SET node_type = ?, node_type_id = ?, metadata = ?, updated_at = ? WHERE id = ?',
      ).run(nodeType, DEFAULT_BASIC_NODE_TYPE_ID, metadata, new Date().toISOString(), existing.id);
    }
    if (layoutId && data.positionJson) {
      ensureNodePosition(db, layoutId, existing.id, data.positionJson);
    }
    return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(existing.id) as NetworkNode;
  }

  const node = insertNetworkNode(db, data.networkId, data.objectId, nodeType, metadata, new Date().toISOString());
  if (layoutId && data.positionJson) {
    setNodePosition(db, layoutId, node.id, data.positionJson);
  }
  return node;
}

export function getUniverseNetworkForDb(db: Database.Database): Network | undefined {
  return db.prepare(
    `SELECT * FROM networks WHERE kind = 'universe' ORDER BY created_at LIMIT 1`,
  ).get() as Network | undefined;
}

export function ensureUniverseNetworkForDb(db: Database.Database): Network {
  const existing = getUniverseNetworkForDb(db);
  if (existing) {
    return normalizeSystemNetwork(db, existing, {
      name: 'Universe',
      scope: 'app',
      kind: 'universe',
      parentNetworkId: null,
    });
  }

  return insertSystemNetwork(db, {
    projectId: null,
    name: 'Universe',
    scope: 'app',
    kind: 'universe',
    parentNetworkId: null,
  });
}

function getProjectOntologyNetworkRecordForDb(db: Database.Database, projectId: string): Network | undefined {
  const ontology = db.prepare(
    `SELECT * FROM networks
      WHERE kind = 'ontology'
        AND scope = 'project'
        AND project_id = ?
      ORDER BY created_at
      LIMIT 1`,
  ).get(projectId) as Network | undefined;
  if (ontology) return ontology;

  return db.prepare(
    `SELECT * FROM networks
      WHERE scope = 'project'
        AND project_id = ?
        AND parent_network_id IN (SELECT id FROM networks WHERE kind = 'universe')
      ORDER BY created_at
      LIMIT 1`,
  ).get(projectId) as Network | undefined;
}

export function getProjectOntologyNetworkForDb(db: Database.Database, projectId: string): Network | undefined {
  const ontology = getProjectOntologyNetworkRecordForDb(db, projectId);
  if (!ontology) return undefined;

  return normalizeSystemNetwork(db, ontology, {
    name: 'Ontology',
    scope: 'project',
    kind: 'ontology',
    parentNetworkId: null,
  });
}

function ensureProjectOntologyNetworkRecordForDb(db: Database.Database, projectId: string): Network {
  const existing = getProjectOntologyNetworkRecordForDb(db, projectId);
  if (existing) {
    return normalizeSystemNetwork(db, existing, {
      name: 'Ontology',
      scope: 'project',
      kind: 'ontology',
      parentNetworkId: null,
    });
  }

  return insertSystemNetwork(db, {
    projectId,
    name: 'Ontology',
    scope: 'project',
    kind: 'ontology',
    parentNetworkId: null,
  });
}

function getProjectNodeInUniverseForDb(db: Database.Database, projectId: string): NetworkNode | undefined {
  const universe = getUniverseNetworkForDb(db);
  if (!universe) return undefined;

  return db.prepare(
    `SELECT nn.*
     FROM network_nodes nn
     JOIN objects o ON nn.object_id = o.id
     WHERE nn.network_id = ? AND o.object_type = 'project' AND o.ref_id = ?`,
  ).get(universe.id, projectId) as NetworkNode | undefined;
}

function getUniverseProjectNodeCount(db: Database.Database, universeId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as count
     FROM network_nodes nn
     JOIN objects o ON nn.object_id = o.id
     WHERE nn.network_id = ? AND o.object_type = 'project'`,
  ).get(universeId) as { count: number };

  return row.count;
}

function getDefaultProjectNodePosition(index: number): string {
  const columns = 3;
  const horizontalGap = 320;
  const verticalGap = 220;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = (column - 1) * horizontalGap;
  const y = row * verticalGap;

  return JSON.stringify({ x, y });
}

export function ensureProjectNodeInUniverseForDb(db: Database.Database, projectId: string): NetworkNode {
  const existing = getProjectNodeInUniverseForDb(db, projectId);
  if (existing) return existing;

  const universe = ensureUniverseNetworkForDb(db);
  const projectObject = ensureObjectForDb(db, 'project', 'app', null, projectId);
  const node = ensureObjectNodeInNetworkForDb(db, {
    networkId: universe.id,
    objectId: projectObject.id,
    nodeType: 'portal',
    metadata: JSON.stringify({ managedBy: 'universe', universeRole: 'project' }),
  });

  const layoutId = ensureNetworkLayout(db, universe.id);
  if (layoutId) {
    const positionIndex = getUniverseProjectNodeCount(db, universe.id) - 1;
    ensureNodePosition(db, layoutId, node.id, getDefaultProjectNodePosition(positionIndex));
  }

  return node;
}

function ensureOntologyObjectRecordsForDb(db: Database.Database, projectId: string): void {
  const categories = listModelCategoriesForProjectDb(db, projectId);
  for (const category of categories) {
    ensureObjectForDb(db, 'instance', 'project', projectId, category.id, category.created_at);
  }

  const models = db.prepare(
    'SELECT id, project_id, created_at FROM models WHERE project_id = ?',
  ).all(projectId) as { id: string; project_id: string; created_at: string }[];
  for (const model of models) {
    ensureObjectForDb(db, 'model', 'project', model.project_id, model.id, model.created_at);
  }
}

function listOntologyObjectsForDb(
  db: Database.Database,
  projectId: string,
): Array<ObjectRecord & {
  ontology_role: OntologyObjectRole;
  sort_order: number;
  sort_created_at: string;
  category_instance_id?: string | null;
}> {
  return db.prepare(`
    SELECT o.*, 'model_category' AS ontology_role,
           CASE c.source_ref
             WHEN 'model-category.time' THEN 0
             WHEN 'model-category.workflow' THEN 1
             WHEN 'model-category.structure' THEN 2
             WHEN 'model-category.knowledge' THEN 3
             WHEN 'model-category.space' THEN 4
             WHEN 'model-category.quant' THEN 5
             WHEN 'model-category.governance' THEN 6
             ELSE 99
           END AS sort_order,
           c.created_at AS sort_created_at,
           NULL AS category_instance_id
      FROM objects o
      JOIN instances c ON o.object_type = 'instance' AND o.ref_id = c.id
      JOIN schemas s ON c.schema_id = s.id
     WHERE c.project_id = ?
       AND s.source_ref = 'schema.model_category'
    UNION ALL
    SELECT o.*, 'model' AS ontology_role, 1000 AS sort_order, sm.created_at AS sort_created_at, sm.category_instance_id AS category_instance_id
      FROM objects o
      JOIN models sm ON o.object_type = 'model' AND o.ref_id = sm.id
     WHERE sm.project_id = ?
     ORDER BY sort_order, sort_created_at
  `).all(projectId, projectId) as Array<ObjectRecord & {
    ontology_role: OntologyObjectRole;
    sort_order: number;
    sort_created_at: string;
    category_instance_id?: string | null;
  }>;
}

function getDefaultOntologyNodePosition(role: OntologyObjectRole, index: number): string {
  const laneX: Record<OntologyObjectRole, number> = {
    model_category: -260,
    model: 40,
  };
  return JSON.stringify({
    x: laneX[role],
    y: index * 150,
  });
}

function getOntologyNodeMetadata(role: OntologyObjectRole, order: number): string {
  return JSON.stringify({
    managedBy: 'ontology',
    ontologyRole: role,
    ontologyOrder: order,
    ...(role === 'model_category'
      ? {
          nodeConfig: {
            kind: 'grid',
            columns: 2,
            gapX: 16,
            gapY: 16,
            padding: 24,
            itemWidth: 160,
            itemHeight: 60,
            sort: null,
          },
        }
      : {}),
  });
}

function ensureOntologyContainsEdge(
  db: Database.Database,
  data: { networkId: string; sourceNodeId: string; targetNodeId: string; projectId: string },
): void {
  const modelId = `model-${data.projectId}-contains_relation`;
  const existing = db.prepare(
    `SELECT id FROM edges
      WHERE network_id = ?
        AND source_node_id = ?
        AND target_node_id = ?
        AND model_id = ?`,
  ).get(data.networkId, data.sourceNodeId, data.targetNodeId, modelId);
  if (existing) return;

  db.prepare(
    `INSERT INTO edges (id, network_id, source_node_id, target_node_id, model_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(randomUUID(), data.networkId, data.sourceNodeId, data.targetNodeId, modelId, new Date().toISOString());
}

function removeManagedOntologyContainsEdges(
  db: Database.Database,
  data: { networkId: string; projectId: string },
): void {
  const modelId = `model-${data.projectId}-contains_relation`;
  db.prepare(
    `DELETE FROM edges
      WHERE network_id = ?
        AND model_id = ?
        AND source_node_id IN (
          SELECT id FROM network_nodes
           WHERE network_id = ?
             AND metadata LIKE '%managedBy%ontology%'
        )
        AND target_node_id IN (
          SELECT id FROM network_nodes
           WHERE network_id = ?
             AND metadata LIKE '%managedBy%ontology%'
        )`,
  ).run(data.networkId, modelId, data.networkId, data.networkId);
}

function removeStaleManagedOntologyNodes(
  db: Database.Database,
  ontologyNetworkId: string,
  desiredObjectIds: string[],
): void {
  if (desiredObjectIds.length === 0) {
    db.prepare(
      `DELETE FROM network_nodes
        WHERE network_id = ?
          AND metadata LIKE '%managedBy%ontology%'`,
    ).run(ontologyNetworkId);
    return;
  }

  const placeholders = desiredObjectIds.map(() => '?').join(', ');
  db.prepare(
    `DELETE FROM network_nodes
      WHERE network_id = ?
        AND metadata LIKE '%managedBy%ontology%'
        AND object_id NOT IN (${placeholders})`,
  ).run(ontologyNetworkId, ...desiredObjectIds);
}

function getExcludedObjectIdsForNetwork(db: Database.Database, networkId: string): Set<string> {
  const rows = db.prepare(
    'SELECT object_id FROM network_node_exclusions WHERE network_id = ?',
  ).all(networkId) as { object_id: string }[];
  return new Set(rows.map((row) => row.object_id));
}

export function syncProjectOntologyForDb(db: Database.Database, projectId: string): Network {
  const ontology = ensureProjectOntologyNetworkRecordForDb(db, projectId);
  ensureOntologyObjectRecordsForDb(db, projectId);

  const excludedObjectIds = getExcludedObjectIdsForNetwork(db, ontology.id);
  const objects = listOntologyObjectsForDb(db, projectId)
    .filter((object) => !excludedObjectIds.has(object.id));
  removeStaleManagedOntologyNodes(db, ontology.id, objects.map((object) => object.id));
  removeManagedOntologyContainsEdges(db, { networkId: ontology.id, projectId });

  const roleIndexes: Record<OntologyObjectRole, number> = {
    model_category: 0,
    model: 0,
  };
  const nodeByObjectId = new Map<string, NetworkNode>();
  const categoryNodeByInstanceId = new Map<string, NetworkNode>();

  for (const object of objects) {
    const index = roleIndexes[object.ontology_role]++;
    const node = ensureObjectNodeInNetworkForDb(db, {
      networkId: ontology.id,
      objectId: object.id,
      nodeType: object.ontology_role === 'model_category' ? 'group' : 'basic',
      metadata: getOntologyNodeMetadata(object.ontology_role, index),
      positionJson: getDefaultOntologyNodePosition(object.ontology_role, index),
    });
    nodeByObjectId.set(object.id, node);
    if (object.ontology_role === 'model_category') {
      categoryNodeByInstanceId.set(object.ref_id, node);
    }
  }

  for (const object of objects) {
    if (object.ontology_role !== 'model' || !object.category_instance_id) continue;
    const modelNode = nodeByObjectId.get(object.id);
    const categoryNode = categoryNodeByInstanceId.get(object.category_instance_id);
    if (!modelNode || !categoryNode) continue;
    ensureOntologyContainsEdge(db, {
      networkId: ontology.id,
      sourceNodeId: categoryNode.id,
      targetNodeId: modelNode.id,
      projectId,
    });
  }

  return ontology;
}

export function ensureProjectOntologyNetworkForDb(db: Database.Database, projectId: string): Network {
  return syncProjectOntologyForDb(db, projectId);
}
