import Database from 'better-sqlite3';

import { migrate001 } from './migrations/001-baseline';
import { migrate002 } from './migrations/002-relation-kind-endpoint-policy';
import { migrate003 } from './migrations/003-relation-assertion-endpoint-kinds';

let db: Database.Database | null = null;

interface Migration {
  version: number;
  migrate: (db: Database.Database) => void;
}

const SCHEMA_EPOCH = 'domain-model-v1';

const migrations: Migration[] = [
  { version: 1, migrate: migrate001 },
  { version: 2, migrate: migrate002 },
  { version: 3, migrate: migrate003 },
];

const BASELINE_TABLES = [
  'netior_metadata',
  'world_nodes',
  'model_directory_bindings',
  'kinds',
  'properties',
  'relation_kinds',
  'instances',
  'resources',
  'views',
  'view_items',
] as const;

export function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.pragma(`table_info(${table})`) as { name: string }[];
  return cols.some((c) => c.name === column);
}

export function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { name: string } | undefined;
  return !!row;
}

export interface InitDatabaseOptions {
  nativeBinding?: string;
}

export function initDatabase(dbPath: string, options?: InitDatabaseOptions): void {
  const dbOptions: Database.Options = {};
  if (options?.nativeBinding) {
    dbOptions.nativeBinding = options.nativeBinding;
  }

  db = new Database(dbPath, dbOptions);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  if (needsFreshBaseline(db)) {
    console.warn('[DB] Legacy Netior database detected. Resetting to the new domain baseline.');
    resetDatabase(db);
  }

  ensureMigrationsTable(db);
  runPendingMigrations(db);
  ensureRuntimeSupportTables(db);
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function ensureMigrationsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

function runPendingMigrations(database: Database.Database): void {
  const applied = new Set(
    (database.prepare('SELECT version FROM _migrations').all() as { version: number }[])
      .map((row) => row.version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    database.pragma('foreign_keys = OFF');
    try {
      database.transaction(() => {
        migration.migrate(database);
        database
          .prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)')
          .run(migration.version, new Date().toISOString());
      })();
    } finally {
      database.pragma('foreign_keys = ON');
    }
  }
}

function ensureRuntimeSupportTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT,
      updated_at TEXT NOT NULL
    )
  `);
}

function needsFreshBaseline(database: Database.Database): boolean {
  const tables = listUserTables(database);
  if (tables.length === 0) return false;

  if (!tableExists(database, 'netior_metadata')) return true;

  for (const table of BASELINE_TABLES) {
    if (!tableExists(database, table)) return true;
  }

  const row = database
    .prepare("SELECT value FROM netior_metadata WHERE key = 'schema_epoch'")
    .get() as { value: string } | undefined;

  return row?.value !== SCHEMA_EPOCH;
}

function resetDatabase(database: Database.Database): void {
  database.pragma('foreign_keys = OFF');
  try {
    const tables = listUserTables(database);
    database.transaction(() => {
      for (const table of tables) {
        database.prepare(`DROP TABLE IF EXISTS "${table.replace(/"/g, '""')}"`).run();
      }
    })();
  } finally {
    database.pragma('foreign_keys = ON');
  }
}

function listUserTables(database: Database.Database): string[] {
  return (
    database
      .prepare(
        `SELECT name
           FROM sqlite_master
          WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
          ORDER BY name`,
      )
      .all() as { name: string }[]
  ).map((row) => row.name);
}

export const NETIOR_SCHEMA_EPOCH = SCHEMA_EPOCH;
