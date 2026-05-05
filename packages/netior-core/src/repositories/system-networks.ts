import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { SEMANTIC_CATEGORY_LABELS } from '@netior/shared/constants';
import type { Network, NetworkNode, NetworkObjectType, ObjectRecord } from '@netior/shared/types';

type NetworkScope = 'app' | 'project';
type SystemNetworkKind = 'universe' | 'ontology';
type OntologyObjectRole = 'type_group' | 'model';

const CONTAINS_MODEL_KEY = 'contains_relation';

function builtInModelRootGroupId(projectId: string): string {
  return `type-group-${projectId}-models`;
}

const MODEL_CATEGORY_LAYOUT = [
  { category: 'time', x: -610, y: -170 },
  { category: 'workflow', x: -220, y: -170 },
  { category: 'structure', x: 170, y: -170 },
  { category: 'knowledge', x: -610, y: 210 },
  { category: 'space', x: -220, y: 210 },
  { category: 'quant', x: 170, y: 210 },
  { category: 'governance', x: -220, y: 455 },
] as const;

const MODEL_ROOT_GROUP_POSITION = { x: -220, y: 45, width: 1200, height: 1120 };
const MODEL_CATEGORY_GROUP_WIDTH = 330;
const MODEL_CATEGORY_GROUP_MIN_HEIGHT = 220;
const MODEL_GROUPED_MODEL_COLUMNS = 2;
const MODEL_GROUPED_MODEL_ROW_GAP = 74;
const MODEL_GROUPED_MODEL_COLUMN_GAP = 148;

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
    `INSERT INTO networks (id, project_id, name, scope, kind, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.projectId, data.name, data.scope, data.kind, data.parentNetworkId, now, now);

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
  ) {
    ensureObjectForDb(db, 'network', data.scope, network.project_id, network.id, network.created_at);
    ensureNetworkLayout(db, network.id);
    return network;
  }

  db.prepare(
    `UPDATE networks
        SET name = ?, scope = ?, kind = ?, parent_network_id = ?, updated_at = ?
      WHERE id = ?`,
  ).run(data.name, data.scope, data.kind, data.parentNetworkId, new Date().toISOString(), network.id);

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
    `INSERT INTO network_nodes (id, network_id, object_id, node_type, parent_node_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, networkId, objectId, nodeType, null, metadata, now, now);

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
    if (existing.node_type !== nodeType || existing.metadata !== metadata) {
      db.prepare(
        'UPDATE network_nodes SET node_type = ?, metadata = ?, updated_at = ? WHERE id = ?',
      ).run(nodeType, metadata, new Date().toISOString(), existing.id);
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
  const models = db.prepare(
    'SELECT id, project_id, created_at FROM models WHERE project_id = ?',
  ).all(projectId) as { id: string; project_id: string; created_at: string }[];
  for (const model of models) {
    ensureObjectForDb(db, 'model', 'project', model.project_id, model.id, model.created_at);
  }

  const typeGroups = db.prepare(
    'SELECT id, scope, project_id, created_at FROM type_groups WHERE project_id = ?',
  ).all(projectId) as { id: string; scope: NetworkScope; project_id: string; created_at: string }[];
  for (const typeGroup of typeGroups) {
    ensureObjectForDb(db, 'type_group', typeGroup.scope ?? 'project', typeGroup.project_id, typeGroup.id, typeGroup.created_at);
  }
}

function ensureBuiltInModelGroupsForDb(db: Database.Database, projectId: string): void {
  const now = new Date().toISOString();
  const rootGroupId = builtInModelRootGroupId(projectId);
  const insertGroup = db.prepare(`
    INSERT OR IGNORE INTO type_groups (
      id, scope, project_id, kind, name, parent_group_id, sort_order, created_at, updated_at
    )
    VALUES (?, 'project', ?, 'model', ?, ?, ?, ?, ?)
  `);
  const updateGroupParent = db.prepare(`
    UPDATE type_groups
       SET parent_group_id = ?, sort_order = ?, updated_at = ?
     WHERE id = ?
  `);
  const insertObject = db.prepare(`
    INSERT OR IGNORE INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    VALUES (?, 'type_group', 'project', ?, ?, ?)
  `);
  const updateModels = db.prepare(`
    UPDATE models
       SET group_id = ?, updated_at = ?
     WHERE project_id = ?
       AND built_in = 1
       AND category = ?
       AND (group_id IS NULL OR trim(group_id) = '')
  `);

  insertGroup.run(rootGroupId, projectId, 'Models', null, 0, now, now);
  insertObject.run(`object-type-group-${rootGroupId}`, projectId, rootGroupId, now);

  Object.entries(SEMANTIC_CATEGORY_LABELS).forEach(([category, name], index) => {
    const id = `type-group-${projectId}-model-${category}`;
    insertGroup.run(id, projectId, name, rootGroupId, index + 1, now, now);
    updateGroupParent.run(rootGroupId, index + 1, now, id);
    insertObject.run(`object-type-group-${id}`, projectId, id, now);
    updateModels.run(id, now, projectId, category);
  });
}

function listOntologyObjectsForDb(
  db: Database.Database,
  projectId: string,
): Array<ObjectRecord & { ontology_role: OntologyObjectRole; sort_order: number; sort_created_at: string }> {
  return db.prepare(`
    SELECT o.*, 'type_group' AS ontology_role, 0 AS sort_order, tg.created_at AS sort_created_at
      FROM objects o
      JOIN type_groups tg ON o.object_type = 'type_group' AND o.ref_id = tg.id
     WHERE tg.project_id = ?
    UNION ALL
    SELECT o.*, 'model' AS ontology_role, 1 AS sort_order, sm.created_at AS sort_created_at
      FROM objects o
      JOIN models sm ON o.object_type = 'model' AND o.ref_id = sm.id
     WHERE sm.project_id = ?
     ORDER BY sort_order, sort_created_at
  `).all(projectId, projectId) as Array<ObjectRecord & {
    ontology_role: OntologyObjectRole;
    sort_order: number;
    sort_created_at: string;
  }>;
}

function getDefaultOntologyNodePosition(role: OntologyObjectRole, index: number): string {
  const laneX: Record<OntologyObjectRole, number> = {
    type_group: -540,
    model: -120,
  };
  return JSON.stringify({
    x: laneX[role],
    y: index * 150,
  });
}

function getCategoryModelRowCount(modelCount: number): number {
  return Math.max(1, Math.ceil(modelCount / MODEL_GROUPED_MODEL_COLUMNS));
}

function getDefaultModelCategoryGroupHeight(modelCount: number): number {
  return Math.max(
    MODEL_CATEGORY_GROUP_MIN_HEIGHT,
    84 + getCategoryModelRowCount(modelCount) * MODEL_GROUPED_MODEL_ROW_GAP,
  );
}

function getDefaultModelCategoryGroupPosition(
  groupId: string,
  fallbackIndex: number,
  modelCount = 0,
): string {
  const category = groupId.match(/-model-([a-z_]+)$/)?.[1];
  const placement = category
    ? MODEL_CATEGORY_LAYOUT.find((entry) => entry.category === category)
    : undefined;
  const root = MODEL_ROOT_GROUP_POSITION;
  const height = getDefaultModelCategoryGroupHeight(modelCount);
  if (placement) {
    return JSON.stringify({
      x: placement.x - root.x,
      y: placement.y - root.y,
      width: MODEL_CATEGORY_GROUP_WIDTH,
      height,
    });
  }

  return JSON.stringify({
    x: -610 + (fallbackIndex % 3) * 390 - root.x,
    y: -170 + Math.floor(fallbackIndex / 3) * 380 - root.y,
    width: MODEL_CATEGORY_GROUP_WIDTH,
    height,
  });
}

function getDefaultModelRootGroupPosition(): string {
  return JSON.stringify(MODEL_ROOT_GROUP_POSITION);
}

function getDefaultGroupedModelPosition(index: number, groupModelCount: number): string {
  const column = index % MODEL_GROUPED_MODEL_COLUMNS;
  const row = Math.floor(index / MODEL_GROUPED_MODEL_COLUMNS);
  const groupHeight = getDefaultModelCategoryGroupHeight(groupModelCount);
  const contentTop = -groupHeight / 2 + 72;
  return JSON.stringify({
    x: -MODEL_GROUPED_MODEL_COLUMN_GAP / 2 + column * MODEL_GROUPED_MODEL_COLUMN_GAP,
    y: contentTop + row * MODEL_GROUPED_MODEL_ROW_GAP,
  });
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
          AND metadata LIKE '%"managedBy":"ontology"%'`,
    ).run(ontologyNetworkId);
    return;
  }

  const placeholders = desiredObjectIds.map(() => '?').join(', ');
  db.prepare(
    `DELETE FROM network_nodes
      WHERE network_id = ?
        AND metadata LIKE '%"managedBy":"ontology"%'
        AND object_id NOT IN (${placeholders})`,
  ).run(ontologyNetworkId, ...desiredObjectIds);
}

function getExcludedObjectIdsForNetwork(db: Database.Database, networkId: string): Set<string> {
  const rows = db.prepare(
    'SELECT object_id FROM network_node_exclusions WHERE network_id = ?',
  ).all(networkId) as { object_id: string }[];
  return new Set(rows.map((row) => row.object_id));
}

function ensureOntologyContainsEdge(
  db: Database.Database,
  networkId: string,
  projectId: string,
  groupNodeId: string,
  modelNodeId: string,
): void {
  if (groupNodeId === modelNodeId) return;

  db.prepare(
    `UPDATE network_nodes
        SET parent_node_id = ?, updated_at = ?
      WHERE id = ?
        AND network_id = ?`,
  ).run(groupNodeId, new Date().toISOString(), modelNodeId, networkId);

  const containsModelId = `model-${projectId}-${CONTAINS_MODEL_KEY}`;
  db.prepare(
    `DELETE FROM edges
      WHERE network_id = ?
        AND target_node_id = ?
        AND model_id = ?
        AND source_node_id <> ?`,
  ).run(networkId, modelNodeId, containsModelId, groupNodeId);

  const existing = db.prepare(
    `SELECT id FROM edges
      WHERE network_id = ?
        AND source_node_id = ?
        AND target_node_id = ?
        AND model_id = ?
      LIMIT 1`,
  ).get(networkId, groupNodeId, modelNodeId, containsModelId) as { id: string } | undefined;
  if (existing) return;

  db.prepare(
    `INSERT INTO edges (id, network_id, source_node_id, target_node_id, model_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  ).run(randomUUID(), networkId, groupNodeId, modelNodeId, containsModelId, new Date().toISOString());
}

export function syncProjectOntologyForDb(db: Database.Database, projectId: string): Network {
  const ontology = ensureProjectOntologyNetworkRecordForDb(db, projectId);
  ensureBuiltInModelGroupsForDb(db, projectId);
  ensureOntologyObjectRecordsForDb(db, projectId);

  const excludedObjectIds = getExcludedObjectIdsForNetwork(db, ontology.id);
  const objects = listOntologyObjectsForDb(db, projectId)
    .filter((object) => !excludedObjectIds.has(object.id));
  removeStaleManagedOntologyNodes(db, ontology.id, objects.map((object) => object.id));
  const builtInModels = db.prepare(`
    SELECT id, group_id
      FROM models
     WHERE project_id = ?
       AND built_in = 1
       AND group_id IS NOT NULL
       AND trim(group_id) <> ''
     ORDER BY category, name
  `).all(projectId) as { id: string; group_id: string }[];
  const modelCountsByGroup = new Map<string, number>();
  for (const model of builtInModels) {
    modelCountsByGroup.set(model.group_id, (modelCountsByGroup.get(model.group_id) ?? 0) + 1);
  }

  const roleIndexes: Record<OntologyObjectRole, number> = {
    type_group: 0,
    model: 0,
  };
  const modelCategoryGroupNodes = new Map<string, NetworkNode>();
  const modelNodes = new Map<string, NetworkNode>();
  let modelRootGroupNode: NetworkNode | null = null;
  const rootGroupId = builtInModelRootGroupId(projectId);

  for (const object of objects) {
    const index = roleIndexes[object.ontology_role]++;
    const isModelRootGroup = object.ontology_role === 'type_group' && object.ref_id === rootGroupId;
    const isModelCategoryGroup = object.ontology_role === 'type_group'
      && object.ref_id.startsWith(`type-group-${projectId}-model-`);
    const node = ensureObjectNodeInNetworkForDb(db, {
      networkId: ontology.id,
      objectId: object.id,
      nodeType: object.ontology_role === 'type_group' ? 'group' : 'basic',
      metadata: JSON.stringify({
        managedBy: 'ontology',
        ontologyRole: object.ontology_role,
      }),
      positionJson: isModelRootGroup
        ? getDefaultModelRootGroupPosition()
        : isModelCategoryGroup
        ? getDefaultModelCategoryGroupPosition(object.ref_id, index, modelCountsByGroup.get(object.ref_id) ?? 0)
        : getDefaultOntologyNodePosition(object.ontology_role, index),
    });

    if (isModelRootGroup) {
      setNodePosition(
        db,
        ensureNetworkLayout(db, ontology.id)!,
        node.id,
        getDefaultModelRootGroupPosition(),
      );
      modelRootGroupNode = node;
    } else if (isModelCategoryGroup) {
      setNodePosition(
        db,
        ensureNetworkLayout(db, ontology.id)!,
        node.id,
        getDefaultModelCategoryGroupPosition(object.ref_id, index, modelCountsByGroup.get(object.ref_id) ?? 0),
      );
      modelCategoryGroupNodes.set(object.ref_id, node);
    } else if (object.ontology_role === 'model') {
      modelNodes.set(object.ref_id, node);
    }
  }

  const groupedModelIndexes = new Map<string, number>();
  const layoutId = ensureNetworkLayout(db, ontology.id);

  if (modelRootGroupNode) {
    for (const groupNode of modelCategoryGroupNodes.values()) {
      ensureOntologyContainsEdge(db, ontology.id, projectId, modelRootGroupNode.id, groupNode.id);
    }
  }

  for (const model of builtInModels) {
    const groupNode = modelCategoryGroupNodes.get(model.group_id);
    const modelNode = modelNodes.get(model.id);
    if (!groupNode || !modelNode) continue;

    ensureOntologyContainsEdge(db, ontology.id, projectId, groupNode.id, modelNode.id);
    if (layoutId) {
      const index = groupedModelIndexes.get(model.group_id) ?? 0;
      groupedModelIndexes.set(model.group_id, index + 1);
      setNodePosition(
        db,
        layoutId,
        modelNode.id,
        getDefaultGroupedModelPosition(index, modelCountsByGroup.get(model.group_id) ?? 0),
      );
    }
  }

  return ontology;
}

export function ensureProjectOntologyNetworkForDb(db: Database.Database, projectId: string): Network {
  return syncProjectOntologyForDb(db, projectId);
}
