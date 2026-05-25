import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createLayout, getLayoutByNetwork, getNodePositions, getEdgeVisuals } from './layout';
import { createObject, deleteObjectByRef } from './objects';
import {
  ensureProjectOntologyNetworkForDb,
  ensureUniverseNetworkForDb,
  getProjectOntologyNetworkForDb,
  getUniverseNetworkForDb,
} from './system-networks';
import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate, NetworkNodeUpdate,
  Edge, EdgeCreate, EdgeUpdate,
  ObjectRecord,
  Instance,
  FileEntity,
  Meaning,
  EdgeLineStyle,
  NetworkBreadcrumbItem,
  NetworkFullData,
  NetworkType,
  NetworkNodeType,
  NetworkEdgeType,
  Relationship,
  MeaningRefKey,
  SemanticMeaningKey,
  MeaningSlotKey,
  MeaningTargetKind,
  OntologySourceKind,
} from '@netior/shared/types';

const DEFAULT_NETWORK_TYPE_ID = 'network-type-default';
const DEFAULT_BASIC_NODE_TYPE_ID = 'node-type-default-basic';
const DEFAULT_BASIC_EDGE_TYPE_ID = 'edge-type-default-basic';

// ── Network ──

export function createNetwork(data: NetworkCreate): Network {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const scope = data.scope ?? 'project';
  const kind = data.kind ?? 'network';
  if (kind !== 'network') {
    throw new Error('System networks must be created through the system network repository');
  }

  db.prepare(
    `INSERT INTO networks (id, project_id, network_type_id, name, scope, kind, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.project_id, data.network_type_id ?? DEFAULT_NETWORK_TYPE_ID, data.name,
    scope,
    kind,
    data.parent_network_id ?? null,
    now, now,
  );

  // Auto-create layout for this network
  createLayout({ networkId: id });

  // Register object record for the network
  createObject('network', scope, data.project_id ?? null, id);

  return db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network;
}

export function listNetworks(projectId: string, rootOnly = false): Network[] {
  const db = getDatabase();
  const orderBy = `ORDER BY CASE kind WHEN 'ontology' THEN 0 ELSE 1 END, created_at`;
  const sql = rootOnly
    ? `SELECT * FROM networks WHERE project_id = ? AND parent_network_id IS NULL ${orderBy}`
    : `SELECT * FROM networks WHERE project_id = ? ${orderBy}`;
  return db.prepare(sql).all(projectId) as Network[];
}

export interface NetworkTreeNode {
  network: Network;
  children: NetworkTreeNode[];
}

export function getNetworkTree(projectId: string): NetworkTreeNode[] {
  const db = getDatabase();

  const allNetworks = db.prepare(
    `SELECT * FROM networks
      WHERE project_id = ?
      ORDER BY CASE kind WHEN 'ontology' THEN 0 ELSE 1 END, created_at`,
  ).all(projectId) as Network[];
  const networkIds = new Set(allNetworks.map((network) => network.id));

  // Group by parent_network_id
  const childrenOf = new Map<string, NetworkTreeNode[]>();
  const roots: NetworkTreeNode[] = [];

  for (const network of allNetworks) {
    const node: NetworkTreeNode = { network, children: [] };

    if (!network.parent_network_id || !networkIds.has(network.parent_network_id)) {
      roots.push(node);
    } else {
      const siblings = childrenOf.get(network.parent_network_id) ?? [];
      siblings.push(node);
      childrenOf.set(network.parent_network_id, siblings);
    }
  }

  function attachChildren(nodes: NetworkTreeNode[]): void {
    for (const node of nodes) {
      node.children = childrenOf.get(node.network.id) ?? [];
      attachChildren(node.children);
    }
  }
  attachChildren(roots);

  return roots;
}

export function getNetworkAncestors(networkId: string): NetworkBreadcrumbItem[] {
  const db = getDatabase();

  // Recursive CTE following parent_network_id chain
  const rows = db.prepare(`
    WITH RECURSIVE ancestors(id, project_id, network_type_id, name, scope, kind, parent_network_id, created_at, updated_at, depth) AS (
      SELECT id, project_id, network_type_id, name, scope, kind, parent_network_id, created_at, updated_at, 0
        FROM networks WHERE id = ?
      UNION ALL
      SELECT n.id, n.project_id, n.network_type_id, n.name, n.scope, n.kind, n.parent_network_id, n.created_at, n.updated_at, a.depth + 1
        FROM networks n
        JOIN ancestors a ON n.id = a.parent_network_id
    )
    SELECT * FROM ancestors ORDER BY depth DESC
  `).all(networkId) as (Network & { depth: number })[];

  return rows.map((r) => ({
    networkId: r.id,
    networkName: r.name,
  }));
}

export function updateNetwork(id: string, data: NetworkUpdate): Network | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network | undefined;
  if (!existing) return undefined;

  if (existing.kind === 'universe' || existing.kind === 'ontology') {
    const nameChanged = data.name !== undefined && data.name !== existing.name;
    const scopeChanged = data.scope !== undefined && data.scope !== existing.scope;
    const parentChanged = data.parent_network_id !== undefined && data.parent_network_id !== existing.parent_network_id;
    if (nameChanged || scopeChanged || parentChanged) {
      throw new Error(`${existing.name} is a system network and cannot be edited`);
    }
    return existing;
  }

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE networks SET name = ?, scope = ?, parent_network_id = ?, network_type_id = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.scope !== undefined ? data.scope : existing.scope,
    data.parent_network_id !== undefined ? data.parent_network_id : existing.parent_network_id,
    data.network_type_id !== undefined ? data.network_type_id : existing.network_type_id,
    now,
    id,
  );

  return db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network;
}

export function deleteNetwork(id: string): boolean {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network | undefined;
  if (!existing) return false;
  if (existing.kind === 'universe' || existing.kind === 'ontology') {
    throw new Error(`${existing.name} is a system network and cannot be deleted`);
  }
  const result = db.prepare('DELETE FROM networks WHERE id = ?').run(id);
  if (result.changes > 0) {
    deleteObjectByRef('network', id);
    return true;
  }
  return false;
}

// ── System Networks ──

export function getUniverseNetwork(): Network | undefined {
  return getUniverseNetworkForDb(getDatabase());
}

export function ensureUniverseNetwork(): Network {
  return ensureUniverseNetworkForDb(getDatabase());
}

export function getProjectOntologyNetwork(projectId: string): Network | undefined {
  return getProjectOntologyNetworkForDb(getDatabase(), projectId);
}

export function ensureProjectOntologyNetwork(projectId: string): Network {
  return ensureProjectOntologyNetworkForDb(getDatabase(), projectId);
}

// ── Network Full Data ──

type ModelRow = Omit<Meaning, 'meaning_keys' | 'core_slots' | 'optional_slots' | 'recipe' | 'built_in' | 'directed'> & {
  meaning_keys: string | null;
  core_slots: string | null;
  optional_slots: string | null;
  recipe_json: string | null;
  built_in: number;
  directed: number | null;
};
type EdgeRow = Edge;
type RelationshipRow = Relationship;

function parseStringArray<T extends string>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is T => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseMeaningContract(raw: string | null | undefined): Meaning['recipe'] {
  if (!raw) return { meanings: [], rules: [] };
  try {
    const parsed = JSON.parse(raw) as Meaning['recipe'];
    return {
      meanings: Array.isArray(parsed.meanings) ? parsed.meanings : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch {
    return { meanings: [], rules: [] };
  }
}

function toMeaning(row: ModelRow): Meaning {
  return {
    ...row,
    key: row.key as MeaningRefKey,
    category_instance_id: row.category_instance_id ?? null,
    category_instance_title: row.category_instance_title ?? null,
    category_instance_source_ref: row.category_instance_source_ref ?? null,
    target_kind: (row.target_kind ?? 'object') as MeaningTargetKind,
    meaning_keys: parseStringArray<SemanticMeaningKey>(row.meaning_keys),
    core_slots: parseStringArray<MeaningSlotKey>(row.core_slots),
    optional_slots: parseStringArray<MeaningSlotKey>(row.optional_slots),
    recipe: parseMeaningContract(row.recipe_json),
    line_style: (row.line_style ?? null) as EdgeLineStyle | null,
    directed: row.directed == null ? null : !!row.directed,
    built_in: !!row.built_in,
  };
}

export function getNetworkFull(networkId: string): NetworkFullData | undefined {
  const db = getDatabase();
  const initialNetwork = db.prepare('SELECT * FROM networks WHERE id = ?').get(networkId) as Network | undefined;
  if (!initialNetwork) return undefined;
  const network = initialNetwork.kind === 'ontology' && initialNetwork.project_id
    ? ensureProjectOntologyNetworkForDb(db, initialNetwork.project_id)
    : initialNetwork;

  const layout = getLayoutByNetwork(network.id);
  const networkType = network.network_type_id
    ? db.prepare('SELECT * FROM network_types WHERE id = ?').get(network.network_type_id) as NetworkType | undefined
    : undefined;
  const nodeTypes = network.network_type_id
    ? db.prepare('SELECT * FROM node_types WHERE network_type_id = ? ORDER BY name').all(network.network_type_id) as NetworkNodeType[]
    : [];
  const edgeTypes = network.network_type_id
    ? db.prepare('SELECT * FROM edge_types WHERE network_type_id = ? ORDER BY name').all(network.network_type_id) as NetworkEdgeType[]
    : [];

  const nodes = db.prepare(
    `SELECT nn.*,
            o.id as o_id, o.object_type as o_object_type, o.scope as o_scope,
            o.project_id as o_project_id, o.ref_id as o_ref_id, o.created_at as o_created_at,
            c.title, c.color, c.icon, c.schema_id, c.project_id as instance_project_id,
            c.source_kind as instance_source_kind,
            c.source_id as instance_source_id,
            c.source_ref as instance_source_ref,
            c.source_version as instance_source_version,
            c.created_at as instance_created_at, c.updated_at as instance_updated_at,
            f.id as f_id, f.project_id as f_project_id, f.path as f_path, f.type as f_type,
            f.metadata as f_metadata, f.created_at as f_created_at, f.updated_at as f_updated_at
     FROM network_nodes nn
     JOIN objects o ON nn.object_id = o.id
     LEFT JOIN instances c ON o.object_type = 'instance' AND o.ref_id = c.id
     LEFT JOIN files f ON o.object_type = 'file' AND o.ref_id = f.id
     WHERE nn.network_id = ?`,
  ).all(network.id) as (Record<string, unknown>)[];

  const parsedNodes = nodes.map((row) => {
    const objectType = row.o_object_type as string;
    const hasInstance = objectType === 'instance' && row.title != null;
    const hasFile = objectType === 'file' && row.f_id != null;

    return {
      id: row.id as string,
      network_id: row.network_id as string,
      object_id: row.object_id as string,
      node_type: ((row.node_type as string) === 'box' ? 'group' : ((row.node_type as string) ?? 'basic')),
      node_type_id: (row.node_type_id as string | null) ?? null,
      parent_node_id: (row.parent_node_id as string | null) ?? null,
      metadata: (row.metadata as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      ...(row.node_type_id ? {
        representationType: nodeTypes.find((type) => type.id === row.node_type_id),
      } : {}),
      object: {
        id: row.o_id as string,
        object_type: row.o_object_type as string,
        scope: row.o_scope as string,
        project_id: (row.o_project_id as string | null) ?? null,
        ref_id: row.o_ref_id as string,
        created_at: row.o_created_at as string,
      },
      ...(hasInstance ? {
        instance: {
          id: row.o_ref_id as string,
          project_id: row.instance_project_id as string,
          schema_id: (row.schema_id as string | null) ?? null,
          title: row.title as string,
          color: row.color as string | null,
          icon: row.icon as string | null,
          content: null,
          agent_content: null,
          source_kind: ((row.instance_source_kind as string | null) ?? 'project') as OntologySourceKind,
          source_id: (row.instance_source_id as string | null) ?? null,
          source_ref: (row.instance_source_ref as string | null) ?? null,
          source_version: (row.instance_source_version as string | null) ?? null,
          created_at: row.instance_created_at as string,
          updated_at: row.instance_updated_at as string,
        },
      } : {}),
      ...(hasFile ? {
        file: {
          id: row.f_id as string,
          project_id: row.f_project_id as string,
          path: row.f_path as string,
          type: row.f_type as string,
          metadata: (row.f_metadata as string | null) ?? null,
          created_at: row.f_created_at as string,
          updated_at: row.f_updated_at as string,
        },
      } : {}),
    };
  });

  const edgeRows = db.prepare(
    `SELECT e.*,
            m.id as m_id, m.project_id as m_project_id,
            m.key as m_key, m.name as m_name,
            m.description as m_description,
            m.category_instance_id as m_category_instance_id,
            mc.title as m_category_instance_title,
            mc.source_ref as m_category_instance_source_ref,
            m.target_kind as m_target_kind,
            m.meaning_keys as m_meaning_keys, m.core_slots as m_core_slots,
            m.optional_slots as m_optional_slots, m.recipe_json as m_recipe_json,
            m.color as m_color, m.icon as m_icon,
            m.line_style as m_line_style,
            m.directed as m_directed, m.built_in as m_built_in,
            m.source_kind as m_source_kind,
            m.source_id as m_source_id,
            m.source_ref as m_source_ref,
            m.source_version as m_source_version,
            m.created_at as m_created_at, m.updated_at as m_updated_at,
            r.id as r_id, r.project_id as r_project_id,
            r.source_object_id as r_source_object_id, r.target_object_id as r_target_object_id,
            r.meaning_id as r_meaning_id, r.description as r_description,
            r.properties_json as r_properties_json,
            r.source_kind as r_source_kind, r.source_id as r_source_id,
            r.source_ref as r_source_ref, r.source_version as r_source_version,
            r.created_at as r_created_at, r.updated_at as r_updated_at,
            rm.id as rm_id, rm.project_id as rm_project_id,
            rm.key as rm_key, rm.name as rm_name,
            rm.description as rm_description,
            rm.category_instance_id as rm_category_instance_id,
            rmc.title as rm_category_instance_title,
            rmc.source_ref as rm_category_instance_source_ref,
            rm.target_kind as rm_target_kind,
            rm.meaning_keys as rm_meaning_keys, rm.core_slots as rm_core_slots,
            rm.optional_slots as rm_optional_slots, rm.recipe_json as rm_recipe_json,
            rm.color as rm_color, rm.icon as rm_icon,
            rm.line_style as rm_line_style,
            rm.directed as rm_directed, rm.built_in as rm_built_in,
            rm.source_kind as rm_source_kind,
            rm.source_id as rm_source_id,
            rm.source_ref as rm_source_ref,
            rm.source_version as rm_source_version,
            rm.created_at as rm_created_at, rm.updated_at as rm_updated_at
     FROM edges e
     LEFT JOIN meanings m ON e.meaning_id = m.id
     LEFT JOIN instances mc ON mc.id = m.category_instance_id
     LEFT JOIN relationships r ON e.relationship_id = r.id
     LEFT JOIN meanings rm ON r.meaning_id = rm.id
     LEFT JOIN instances rmc ON rmc.id = rm.category_instance_id
     WHERE e.network_id = ?`,
  ).all(network.id) as (Record<string, unknown>)[];

  const edges = edgeRows.map((row) => {
    const hasMeaning = row.m_id != null;
    const hasRelationship = row.r_id != null;
    const hasRelationshipMeaning = row.rm_id != null;
    return {
      id: row.id as string,
      network_id: row.network_id as string,
      source_node_id: row.source_node_id as string,
      target_node_id: row.target_node_id as string,
      relationship_id: (row.relationship_id as string | null) ?? null,
      meaning_id: (row.meaning_id as string | null) ?? null,
      edge_type_id: (row.edge_type_id as string | null) ?? null,
      source_port_key: (row.source_port_key as string | null) ?? null,
      target_port_key: (row.target_port_key as string | null) ?? null,
      route_json: (row.route_json as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      created_at: row.created_at as string,
      ...(row.edge_type_id ? {
        representationType: edgeTypes.find((type) => type.id === row.edge_type_id),
      } : {}),
      ...(hasRelationship ? {
        relationship: {
          id: row.r_id as string,
          project_id: row.r_project_id as string,
          source_object_id: row.r_source_object_id as string,
          target_object_id: row.r_target_object_id as string,
          meaning_id: (row.r_meaning_id as string | null) ?? null,
          description: (row.r_description as string | null) ?? null,
          properties_json: (row.r_properties_json as string | null) ?? null,
          source_kind: ((row.r_source_kind as string | null) ?? 'project') as RelationshipRow['source_kind'],
          source_id: (row.r_source_id as string | null) ?? null,
          source_ref: (row.r_source_ref as string | null) ?? null,
          source_version: (row.r_source_version as string | null) ?? null,
          created_at: row.r_created_at as string,
          updated_at: row.r_updated_at as string,
          ...(hasRelationshipMeaning ? {
            meaning: toMeaning({
              id: row.rm_id as string,
              project_id: row.rm_project_id as string,
              key: row.rm_key as string,
              name: row.rm_name as string,
              description: (row.rm_description as string | null) ?? null,
              category_instance_id: (row.rm_category_instance_id as string | null) ?? null,
              category_instance_title: (row.rm_category_instance_title as string | null) ?? null,
              category_instance_source_ref: (row.rm_category_instance_source_ref as string | null) ?? null,
              target_kind: ((row.rm_target_kind as string | null) ?? 'object') as MeaningTargetKind,
              meaning_keys: (row.rm_meaning_keys as string | null) ?? null,
              core_slots: (row.rm_core_slots as string | null) ?? null,
              optional_slots: (row.rm_optional_slots as string | null) ?? null,
              recipe_json: (row.rm_recipe_json as string | null) ?? null,
              color: (row.rm_color as string | null) ?? null,
              icon: (row.rm_icon as string | null) ?? null,
              line_style: ((row.rm_line_style as string | null) ?? null) as EdgeLineStyle | null,
              directed: (row.rm_directed as number | null) ?? null,
              built_in: (row.rm_built_in as number | null) ?? 0,
              source_kind: ((row.rm_source_kind as string | null) ?? 'project') as OntologySourceKind,
              source_id: (row.rm_source_id as string | null) ?? null,
              source_ref: (row.rm_source_ref as string | null) ?? null,
              source_version: (row.rm_source_version as string | null) ?? null,
              created_at: row.rm_created_at as string,
              updated_at: row.rm_updated_at as string,
            }),
          } : {}),
        },
      } : {}),
      ...(hasMeaning ? {
        meaning: toMeaning({
          id: row.m_id as string,
          project_id: row.m_project_id as string,
          key: row.m_key as string,
          name: row.m_name as string,
          description: (row.m_description as string | null) ?? null,
          category_instance_id: (row.m_category_instance_id as string | null) ?? null,
          category_instance_title: (row.m_category_instance_title as string | null) ?? null,
          category_instance_source_ref: (row.m_category_instance_source_ref as string | null) ?? null,
          target_kind: ((row.m_target_kind as string | null) ?? 'object') as MeaningTargetKind,
          meaning_keys: (row.m_meaning_keys as string | null) ?? null,
          core_slots: (row.m_core_slots as string | null) ?? null,
          optional_slots: (row.m_optional_slots as string | null) ?? null,
          recipe_json: (row.m_recipe_json as string | null) ?? null,
          color: (row.m_color as string | null) ?? null,
          icon: (row.m_icon as string | null) ?? null,
          line_style: ((row.m_line_style as string | null) ?? null) as EdgeLineStyle | null,
          directed: (row.m_directed as number | null) ?? null,
          built_in: (row.m_built_in as number | null) ?? 0,
          source_kind: ((row.m_source_kind as string | null) ?? 'project') as OntologySourceKind,
          source_id: (row.m_source_id as string | null) ?? null,
          source_ref: (row.m_source_ref as string | null) ?? null,
          source_version: (row.m_source_version as string | null) ?? null,
          created_at: row.m_created_at as string,
          updated_at: row.m_updated_at as string,
        }),
      } : {}),
    };
  });

  const nodePositions = layout ? getNodePositions(layout.id) : [];
  const edgeVisuals = layout ? getEdgeVisuals(layout.id) : [];

  return {
    network,
    networkType,
    layout,
    nodes: parsedNodes,
    edges,
    nodeTypes,
    edgeTypes,
    nodePositions,
    edgeVisuals,
  } as NetworkFullData;
}

// ── Network Node ──

export function addNetworkNode(data: NetworkNodeCreate): NetworkNode {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO network_nodes (id, network_id, object_id, node_type, node_type_id, parent_node_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.network_id,
    data.object_id,
    data.node_type ?? 'basic',
    data.node_type_id ?? DEFAULT_BASIC_NODE_TYPE_ID,
    data.parent_node_id ?? null,
    data.metadata ?? null,
    now, now,
  );

  db.prepare('DELETE FROM network_node_exclusions WHERE network_id = ? AND object_id = ?')
    .run(data.network_id, data.object_id);

  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

export function getNetworkNode(id: string): NetworkNode | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode | undefined;
}

export function updateNetworkNode(id: string, data: NetworkNodeUpdate): NetworkNode {
  const db = getDatabase();
  const sets: string[] = [];
  const values: unknown[] = [];

  if ('node_type' in data) { sets.push('node_type = ?'); values.push(data.node_type); }
  if ('node_type_id' in data) { sets.push('node_type_id = ?'); values.push(data.node_type_id ?? null); }
  if ('parent_node_id' in data) { sets.push('parent_node_id = ?'); values.push(data.parent_node_id ?? null); }
  if ('metadata' in data) { sets.push('metadata = ?'); values.push(data.metadata ?? null); }

  if (sets.length === 0) {
    return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
  }

  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE network_nodes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

export function removeNetworkNode(id: string): boolean {
  const db = getDatabase();
  const existing = db.prepare(
    `SELECT nn.id, nn.network_id, nn.object_id, nn.metadata, n.kind AS network_kind
       FROM network_nodes nn
       JOIN networks n ON n.id = nn.network_id
      WHERE nn.id = ?`,
  ).get(id) as { id: string; network_id: string; object_id: string; metadata: string | null; network_kind: string } | undefined;

  if (existing?.network_kind === 'ontology' && existing.metadata?.includes('"managedBy":"ontology"')) {
    db.prepare(
      `INSERT OR IGNORE INTO network_node_exclusions (id, network_id, object_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(randomUUID(), existing.network_id, existing.object_id, new Date().toISOString());
  }

  const result = db.prepare('DELETE FROM network_nodes WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Edge ──

export function createEdge(data: EdgeCreate): Edge {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO edges (
      id, network_id, source_node_id, target_node_id, relationship_id, meaning_id, edge_type_id,
      source_port_key, target_port_key, route_json, description, created_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.network_id, data.source_node_id, data.target_node_id,
    data.relationship_id ?? null,
    data.meaning_id ?? null,
    data.edge_type_id ?? DEFAULT_BASIC_EDGE_TYPE_ID,
    data.source_port_key ?? null,
    data.target_port_key ?? null,
    data.route_json ?? null,
    data.description ?? null,
    now,
  );

  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as EdgeRow;
}

export function getEdge(id: string): Edge | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as EdgeRow | undefined;
}

export function updateEdge(id: string, data: EdgeUpdate): Edge | undefined {
  const db = getDatabase();
  const existingRow = db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as EdgeRow | undefined;
  if (!existingRow) return undefined;

  db.prepare(`
    UPDATE edges
       SET meaning_id = ?,
           relationship_id = ?,
           edge_type_id = ?,
           source_port_key = ?,
           target_port_key = ?,
           route_json = ?,
           description = ?
     WHERE id = ?
  `).run(
    data.meaning_id !== undefined ? data.meaning_id : existingRow.meaning_id,
    data.relationship_id !== undefined ? data.relationship_id : existingRow.relationship_id,
    data.edge_type_id !== undefined ? data.edge_type_id : existingRow.edge_type_id,
    data.source_port_key !== undefined ? data.source_port_key : existingRow.source_port_key,
    data.target_port_key !== undefined ? data.target_port_key : existingRow.target_port_key,
    data.route_json !== undefined ? data.route_json : existingRow.route_json,
    data.description !== undefined ? data.description : existingRow.description,
    id,
  );

  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as EdgeRow;
}

export function deleteEdge(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM edges WHERE id = ?').run(id);
  return result.changes > 0;
}
