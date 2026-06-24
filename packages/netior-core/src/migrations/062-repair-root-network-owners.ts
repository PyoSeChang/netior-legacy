import type Database from 'better-sqlite3';

type TableColumn = {
  name: string;
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

function repairOwnerNetwork(db: Database.Database, table: string): void {
  if (!tableExists(db, table) || !hasColumn(db, table, 'root_network_id') || !hasColumn(db, table, 'owner_network_id')) return;
  const name = quoteIdent(table);

  db.exec([
    'UPDATE ' + name,
    '   SET owner_network_id = root_network_id',
    ' WHERE owner_network_id IS NOT NULL',
    '   AND NOT EXISTS (SELECT 1 FROM networks WHERE networks.id = ' + name + '.owner_network_id)',
    '   AND EXISTS (',
    '     SELECT 1',
    '       FROM networks root_network',
    '      WHERE root_network.id = ' + name + '.root_network_id',
    "        AND root_network.kind = 'root'",
    '   )',
  ].join('\n'));
}

function repairObjectScopeBindings(db: Database.Database): void {
  if (!tableExists(db, 'object_scope_bindings') || !tableExists(db, 'objects')) return;
  if (!hasColumn(db, 'object_scope_bindings', 'scope_network_id') || !hasColumn(db, 'objects', 'root_network_id')) return;

  db.exec([
    'UPDATE object_scope_bindings',
    '   SET scope_network_id = (',
    '     SELECT objects.root_network_id',
    '       FROM objects',
    '       JOIN networks root_network',
    '         ON root_network.id = objects.root_network_id',
    "        AND root_network.kind = 'root'",
    '      WHERE objects.id = object_scope_bindings.object_id',
    '      LIMIT 1',
    '   )',
    ' WHERE scope_network_id IS NOT NULL',
    '   AND NOT EXISTS (SELECT 1 FROM networks WHERE networks.id = object_scope_bindings.scope_network_id)',
    '   AND EXISTS (',
    '     SELECT 1',
    '       FROM objects',
    '       JOIN networks root_network',
    '         ON root_network.id = objects.root_network_id',
    "        AND root_network.kind = 'root'",
    '      WHERE objects.id = object_scope_bindings.object_id',
    '   )',
  ].join('\n'));

  db.exec([
    'DELETE FROM object_scope_bindings',
    ' WHERE NOT EXISTS (',
    '   SELECT 1',
    '     FROM networks',
    '    WHERE networks.id = object_scope_bindings.scope_network_id',
    ' )',
  ].join('\n'));
}

export function migrate062(db: Database.Database): void {
  for (const table of ['schemas', 'instances', 'meanings', 'relationships']) {
    repairOwnerNetwork(db, table);
  }
  repairObjectScopeBindings(db);
}
