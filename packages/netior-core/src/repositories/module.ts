import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type {
  Module,
  ModuleCreate,
  ModuleDirectory,
  ModuleDirectoryCreate,
  ModuleUpdate,
} from '@netior/shared/types';

function getModuleById(id: string): Module | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM modules WHERE id = ?').get(id) as Module | undefined;
}

function listModuleDirectoryRows(moduleId: string): ModuleDirectory[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM module_directories WHERE module_id = ? ORDER BY created_at')
    .all(moduleId) as ModuleDirectory[];
}

function syncPrimaryModuleDirectory(moduleId: string, dirPath: string, createdAt?: string): ModuleDirectory {
  const db = getDatabase();
  const existing = listModuleDirectoryRows(moduleId);
  const keep = existing[0];

  if (keep) {
    db.prepare('UPDATE module_directories SET dir_path = ? WHERE id = ?').run(dirPath, keep.id);
    if (existing.length > 1) {
      db.prepare(
        `DELETE FROM module_directories
          WHERE module_id = ?
            AND id <> ?`,
      ).run(moduleId, keep.id);
    }
    return getModuleDirectoryById(keep.id) as ModuleDirectory;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO module_directories (id, module_id, dir_path, created_at) VALUES (?, ?, ?, ?)`,
  ).run(id, moduleId, dirPath, createdAt ?? new Date().toISOString());

  return getModuleDirectoryById(id) as ModuleDirectory;
}

export function createModule(data: ModuleCreate): Module {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO modules (id, root_network_id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, data.root_network_id, data.name, data.path, now, now);

  syncPrimaryModuleDirectory(id, data.path, now);

  return getModuleById(id) as Module;
}

export function listModules(rootNetworkId: string): Module[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM modules WHERE root_network_id = ? ORDER BY created_at')
    .all(rootNetworkId) as Module[];
}

export function updateModule(id: string, data: ModuleUpdate): Module | undefined {
  const db = getDatabase();
  const existing = getModuleById(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE modules
        SET name = ?, path = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.path !== undefined ? data.path : existing.path,
    now,
    id,
  );

  if (data.path !== undefined) {
    syncPrimaryModuleDirectory(id, data.path);
  }

  return getModuleById(id);
}

export function deleteModule(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM modules WHERE id = ?').run(id);
  return result.changes > 0;
}

function getModuleDirectoryById(id: string): ModuleDirectory | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM module_directories WHERE id = ?').get(id) as ModuleDirectory | undefined;
}

export function addModuleDirectory(data: ModuleDirectoryCreate): ModuleDirectory {
  updateModule(data.module_id, { path: data.dir_path });
  return syncPrimaryModuleDirectory(data.module_id, data.dir_path);
}

export function listModuleDirectories(moduleId: string): ModuleDirectory[] {
  const module = getModuleById(moduleId);
  if (module?.path) {
    return [syncPrimaryModuleDirectory(moduleId, module.path)];
  }
  const rows = listModuleDirectoryRows(moduleId);
  return rows.length > 0 ? [rows[0]] : [];
}

export function updateModuleDirectoryPath(id: string, dirPath: string): ModuleDirectory | undefined {
  const existing = getModuleDirectoryById(id);
  if (!existing) return undefined;
  updateModule(existing.module_id, { path: dirPath });
  return syncPrimaryModuleDirectory(existing.module_id, dirPath);
}

export function removeModuleDirectory(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM module_directories WHERE id = ?').run(id);
  return result.changes > 0;
}
