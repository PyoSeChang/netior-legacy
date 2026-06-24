import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { deleteObjectByRef } from './objects';
import { ensureRootNetworkNodeInUniverseForDb, syncRootNetworkOntologyForDb } from './system-networks';
import { seedBuiltInMeaningsForWorldDb } from './meaning';
import type { Network, World, WorldCreate, WorldUpdate } from '@netior/shared/types';

export const WORLD_ROOT_DIR_DUPLICATE_ERROR = 'WORLD_ROOT_DIR_DUPLICATE';

const DEFAULT_NETWORK_TYPE_ID = 'network-type-default';

function toWorld(row: Network): World {
  return {
    id: row.id,
    name: row.name,
    root_dir: row.root_dir ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function assertUniqueRootDir(rootDir: string, exceptRootNetworkId?: string): void {
  const db = getDatabase();
  const existing = db.prepare("SELECT id FROM networks WHERE kind = 'root' AND root_dir = ?").get(rootDir) as { id: string } | undefined;
  if (existing && existing.id !== exceptRootNetworkId) {
    throw new Error(WORLD_ROOT_DIR_DUPLICATE_ERROR + ':' + rootDir);
  }
}

export function createWorld(data: WorldCreate): World {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  assertUniqueRootDir(data.root_dir);

  db.transaction(() => {
    db.prepare([
      'INSERT INTO networks (',
      '  id, root_network_id, network_type_id, name, scope, kind, parent_network_id, root_dir, created_at, updated_at',
      ') VALUES (?, ?, ?, ?, \'world\', \'root\', NULL, ?, ?, ?)',
    ].join('\n')).run(id, id, DEFAULT_NETWORK_TYPE_ID, data.name, data.root_dir, now, now);

    seedBuiltInMeaningsForWorldDb(db, id);
    syncRootNetworkOntologyForDb(db, id);
    ensureRootNetworkNodeInUniverseForDb(db, id);
  })();

  return toWorld(db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network);
}

export function listWorlds(): World[] {
  const db = getDatabase();
  return (db.prepare("SELECT * FROM networks WHERE kind = 'root' ORDER BY updated_at DESC").all() as Network[])
    .map(toWorld);
}

export function getWorldById(id: string): World | undefined {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM networks WHERE id = ? AND kind = 'root'").get(id) as Network | undefined;
  return row ? toWorld(row) : undefined;
}

export function updateWorld(id: string, data: WorldUpdate): World | undefined {
  const db = getDatabase();
  const existing = getWorldById(id);
  if (!existing) return undefined;

  if (data.root_dir !== undefined) {
    assertUniqueRootDir(data.root_dir, id);
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE networks SET name = ?, root_dir = ?, updated_at = ? WHERE id = ? AND kind = 'root'").run(
    data.name !== undefined ? data.name : existing.name,
    data.root_dir !== undefined ? data.root_dir : existing.root_dir,
    now,
    id,
  );

  return getWorldById(id);
}

export function updateWorldRootDir(id: string, rootDir: string): World | undefined {
  return updateWorld(id, { root_dir: rootDir });
}

export function deleteWorld(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM networks WHERE id = ? AND kind = 'root'").run(id);
  if (result.changes > 0) {
    deleteObjectByRef('network', id);
    return true;
  }
  return false;
}
