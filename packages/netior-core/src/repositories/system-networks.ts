import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { Network, NetworkNode, NetworkObjectType, ObjectRecord } from '@netior/shared/types';
import { listMeaningCategoriesForWorldDb } from './meaning-category';

type NetworkScope = 'app' | 'world';
type SystemNetworkKind = 'universe';
type OntologyObjectRole = 'meaning' | 'meaning_category';

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
  rootNetworkId: string | null,
  refId: string,
  now: string,
): ObjectRecord {
  const id = randomUUID();

  db.prepare(
    `INSERT INTO objects (id, object_type, scope, root_network_id, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, objectType, scope, rootNetworkId, refId, now);

  return db.prepare('SELECT * FROM objects WHERE id = ?').get(id) as ObjectRecord;
}

function ensureObjectForDb(
  db: Database.Database,
  objectType: NetworkObjectType,
  scope: NetworkScope,
  rootNetworkId: string | null,
  refId: string,
  createdAt?: string,
): ObjectRecord {
  const existing = getObjectForDb(db, objectType, refId);
  if (existing) return existing;

  return insertObject(db, objectType, scope, rootNetworkId, refId, createdAt ?? new Date().toISOString());
}

function insertSystemNetwork(
  db: Database.Database,
  data: {
    rootNetworkId: string | null;
    name: string;
    scope: NetworkScope;
    kind: SystemNetworkKind;
    parentNetworkId: string | null;
  },
): Network {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO networks (id, root_network_id, network_type_id, name, scope, kind, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.rootNetworkId, DEFAULT_NETWORK_TYPE_ID, data.name, data.scope, data.kind, data.parentNetworkId, now, now);

  insertNetworkLayout(db, id, now);
  ensureObjectForDb(db, 'network', data.scope, data.rootNetworkId, id, now);

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
    ensureObjectForDb(db, 'network', data.scope, network.root_network_id, network.id, network.created_at);
    ensureNetworkLayout(db, network.id);
    return network;
  }

  db.prepare(
    `UPDATE networks
        SET name = ?, scope = ?, kind = ?, parent_network_id = ?, network_type_id = ?, updated_at = ?
      WHERE id = ?`,
  ).run(data.name, data.scope, data.kind, data.parentNetworkId, DEFAULT_NETWORK_TYPE_ID, new Date().toISOString(), network.id);

  ensureObjectForDb(db, 'network', data.scope, network.root_network_id, network.id, network.created_at);
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
    rootNetworkId: null,
    name: 'Universe',
    scope: 'app',
    kind: 'universe',
    parentNetworkId: null,
  });
}

export function getRootNetworkForDb(db: Database.Database, rootNetworkId: string): Network | undefined {
  return db.prepare("SELECT * FROM networks WHERE id = ? AND kind = 'root'")
    .get(rootNetworkId) as Network | undefined;
}

export function ensureRootNetworkForDb(db: Database.Database, rootNetworkId: string): Network {
  const root = getRootNetworkForDb(db, rootNetworkId);
  if (!root) {
    throw new Error('Root network not found: ' + rootNetworkId);
  }

  ensureObjectForDb(db, 'network', 'world', root.id, root.id, root.created_at);
  ensureNetworkLayout(db, root.id);
  return root;
}

function getRootNetworkNodeInUniverseForDb(db: Database.Database, rootNetworkId: string): NetworkNode | undefined {
  const universe = getUniverseNetworkForDb(db);
  if (!universe) return undefined;

  return db.prepare([
    'SELECT nn.*',
    ' FROM network_nodes nn',
    ' JOIN objects o ON nn.object_id = o.id',
    "WHERE nn.network_id = ? AND o.object_type = 'network' AND o.ref_id = ?",
  ].join('\n')).get(universe.id, rootNetworkId) as NetworkNode | undefined;
}

function getUniverseRootNetworkNodeCount(db: Database.Database, universeId: string): number {
  const row = db.prepare([
    'SELECT COUNT(*) as count',
    ' FROM network_nodes nn',
    ' JOIN objects o ON nn.object_id = o.id',
    "WHERE nn.network_id = ? AND o.object_type = 'network'",
  ].join('\n')).get(universeId) as { count: number };

  return row.count;
}

function getDefaultRootNetworkNodePosition(index: number): string {
  const columns = 3;
  const horizontalGap = 320;
  const verticalGap = 220;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = (column - 1) * horizontalGap;
  const y = row * verticalGap;

  return JSON.stringify({ x, y });
}

export function ensureRootNetworkNodeInUniverseForDb(db: Database.Database, rootNetworkId: string): NetworkNode {
  const existing = getRootNetworkNodeInUniverseForDb(db, rootNetworkId);
  if (existing) return existing;

  const universe = ensureUniverseNetworkForDb(db);
  const root = ensureRootNetworkForDb(db, rootNetworkId);
  const rootObject = ensureObjectForDb(db, 'network', 'world', root.id, root.id, root.created_at);
  const node = ensureObjectNodeInNetworkForDb(db, {
    networkId: universe.id,
    objectId: rootObject.id,
    nodeType: 'portal',
    metadata: JSON.stringify({ managedBy: 'universe', universeRole: 'world' }),
  });

  const layoutId = ensureNetworkLayout(db, universe.id);
  if (layoutId) {
    const positionIndex = getUniverseRootNetworkNodeCount(db, universe.id) - 1;
    ensureNodePosition(db, layoutId, node.id, getDefaultRootNetworkNodePosition(positionIndex));
  }

  return node;
}

function ensureOntologyObjectRecordsForDb(db: Database.Database, rootNetworkId: string): void {
  const categories = listMeaningCategoriesForWorldDb(db, rootNetworkId);
  for (const category of categories) {
    ensureObjectForDb(db, 'instance', 'world', rootNetworkId, category.id, category.created_at);
  }

  const meanings = db.prepare('SELECT id, root_network_id, created_at FROM meanings WHERE root_network_id = ?')
    .all(rootNetworkId) as { id: string; root_network_id: string; created_at: string }[];
  for (const meaning of meanings) {
    ensureObjectForDb(db, 'meaning', 'world', meaning.root_network_id, meaning.id, meaning.created_at);
  }
}

function listOntologyObjectsForDb(
  db: Database.Database,
  rootNetworkId: string,
): Array<ObjectRecord & {
  ontology_role: OntologyObjectRole;
  sort_order: number;
  sort_created_at: string;
  category_instance_id?: string | null;
}> {
  return db.prepare([
    "SELECT o.*, 'meaning_category' AS ontology_role,",
    '       CASE c.source_ref',
    "         WHEN 'meaning-category.time' THEN 0",
    "         WHEN 'meaning-category.workflow' THEN 1",
    "         WHEN 'meaning-category.structure' THEN 2",
    "         WHEN 'meaning-category.knowledge' THEN 3",
    "         WHEN 'meaning-category.space' THEN 4",
    "         WHEN 'meaning-category.quant' THEN 5",
    "         WHEN 'meaning-category.governance' THEN 6",
    '         ELSE 99',
    '       END AS sort_order,',
    '       c.created_at AS sort_created_at,',
    '       NULL AS category_instance_id',
    '  FROM objects o',
    "  JOIN instances c ON o.object_type = 'instance' AND o.ref_id = c.id",
    '  JOIN schemas s ON c.schema_id = s.id',
    ' WHERE c.root_network_id = ?',
    "   AND s.source_ref = 'schema.meaning_category'",
    'UNION ALL',
    "SELECT o.*, 'meaning' AS ontology_role, 1000 AS sort_order, sm.created_at AS sort_created_at, sm.category_instance_id AS category_instance_id",
    '  FROM objects o',
    "  JOIN meanings sm ON o.object_type = 'meaning' AND o.ref_id = sm.id",
    ' WHERE sm.root_network_id = ?',
    ' ORDER BY sort_order, sort_created_at',
  ].join('\n')).all(rootNetworkId, rootNetworkId) as Array<ObjectRecord & {
    ontology_role: OntologyObjectRole;
    sort_order: number;
    sort_created_at: string;
    category_instance_id?: string | null;
  }>;
}

function getDefaultOntologyNodePosition(role: OntologyObjectRole, index: number): string {
  const laneX: Record<OntologyObjectRole, number> = {
    meaning_category: -260,
    meaning: 40,
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
    ...(role === 'meaning_category'
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
  data: { networkId: string; sourceNodeId: string; targetNodeId: string; rootNetworkId: string },
): void {
  const meaningId = 'meaning-' + data.rootNetworkId + '-contains';
  const existing = db.prepare([
    'SELECT id FROM edges',
    ' WHERE network_id = ?',
    '   AND source_node_id = ?',
    '   AND target_node_id = ?',
    '   AND meaning_id = ?',
  ].join('\n')).get(data.networkId, data.sourceNodeId, data.targetNodeId, meaningId);
  if (existing) return;

  db.prepare([
    'INSERT INTO edges (id, network_id, source_node_id, target_node_id, meaning_id, description, created_at)',
    'VALUES (?, ?, ?, ?, ?, NULL, ?)',
  ].join('\n')).run(randomUUID(), data.networkId, data.sourceNodeId, data.targetNodeId, meaningId, new Date().toISOString());
}

function removeManagedOntologyContainsEdges(
  db: Database.Database,
  data: { networkId: string; rootNetworkId: string },
): void {
  const meaningId = 'meaning-' + data.rootNetworkId + '-contains';
  db.prepare([
    'DELETE FROM edges',
    ' WHERE network_id = ?',
    '   AND meaning_id = ?',
    '   AND source_node_id IN (',
    '     SELECT id FROM network_nodes',
    '      WHERE network_id = ?',
    "        AND metadata LIKE '%managedBy%ontology%'",
    '   )',
    '   AND target_node_id IN (',
    '     SELECT id FROM network_nodes',
    '      WHERE network_id = ?',
    "        AND metadata LIKE '%managedBy%ontology%'",
    '   )',
  ].join('\n')).run(data.networkId, meaningId, data.networkId, data.networkId);
}

function removeStaleManagedOntologyNodes(
  db: Database.Database,
  rootNetworkId: string,
  desiredObjectIds: string[],
): void {
  if (desiredObjectIds.length === 0) {
    db.prepare([
      'DELETE FROM network_nodes',
      ' WHERE network_id = ?',
      "   AND metadata LIKE '%managedBy%ontology%'",
    ].join('\n')).run(rootNetworkId);
    return;
  }

  const placeholders = desiredObjectIds.map(() => '?').join(', ');
  db.prepare([
    'DELETE FROM network_nodes',
    ' WHERE network_id = ?',
    "   AND metadata LIKE '%managedBy%ontology%'",
    '   AND object_id NOT IN (' + placeholders + ')',
  ].join('\n')).run(rootNetworkId, ...desiredObjectIds);
}

function getExcludedObjectIdsForNetwork(db: Database.Database, networkId: string): Set<string> {
  const rows = db.prepare('SELECT object_id FROM network_node_exclusions WHERE network_id = ?')
    .all(networkId) as { object_id: string }[];
  return new Set(rows.map((row) => row.object_id));
}

export function syncRootNetworkOntologyForDb(db: Database.Database, rootNetworkId: string): Network {
  const root = ensureRootNetworkForDb(db, rootNetworkId);
  ensureOntologyObjectRecordsForDb(db, rootNetworkId);

  const excludedObjectIds = getExcludedObjectIdsForNetwork(db, root.id);
  const objects = listOntologyObjectsForDb(db, rootNetworkId)
    .filter((object) => !excludedObjectIds.has(object.id));
  removeStaleManagedOntologyNodes(db, root.id, objects.map((object) => object.id));
  removeManagedOntologyContainsEdges(db, { networkId: root.id, rootNetworkId });

  const roleIndexes: Record<OntologyObjectRole, number> = {
    meaning_category: 0,
    meaning: 0,
  };
  const nodeByObjectId = new Map<string, NetworkNode>();
  const categoryNodeByInstanceId = new Map<string, NetworkNode>();

  for (const object of objects) {
    const index = roleIndexes[object.ontology_role]++;
    const node = ensureObjectNodeInNetworkForDb(db, {
      networkId: root.id,
      objectId: object.id,
      nodeType: object.ontology_role === 'meaning_category' ? 'group' : 'basic',
      metadata: getOntologyNodeMetadata(object.ontology_role, index),
      positionJson: getDefaultOntologyNodePosition(object.ontology_role, index),
    });
    nodeByObjectId.set(object.id, node);
    if (object.ontology_role === 'meaning_category') {
      categoryNodeByInstanceId.set(object.ref_id, node);
    }
  }

  for (const object of objects) {
    if (object.ontology_role !== 'meaning' || !object.category_instance_id) continue;
    const meaningNode = nodeByObjectId.get(object.id);
    const categoryNode = categoryNodeByInstanceId.get(object.category_instance_id);
    if (!meaningNode || !categoryNode) continue;
    ensureOntologyContainsEdge(db, {
      networkId: root.id,
      sourceNodeId: categoryNode.id,
      targetNodeId: meaningNode.id,
      rootNetworkId,
    });
  }

  return root;
}
