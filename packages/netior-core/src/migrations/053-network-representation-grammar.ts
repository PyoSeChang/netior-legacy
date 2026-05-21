import type Database from 'better-sqlite3';
import { hasColumn, tableExists } from '../connection';

const SYSTEM_SOURCE_ID = 'netior.system';
const SYSTEM_SOURCE_VERSION = '1';

const DEFAULT_NETWORK_TYPE_ID = 'network-type-default';
const CALENDAR_NETWORK_TYPE_ID = 'network-type-calendar';

const DEFAULT_NODE_TYPES = [
  { id: 'node-type-default-basic', key: 'default.basic_node', name: 'Basic Node', rendererKey: 'basic-card', legacyNodeType: 'basic' },
  { id: 'node-type-default-portal', key: 'default.portal_node', name: 'Portal Node', rendererKey: 'portal-card', legacyNodeType: 'portal' },
  { id: 'node-type-default-group', key: 'default.group_node', name: 'Group Node', rendererKey: 'group-container', legacyNodeType: 'group' },
  { id: 'node-type-default-hierarchy', key: 'default.hierarchy_node', name: 'Hierarchy Node', rendererKey: 'hierarchy-container', legacyNodeType: 'hierarchy' },
] as const;

const CALENDAR_NODE_TYPES = [
  { id: 'node-type-calendar-event', key: 'calendar.event_item', name: 'Event Item', rendererKey: 'grid-item-card' },
  { id: 'node-type-calendar-all-day', key: 'calendar.all_day_item', name: 'All Day Item', rendererKey: 'grid-item-card' },
  { id: 'node-type-calendar-milestone', key: 'calendar.milestone_item', name: 'Milestone Item', rendererKey: 'grid-item-card' },
] as const;

function json(value: unknown): string {
  return JSON.stringify(value);
}

function addColumn(db: Database.Database, table: string, column: string, definition: string): void {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_types (
      id              TEXT PRIMARY KEY,
      project_id      TEXT REFERENCES projects(id) ON DELETE CASCADE,
      key             TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT,
      source_kind     TEXT NOT NULL DEFAULT 'project',
      source_id       TEXT,
      source_ref      TEXT,
      source_version  TEXT,
      surface_runtime TEXT NOT NULL,
      grammar_json    TEXT NOT NULL DEFAULT '{}',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_network_types_global_key
      ON network_types(key)
      WHERE project_id IS NULL
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_network_types_project_key
      ON network_types(project_id, key)
      WHERE project_id IS NOT NULL
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS node_types (
      id                TEXT PRIMARY KEY,
      network_type_id   TEXT NOT NULL REFERENCES network_types(id) ON DELETE CASCADE,
      key               TEXT NOT NULL,
      name              TEXT NOT NULL,
      description       TEXT,
      source_kind       TEXT NOT NULL DEFAULT 'project',
      source_id         TEXT,
      source_ref        TEXT,
      source_version    TEXT,
      renderer_key      TEXT NOT NULL,
      presentation_json TEXT NOT NULL DEFAULT '{}',
      projection_json   TEXT NOT NULL DEFAULT '{}',
      interface_json    TEXT NOT NULL DEFAULT '{}',
      placement_json    TEXT NOT NULL DEFAULT '{}',
      interaction_json  TEXT NOT NULL DEFAULT '{}',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(network_type_id, key)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS edge_types (
      id                TEXT PRIMARY KEY,
      network_type_id   TEXT NOT NULL REFERENCES network_types(id) ON DELETE CASCADE,
      key               TEXT NOT NULL,
      name              TEXT NOT NULL,
      description       TEXT,
      source_kind       TEXT NOT NULL DEFAULT 'project',
      source_id         TEXT,
      source_ref        TEXT,
      source_version    TEXT,
      renderer_key      TEXT NOT NULL,
      presentation_json TEXT NOT NULL DEFAULT '{}',
      routing_json      TEXT NOT NULL DEFAULT '{}',
      interface_json    TEXT NOT NULL DEFAULT '{}',
      interaction_json  TEXT NOT NULL DEFAULT '{}',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(network_type_id, key)
    )
  `);
}

function addRepresentationColumns(db: Database.Database): void {
  addColumn(db, 'networks', 'network_type_id', 'TEXT REFERENCES network_types(id) ON DELETE RESTRICT');
  addColumn(db, 'network_nodes', 'node_type_id', 'TEXT REFERENCES node_types(id) ON DELETE RESTRICT');
  addColumn(db, 'edges', 'edge_type_id', 'TEXT REFERENCES edge_types(id) ON DELETE RESTRICT');
  addColumn(db, 'edges', 'source_port_key', 'TEXT');
  addColumn(db, 'edges', 'target_port_key', 'TEXT');
  addColumn(db, 'edges', 'route_json', 'TEXT');

  db.exec(`CREATE INDEX IF NOT EXISTS idx_networks_network_type ON networks(network_type_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_network_nodes_node_type ON network_nodes(node_type_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_edge_type ON edges(edge_type_id)`);
}

function seedNetworkTypes(db: Database.Database): void {
  const now = new Date().toISOString();
  const insertNetworkType = db.prepare(`
    INSERT OR IGNORE INTO network_types (
      id, project_id, key, name, description, source_kind, source_id, source_ref,
      source_version, surface_runtime, grammar_json, created_at, updated_at
    )
    VALUES (?, NULL, ?, ?, ?, 'system', ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNetworkType.run(
    DEFAULT_NETWORK_TYPE_ID,
    'default',
    'Default',
    'Built-in freeform canvas network type.',
    SYSTEM_SOURCE_ID,
    'network-type.default',
    SYSTEM_SOURCE_VERSION,
    'canvas',
    json({ version: 1 }),
    now,
    now,
  );
  insertNetworkType.run(
    CALENDAR_NETWORK_TYPE_ID,
    'calendar',
    'Calendar',
    'Built-in calendar network type on the grid runtime.',
    SYSTEM_SOURCE_ID,
    'network-type.calendar',
    SYSTEM_SOURCE_VERSION,
    'grid',
    json({ version: 1 }),
    now,
    now,
  );

  const insertNodeType = db.prepare(`
    INSERT OR IGNORE INTO node_types (
      id, network_type_id, key, name, description, source_kind, source_id, source_ref,
      source_version, renderer_key, presentation_json, projection_json,
      interface_json, placement_json, interaction_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'system', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const nodeType of DEFAULT_NODE_TYPES) {
    insertNodeType.run(
      nodeType.id,
      DEFAULT_NETWORK_TYPE_ID,
      nodeType.key,
      nodeType.name,
      `Built-in ${nodeType.name}.`,
      SYSTEM_SOURCE_ID,
      `node-type.${nodeType.key}`,
      SYSTEM_SOURCE_VERSION,
      nodeType.rendererKey,
      json({ variant: nodeType.legacyNodeType }),
      json({ title: { source: 'instance.title' } }),
      json({ ports: [] }),
      json({ kind: nodeType.legacyNodeType }),
      json({}),
      now,
      now,
    );
  }

  for (const nodeType of CALENDAR_NODE_TYPES) {
    insertNodeType.run(
      nodeType.id,
      CALENDAR_NETWORK_TYPE_ID,
      nodeType.key,
      nodeType.name,
      `Built-in ${nodeType.name}.`,
      SYSTEM_SOURCE_ID,
      `node-type.${nodeType.key}`,
      SYSTEM_SOURCE_VERSION,
      nodeType.rendererKey,
      json({ variant: nodeType.key }),
      json({ title: { source: 'instance.title' } }),
      json({ ports: [] }),
      json({ gridItem: true }),
      json({}),
      now,
      now,
    );
  }

  const insertEdgeType = db.prepare(`
    INSERT OR IGNORE INTO edge_types (
      id, network_type_id, key, name, description, source_kind, source_id, source_ref,
      source_version, renderer_key, presentation_json, routing_json,
      interface_json, interaction_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'system', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEdgeType.run(
    'edge-type-default-basic',
    DEFAULT_NETWORK_TYPE_ID,
    'default.basic_edge',
    'Basic Edge',
    'Built-in canvas edge type.',
    SYSTEM_SOURCE_ID,
    'edge-type.default.basic_edge',
    SYSTEM_SOURCE_VERSION,
    'edge-line',
    json({}),
    json({ strategy: 'shortest' }),
    json({}),
    json({}),
    now,
    now,
  );
  insertEdgeType.run(
    'edge-type-calendar-dependency',
    CALENDAR_NETWORK_TYPE_ID,
    'calendar.dependency',
    'Calendar Dependency',
    'Built-in calendar dependency edge type.',
    SYSTEM_SOURCE_ID,
    'edge-type.calendar.dependency',
    SYSTEM_SOURCE_VERSION,
    'edge-line',
    json({ lineStyle: 'dashed', directed: true }),
    json({ strategy: 'orthogonal' }),
    json({}),
    json({}),
    now,
    now,
  );
}

function backfillExistingRows(db: Database.Database): void {
  db.prepare(`
    UPDATE networks
       SET network_type_id = ?
     WHERE network_type_id IS NULL
  `).run(DEFAULT_NETWORK_TYPE_ID);

  for (const nodeType of DEFAULT_NODE_TYPES) {
    db.prepare(`
      UPDATE network_nodes
         SET node_type_id = ?
       WHERE node_type_id IS NULL
         AND COALESCE(NULLIF(node_type, ''), 'basic') IN (?, ?)
    `).run(
      nodeType.id,
      nodeType.legacyNodeType,
      nodeType.legacyNodeType === 'group' ? 'box' : nodeType.legacyNodeType,
    );
  }

  db.prepare(`
    UPDATE network_nodes
       SET node_type_id = ?
     WHERE node_type_id IS NULL
  `).run('node-type-default-basic');

  db.prepare(`
    UPDATE edges
       SET edge_type_id = ?
     WHERE edge_type_id IS NULL
  `).run('edge-type-default-basic');
}

export function migrate053(db: Database.Database): void {
  if (!tableExists(db, 'networks') || !tableExists(db, 'network_nodes') || !tableExists(db, 'edges')) {
    return;
  }

  createTables(db);
  addRepresentationColumns(db);
  seedNetworkTypes(db);
  backfillExistingRows(db);
}
