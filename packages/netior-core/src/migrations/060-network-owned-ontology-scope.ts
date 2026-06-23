import type Database from 'better-sqlite3';
import { hasColumn, tableExists } from '../connection';

function addOwnerNetworkColumn(db: Database.Database, table: string): void {
  if (!tableExists(db, table) || hasColumn(db, table, 'owner_network_id')) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN owner_network_id TEXT REFERENCES networks(id) ON DELETE SET NULL`);
}

function backfillOwnerNetwork(db: Database.Database, table: string): void {
  if (!tableExists(db, table) || !hasColumn(db, table, 'owner_network_id') || !hasColumn(db, table, 'project_id')) return;

  db.exec(`
    UPDATE ${table}
       SET owner_network_id = (
         SELECT n.id
           FROM networks n
          WHERE n.project_id = ${table}.project_id
            AND n.kind = 'ontology'
          ORDER BY n.created_at
          LIMIT 1
       )
     WHERE owner_network_id IS NULL
       AND project_id IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM networks n
          WHERE n.project_id = ${table}.project_id
            AND n.kind = 'ontology'
       )
  `);
}

function createObjectScopeBindings(db: Database.Database): void {
  if (!tableExists(db, 'objects') || !tableExists(db, 'networks')) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS object_scope_bindings (
      id TEXT PRIMARY KEY,
      object_id TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      scope_network_id TEXT NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
      include_descendants INTEGER NOT NULL DEFAULT 1,
      binding_kind TEXT NOT NULL DEFAULT 'visible',
      source_kind TEXT NOT NULL DEFAULT 'project',
      source_id TEXT,
      source_ref TEXT,
      source_version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(object_id, scope_network_id, binding_kind)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_object_scope_bindings_object ON object_scope_bindings(object_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_object_scope_bindings_scope ON object_scope_bindings(scope_network_id)`);

  db.exec(`
    INSERT OR IGNORE INTO object_scope_bindings (
      id, object_id, scope_network_id, include_descendants, binding_kind, source_kind,
      source_id, source_ref, source_version, created_at, updated_at
    )
    SELECT
      'object-scope-' || o.id || '-' || n.id || '-visible',
      o.id,
      n.id,
      1,
      'visible',
      COALESCE(NULLIF(o.scope, ''), 'project'),
      NULL,
      NULL,
      NULL,
      datetime('now'),
      datetime('now')
      FROM objects o
      JOIN networks n
        ON n.project_id = o.project_id
       AND n.kind = 'ontology'
     WHERE o.project_id IS NOT NULL
  `);
}

export function migrate060(db: Database.Database): void {
  for (const table of ['schemas', 'instances', 'meanings', 'relationships']) {
    addOwnerNetworkColumn(db, table);
    backfillOwnerNetwork(db, table);
    if (tableExists(db, table) && hasColumn(db, table, 'owner_network_id')) {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_owner_network ON ${table}(owner_network_id)`);
    }
  }

  createObjectScopeBindings(db);
}
