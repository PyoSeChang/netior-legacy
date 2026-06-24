import type Database from 'better-sqlite3';

type TableColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.pragma('table_info(' + table + ')') as TableColumn[];
  return columns.some((entry) => entry.name === column);
}

function quoteIdent(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('Unsafe SQL identifier: ' + value);
  }
  return '"' + value + '"';
}

function columnDefinition(column: TableColumn, nextName: string): string {
  const parts = [quoteIdent(nextName), column.type || 'TEXT'];
  if (column.pk > 0) parts.push('PRIMARY KEY');
  if (column.notnull) parts.push('NOT NULL');
  if (column.dflt_value != null) parts.push('DEFAULT', column.dflt_value);
  return parts.join(' ');
}

function rebuildTableRenamingProjectId(db: Database.Database, table: string): void {
  if (!tableExists(db, table) || !hasColumn(db, table, 'project_id')) return;

  const columns = db.pragma('table_info(' + table + ')') as TableColumn[];
  const nextTable = table + '_root_network_boundary';
  const originalSql = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(table) as { sql: string | null } | undefined)?.sql;
  if (!originalSql) return;

  const openParen = originalSql.indexOf('(');
  if (openParen < 0) {
    throw new Error('Cannot rebuild table without CREATE TABLE body: ' + table);
  }

  const createSql = ('CREATE TABLE ' + quoteIdent(nextTable) + ' ' + originalSql.slice(openParen))
    .replace(/\bproject_id\b/g, 'root_network_id')
    .replace(/REFERENCES\s+projects\s*\([^)]*\)/gi, 'REFERENCES networks(id)');
  const sourceColumns = columns.map((column) => quoteIdent(column.name)).join(', ');
  const targetColumns = columns
    .map((column) => quoteIdent(column.name === 'project_id' ? 'root_network_id' : column.name))
    .join(', ');

  db.exec('DROP TABLE IF EXISTS ' + quoteIdent(nextTable));
  db.exec(createSql);
  db.exec([
    'INSERT INTO ' + quoteIdent(nextTable) + ' (' + targetColumns + ')',
    'SELECT ' + sourceColumns,
    '  FROM ' + quoteIdent(table),
  ].join('\n'));
  db.exec('DROP TABLE ' + quoteIdent(table));
  db.exec('ALTER TABLE ' + quoteIdent(nextTable) + ' RENAME TO ' + quoteIdent(table));
}

function addNetworksRootDir(db: Database.Database): void {
  if (!tableExists(db, 'networks') || hasColumn(db, 'networks', 'root_dir')) return;
  db.exec('ALTER TABLE networks ADD COLUMN root_dir TEXT');
}

function createRootNetworksFromProjects(db: Database.Database): void {
  if (!tableExists(db, 'projects') || !tableExists(db, 'networks')) return;

  addNetworksRootDir(db);

  db.exec([
    'INSERT OR IGNORE INTO networks (',
    '  id, project_id, network_type_id, name, scope, kind, parent_network_id,',
    '  root_dir, created_at, updated_at',
    ')',
    'SELECT',
    '  p.id,',
    '  p.id,',
    "  CASE WHEN EXISTS (SELECT 1 FROM network_types WHERE id = 'network-type-default') THEN 'network-type-default' ELSE NULL END,",
    '  p.name,',
    "  'world',",
    "  'root',",
    '  NULL,',
    '  p.root_dir,',
    '  p.created_at,',
    '  p.updated_at',
    '  FROM projects p',
  ].join('\n'));

  db.exec([
    'UPDATE networks',
    "   SET root_dir = COALESCE(root_dir, (SELECT root_dir FROM projects WHERE projects.id = networks.id)),",
    "       name = COALESCE(NULLIF(name, ''), (SELECT name FROM projects WHERE projects.id = networks.id)),",
    "       scope = CASE WHEN kind = 'root' THEN 'world' ELSE scope END",
    " WHERE kind = 'root'",
    '   AND EXISTS (SELECT 1 FROM projects WHERE projects.id = networks.id)',
  ].join('\n'));
}

function deleteLayoutForNetwork(db: Database.Database, networkId: string): void {
  if (!tableExists(db, 'layouts')) return;
  const layouts = db
    .prepare('SELECT id FROM layouts WHERE network_id = ?')
    .all(networkId) as { id: string }[];
  for (const layout of layouts) {
    if (tableExists(db, 'layout_nodes')) {
      db.prepare('DELETE FROM layout_nodes WHERE layout_id = ?').run(layout.id);
    }
    if (tableExists(db, 'layout_edges')) {
      db.prepare('DELETE FROM layout_edges WHERE layout_id = ?').run(layout.id);
    }
  }
  db.prepare('DELETE FROM layouts WHERE network_id = ?').run(networkId);
}

function moveOntologySurfaceToRoot(db: Database.Database, rootNetworkId: string): void {
  const ontology = db.prepare([
    'SELECT id FROM networks',
    ' WHERE project_id = ?',
    "   AND kind = 'ontology'",
    '   AND id <> ?',
    ' ORDER BY created_at',
    ' LIMIT 1',
  ].join('\n')).get(rootNetworkId, rootNetworkId) as { id: string } | undefined;
  if (!ontology) return;

  const duplicateRootNodes = db.prepare([
    'SELECT root.id',
    '  FROM network_nodes root',
    '  JOIN network_nodes ontology ON ontology.object_id = root.object_id',
    ' WHERE root.network_id = ?',
    '   AND ontology.network_id = ?',
  ].join('\n')).all(rootNetworkId, ontology.id) as { id: string }[];
  for (const node of duplicateRootNodes) {
    db.prepare('DELETE FROM edges WHERE source_node_id = ? OR target_node_id = ?').run(node.id, node.id);
    if (tableExists(db, 'layout_nodes')) {
      db.prepare('DELETE FROM layout_nodes WHERE node_id = ?').run(node.id);
    }
    db.prepare('DELETE FROM network_nodes WHERE id = ?').run(node.id);
  }

  deleteLayoutForNetwork(db, rootNetworkId);

  db.prepare('UPDATE network_nodes SET network_id = ? WHERE network_id = ?').run(rootNetworkId, ontology.id);
  db.prepare('UPDATE edges SET network_id = ? WHERE network_id = ?').run(rootNetworkId, ontology.id);
  if (tableExists(db, 'network_node_exclusions')) {
    db.prepare('UPDATE OR IGNORE network_node_exclusions SET network_id = ? WHERE network_id = ?')
      .run(rootNetworkId, ontology.id);
    db.prepare('DELETE FROM network_node_exclusions WHERE network_id = ?').run(ontology.id);
  }
  if (tableExists(db, 'layouts')) {
    db.prepare('UPDATE layouts SET network_id = ? WHERE network_id = ?').run(rootNetworkId, ontology.id);
  }
  if (tableExists(db, 'objects')) {
    db.prepare("DELETE FROM objects WHERE object_type = 'network' AND ref_id = ?").run(ontology.id);
  }
  db.prepare('DELETE FROM networks WHERE id = ?').run(ontology.id);
}

function normalizeWorldNetworks(db: Database.Database): void {
  if (!tableExists(db, 'projects') || !tableExists(db, 'networks')) return;

  const worlds = db.prepare('SELECT id FROM projects').all() as { id: string }[];
  for (const world of worlds) {
    moveOntologySurfaceToRoot(db, world.id);
    db.prepare([
      'UPDATE networks',
      '   SET parent_network_id = ?',
      ' WHERE project_id = ?',
      '   AND id <> ?',
      "   AND kind <> 'universe'",
      '   AND parent_network_id IS NULL',
    ].join('\n')).run(world.id, world.id, world.id);
  }

  db.exec([
    'UPDATE networks',
    '   SET scope = CASE',
    "     WHEN kind = 'universe' THEN 'app'",
    "     ELSE 'world'",
    '   END',
    " WHERE scope = 'project'",
    "    OR kind = 'root'",
  ].join('\n'));
}

function createWorldObjects(db: Database.Database): void {
  if (!tableExists(db, 'projects') || !tableExists(db, 'objects')) return;

  db.exec([
    'INSERT OR IGNORE INTO objects (id, object_type, scope, project_id, ref_id, created_at)',
    "SELECT 'object-network-' || p.id, 'network', 'world', p.id, p.id, p.created_at",
    '  FROM projects p',
  ].join('\n'));

  db.exec([
    'UPDATE network_nodes',
    '   SET object_id = (',
    '     SELECT world_object.id',
    '       FROM objects project_object',
    '       JOIN objects world_object',
    "         ON world_object.object_type = 'network'",
    '        AND world_object.ref_id = project_object.ref_id',
    '      WHERE project_object.id = network_nodes.object_id',
    "        AND project_object.object_type = 'project'",
    '      LIMIT 1',
    '   )',
    " WHERE object_id IN (SELECT id FROM objects WHERE object_type = 'project')",
    '   AND EXISTS (',
    '     SELECT 1',
    '       FROM objects project_object',
    '       JOIN objects world_object',
    "         ON world_object.object_type = 'network'",
    '        AND world_object.ref_id = project_object.ref_id',
    '      WHERE project_object.id = network_nodes.object_id',
    "        AND project_object.object_type = 'project'",
    '   )',
  ].join('\n'));

  db.exec("DELETE FROM objects WHERE object_type = 'project'");
  db.exec("UPDATE objects SET scope = 'world' WHERE scope = 'project'");
}

function normalizeSourceKind(db: Database.Database): void {
  const tables = [
    'objects',
    'instances',
    'schemas',
    'schema_fields',
    'schema_meanings',
    'schema_field_bindings',
    'field_meaning_bindings',
    'meanings',
    'relationships',
    'network_types',
    'node_types',
    'edge_types',
    'object_scope_bindings',
  ];

  for (const table of tables) {
    if (!tableExists(db, table) || !hasColumn(db, table, 'source_kind')) continue;
    db.exec('UPDATE ' + quoteIdent(table) + " SET source_kind = 'world' WHERE source_kind = 'project'");
  }
}

function rebuildProjectScopedTables(db: Database.Database): void {
  for (const table of [
    'networks',
    'objects',
    'instances',
    'schemas',
    'meanings',
    'relationships',
    'files',
    'modules',
    'network_types',
    'interactive_view_states',
    'interactive_view_templates',
    'interactive_view_preferences',
    'interactive_view_schema_preferences',
  ]) {
    rebuildTableRenamingProjectId(db, table);
  }
}

function ensureDefaultRepresentationRows(db: Database.Database): void {
  if (!tableExists(db, 'network_types')) return;

  const now = new Date().toISOString();
  db.prepare([
    'INSERT OR IGNORE INTO network_types (',
    '  id, root_network_id, key, name, description, source_kind, source_id, source_ref,',
    '  source_version, surface_runtime, grammar_json, created_at, updated_at',
    ') VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join('\n')).run(
    'network-type-default',
    'default',
    'Default',
    'Built-in freeform canvas network type.',
    'system',
    'netior.system',
    'network-type.default',
    '1',
    'canvas',
    '{"version":1}',
    now,
    now,
  );

  if (tableExists(db, 'node_types')) {
    const insertNodeType = db.prepare([
      'INSERT OR IGNORE INTO node_types (',
      '  id, network_type_id, key, name, description, source_kind, source_id, source_ref,',
      '  source_version, renderer_key, presentation_json, projection_json,',
      '  interface_json, placement_json, interaction_json, created_at, updated_at',
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ].join('\n'));
    for (const nodeType of [
      ['node-type-default-basic', 'default.basic_node', 'Basic Node', 'basic-card', 'basic'],
      ['node-type-default-portal', 'default.portal_node', 'Portal Node', 'portal-card', 'portal'],
      ['node-type-default-group', 'default.group_node', 'Group Node', 'group-container', 'group'],
      ['node-type-default-hierarchy', 'default.hierarchy_node', 'Hierarchy Node', 'hierarchy-container', 'hierarchy'],
    ] as const) {
      insertNodeType.run(
        nodeType[0],
        'network-type-default',
        nodeType[1],
        nodeType[2],
        'Built-in ' + nodeType[2] + '.',
        'system',
        'netior.system',
        'node-type.' + nodeType[1],
        '1',
        nodeType[3],
        JSON.stringify({ variant: nodeType[4] }),
        JSON.stringify({ title: { source: 'instance.title' } }),
        JSON.stringify({ ports: [] }),
        JSON.stringify({ kind: nodeType[4] }),
        '{}',
        now,
        now,
      );
    }
  }

  if (tableExists(db, 'edge_types')) {
    db.prepare([
      'INSERT OR IGNORE INTO edge_types (',
      '  id, network_type_id, key, name, description, source_kind, source_id, source_ref,',
      '  source_version, renderer_key, presentation_json, routing_json,',
      '  interface_json, interaction_json, created_at, updated_at',
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ].join('\n')).run(
      'edge-type-default-basic',
      'network-type-default',
      'default.basic_edge',
      'Basic Edge',
      'Built-in Basic Edge.',
      'system',
      'netior.system',
      'edge-type.default.basic_edge',
      '1',
      'svg-line',
      '{}',
      '{}',
      '{}',
      '{}',
      now,
      now,
    );
  }
}

function recreateIndexes(db: Database.Database): void {
  db.exec('CREATE INDEX IF NOT EXISTS idx_networks_root_kind ON networks(root_network_id, kind)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_networks_parent ON networks(parent_network_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_networks_network_type ON networks(network_type_id)');

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_objects_ref ON objects(object_type, ref_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_objects_root_network ON objects(root_network_id)');

  db.exec('CREATE INDEX IF NOT EXISTS idx_instances_root_network ON instances(root_network_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_instances_owner_network ON instances(owner_network_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_instances_schema ON instances(schema_id)');
  db.exec([
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_instances_recurrence_source_key',
    '  ON instances (recurrence_source_instance_id, recurrence_occurrence_key)',
    '  WHERE recurrence_source_instance_id IS NOT NULL',
    '    AND recurrence_occurrence_key IS NOT NULL',
  ].join('\n'));

  db.exec('CREATE INDEX IF NOT EXISTS idx_schemas_root_network ON schemas(root_network_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_schemas_owner_network ON schemas(owner_network_id)');

  db.exec('CREATE INDEX IF NOT EXISTS idx_meanings_root_network ON meanings(root_network_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_meanings_owner_network ON meanings(owner_network_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_meanings_category_instance ON meanings(category_instance_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_meanings_root_key ON meanings(root_network_id, key)');

  if (tableExists(db, 'relationships')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_relationships_root_network ON relationships(root_network_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_relationships_owner_network ON relationships(owner_network_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_relationships_source_object ON relationships(source_object_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_relationships_target_object ON relationships(target_object_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_relationships_meaning ON relationships(meaning_id)');
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_files_root_path ON files(root_network_id, path)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_modules_root_network ON modules(root_network_id)');

  db.exec([
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_network_types_global_key',
    '  ON network_types(key)',
    '  WHERE root_network_id IS NULL',
  ].join('\n'));
  db.exec([
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_network_types_world_key',
    '  ON network_types(root_network_id, key)',
    '  WHERE root_network_id IS NOT NULL',
  ].join('\n'));

  if (tableExists(db, 'interactive_view_states')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_interactive_view_states_root_network ON interactive_view_states(root_network_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_interactive_view_states_instance ON interactive_view_states(instance_id)');
  }
  if (tableExists(db, 'interactive_view_templates')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_interactive_view_templates_root_network ON interactive_view_templates(root_network_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_interactive_view_templates_target ON interactive_view_templates(target_kind, target_id)');
  }
  if (tableExists(db, 'interactive_view_preferences')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_interactive_view_preferences_root_network ON interactive_view_preferences(root_network_id)');
  }
  if (tableExists(db, 'interactive_view_schema_preferences')) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_interactive_view_schema_preferences_root_network ON interactive_view_schema_preferences(root_network_id)');
  }
}

export function migrate061(db: Database.Database): void {
  if (!tableExists(db, 'networks')) return;

  createRootNetworksFromProjects(db);
  normalizeWorldNetworks(db);
  createWorldObjects(db);
  normalizeSourceKind(db);
  rebuildProjectScopedTables(db);
  ensureDefaultRepresentationRows(db);
  recreateIndexes(db);

  db.exec('DROP TABLE IF EXISTS projects');
}
