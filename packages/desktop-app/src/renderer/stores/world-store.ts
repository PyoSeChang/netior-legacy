import { create } from 'zustand';
import type { World } from '@netior/shared/types';
import { worldService, type FileEntity } from '../services';
import { unwrapIpc } from '../services/ipc';
import { getWorldRootDir } from '../utils/world-utils';
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

type WorldUpdateInput = Partial<{ name: string; root_uri: string }>;

interface WorldStore {
  worlds: World[];
  currentWorld: World | null;
  loading: boolean;
  missingPathWorld: World | null;
  missingFiles: MissingFileEntry[];

  loadWorlds: () => Promise<void>;
  restoreLastWorld: () => Promise<void>;
  createWorld: (name: string, rootDir: string) => Promise<World>;
  updateWorld: (id: string, data: WorldUpdateInput) => Promise<World>;
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
      const lastId = unwrapIpc(await window.electron.config.get('lastWorldId')) as string | null;
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
    const existingWorld = get().worlds.find((world) => normalizeRootDir(getWorldRootDir(world)) === normalizedRootDir);
    if (existingWorld) {
      throw createDuplicateRootDirError(rootDir);
    }

    let world: World;
    try {
      world = await worldService.create({ name, root_uri: rootDir });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.startsWith(`${WORLD_ROOT_DIR_DUPLICATE_ERROR}:`) ||
        message.includes('UNIQUE constraint failed: world_nodes.root_uri')
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
    // Check if root_uri exists; if not, show missing path dialog
    let resolvedWorld = world;
    try {
      const exists = unwrapIpc(await window.electron.fs.exists(getWorldRootDir(world)));
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
    window.electron.config.set('lastWorldId', resolvedWorld.id).catch(() => {});

    set({ missingFiles: [] });
  },

  validateFilePaths: async (world) => {
    void world;
    set({ missingFiles: [] });
  },

  resolveMissingFile: async (fileId, action, newPath) => {
    void action;
    void newPath;
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
    window.electron.config.set('lastWorldId', '').catch(() => {});
  },

  deleteWorld: async (id) => {
    await worldService.delete(id);
    deleteWorldState(id);
    const lastId = unwrapIpc(await window.electron.config.get('lastWorldId').catch(() => ({ success: true, data: null }))) as string | null;
    if (lastId === id) {
      window.electron.config.set('lastWorldId', '').catch(() => {});
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
