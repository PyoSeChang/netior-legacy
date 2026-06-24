import type { World, WorldCreate, WorldUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createWorld(data: WorldCreate): Promise<World> {
  return unwrapIpc(await window.electron.world.create(data));
}

export async function listWorlds(): Promise<World[]> {
  return unwrapIpc(await window.electron.world.list());
}

export async function deleteWorld(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.world.delete(id));
}

export async function updateWorld(id: string, data: WorldUpdate): Promise<World> {
  return unwrapIpc(await window.electron.world.update(id, data as unknown as Record<string, unknown>));
}

export async function updateWorldRootDir(id: string, rootDir: string): Promise<World> {
  return unwrapIpc(await window.electron.world.updateRootDir(id, rootDir));
}

export const worldService = {
  create: createWorld,
  list: listWorlds,
  delete: deleteWorld,
  update: updateWorld,
  updateRootDir: updateWorldRootDir,
};
