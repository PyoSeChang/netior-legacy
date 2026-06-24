import { create } from 'zustand';
import type { World, FileEntity } from '@netior/shared/types';
import { worldService, moduleService, fileService } from '../services';
import { unwrapIpc } from '../services/ipc';
import {
  saveAppState,
  saveWorldState,
  restoreAppState,
  restoreWorldState,
  clearAllWorldStores,
  deleteWorldState,
} from './world-state-cache';

export interface MissingFileEntry {
  fileEntity: FileEntity;
  /** resolved action: 'reconnect' | 'delete' | 'ignore' */
  action?: 'reconnect' | 'delete' | 'ignore';
  newPath?: string;
}

export const WORLD_ROOT_DIR_DUPLICATE_ERROR = 'WORLD_ROOT_DIR_DUPLICATE';

interface WorldStore {
  worlds: World[];
  currentWorld: World | null;
  loading: boolean;
  missingPathWorld: World | null;
  missingFiles: MissingFileEntry[];

  loadWorlds: () => Promise<void>;
  restoreLastWorld: () => Promise<void>;
  createWorld: (name: string, rootDir: string) => Promise<World>;
  updateWorld: (id: string, data: Partial<Pick<World, 'name' | 'root_dir'>>) => Promise<World>;
  openWorld: (world: World) => Promise<void>;
  resolveMissingPath: () => Promise<void>;
  dismissMissingPath: () => void;
  validateFilePaths: (world: World) => Promise<void>;
  resolveMissingFile: (fileId: string, action: 'reconnect' | 'delete' | 'ignore', newPath?: string) => Promise<void>;
  dismissMissingFiles: () => void;
  closeWorld: () => void;
  deleteWorld: (id: string) => Promise<void>;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function normalizeRootDir(path: string): string {
  return normalizePath(path).replace(/\/+$/, '').toLowerCase();
}

function createDuplicateRootDirError(rootDir: string): Error {
  return new Error(`${WORLD_ROOT_DIR_DUPLICATE_ERROR}:${rootDir}`);
}

function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('/') || path.startsWith('\\\\');
}

function resolveFileEntityAbsolutePath(worldRoot: string, filePath: string): string {
  if (isAbsolutePath(filePath)) {
    return filePath;
  }
  const normalizedRoot = normalizePath(worldRoot).replace(/\/+$/, '');
  const normalizedFilePath = normalizePath(filePath).replace(/^\/+/, '');
  return `${normalizedRoot}/${normalizedFilePath}`;
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  worlds: [],
  currentWorld: null,
  loading: false,
  missingPathWorld: null,
  missingFiles: [],

  loadWorlds: async () => {
    set({ loading: true });
    try {
      const worlds = await worldService.list();
      set({ worlds });
    } finally {
      set({ loading: false });
    }
  },

  restoreLastWorld: async () => {
    try {
      const lastId = unwrapIpc(await window.electron.config.get('lastRootNetworkId')) as string | null;
      if (!lastId) return;
      const { worlds, openWorld } = get();
      const world = worlds.find((p) => p.id === lastId);
      if (world) {
        await openWorld(world);
      }
    } catch {
      // ignore ??config may not exist yet
    }
  },

  createWorld: async (name, rootDir) => {
    const normalizedRootDir = normalizeRootDir(rootDir);
    const existingWorld = get().worlds.find((world) => normalizeRootDir(world.root_dir) === normalizedRootDir);
    if (existingWorld) {
      throw createDuplicateRootDirError(rootDir);
    }

    let world: World;
    try {
      world = await worldService.create({ name, root_dir: rootDir });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.startsWith(`${WORLD_ROOT_DIR_DUPLICATE_ERROR}:`) ||
        message.includes('UNIQUE constraint failed: worlds.root_dir')
      ) {
        throw createDuplicateRootDirError(rootDir);
      }
      throw error;
    }
    set((s) => ({ worlds: [world, ...s.worlds] }));
    return world;
  },

  updateWorld: async (id, data) => {
    const updated = await worldService.update(id, data);
    set((s) => ({
      worlds: s.worlds.map((world) => (world.id === id ? updated : world)),
      currentWorld: s.currentWorld?.id === id ? updated : s.currentWorld,
      missingPathWorld: s.missingPathWorld?.id === id ? updated : s.missingPathWorld,
    }));
    return updated;
  },

  openWorld: async (world) => {
    // Check if root_dir exists; if not, show missing path dialog
    let resolvedWorld = world;
    try {
      const exists = unwrapIpc(await window.electron.fs.exists(world.root_dir));
      if (!exists) {
        set({ missingPathWorld: world });
        return;
      }
    } catch {
      // fall through
    }

    const { currentWorld } = get();
    if (currentWorld && currentWorld.id !== resolvedWorld.id) {
      saveWorldState(currentWorld.id);
    } else if (!currentWorld) {
      saveAppState();
    }

    const restored = restoreWorldState(resolvedWorld.id);
    if (!restored) {
      clearAllWorldStores();
    }

    set({ currentWorld: resolvedWorld });
    window.electron.config.set('lastRootNetworkId', resolvedWorld.id).catch(() => {});

    // Validate file entity paths in background
    get().validateFilePaths(resolvedWorld).catch(() => {});
  },

  validateFilePaths: async (world) => {
    try {
      const files = await fileService.getByRootNetwork(world.id);
      const missing: MissingFileEntry[] = [];
      for (const f of files) {
        const absPath = resolveFileEntityAbsolutePath(world.root_dir, f.path);
        const exists = unwrapIpc(await window.electron.fs.exists(absPath));
        if (!exists) {
          missing.push({ fileEntity: f });
        }
      }
      if (missing.length > 0) {
        set({ missingFiles: missing });
      }
    } catch {
      // ignore validation errors
    }
  },

  resolveMissingFile: async (fileId, action, newPath) => {
    if (action === 'delete') {
      await fileService.delete(fileId);
    } else if (action === 'reconnect' && newPath) {
      // Update the file entity path (need to figure out relative path)
      // For now just update metadata ??actual path update would need a new API
      // TODO: implement path update in FileRepository
    }
    // Remove from missing list
    set((s) => ({
      missingFiles: s.missingFiles.filter((m) => m.fileEntity.id !== fileId),
    }));
  },

  dismissMissingFiles: () => {
    set({ missingFiles: [] });
  },

  resolveMissingPath: async () => {
    const { missingPathWorld, openWorld } = get();
    if (!missingPathWorld) return;

    const paths = unwrapIpc(await window.electron.fs.openDialog({ properties: ['openDirectory'] })) as string[] | null;
    if (!paths || paths.length === 0) {
      set({ missingPathWorld: null });
      return;
    }

    const newPath = paths[0];
    const updated = await worldService.updateRootDir(missingPathWorld.id, newPath);

    // Also update module paths that pointed to the old root_dir
    const modules = await moduleService.list(missingPathWorld.id);
    for (const mod of modules) {
      if (mod.path === missingPathWorld.root_dir) {
        await moduleService.update(mod.id, { path: newPath });
      }
    }

    set((s) => ({
      missingPathWorld: null,
      worlds: s.worlds.map((p) => (p.id === updated.id ? updated : p)),
    }));
    await openWorld(updated);
  },

  dismissMissingPath: () => {
    set({ missingPathWorld: null });
  },

  closeWorld: () => {
    const { currentWorld } = get();
    if (currentWorld) {
      saveWorldState(currentWorld.id);
    }
    const restoredApp = restoreAppState();
    if (!restoredApp) {
      clearAllWorldStores();
    }
    set({ currentWorld: null });
    window.electron.config.set('lastRootNetworkId', '').catch(() => {});
  },

  deleteWorld: async (id) => {
    await worldService.delete(id);
    deleteWorldState(id);
    const lastId = unwrapIpc(await window.electron.config.get('lastRootNetworkId').catch(() => ({ success: true, data: null }))) as string | null;
    if (lastId === id) {
      window.electron.config.set('lastRootNetworkId', '').catch(() => {});
    }
    const wasCurrent = get().currentWorld?.id === id;
    if (wasCurrent) {
      const restoredApp = restoreAppState();
      if (!restoredApp) {
        clearAllWorldStores();
      }
    }
    set((s) => ({
      worlds: s.worlds.filter((p) => p.id !== id),
      currentWorld: wasCurrent ? null : s.currentWorld,
    }));
  },
}));
