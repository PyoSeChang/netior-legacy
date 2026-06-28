import type { World } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

interface WorldCreatePayload {
  name: string;
  root_uri: string;
}

type WorldUpdatePayload = Partial<WorldCreatePayload>;

export async function createWorld(data: WorldCreatePayload): Promise<World> {
  return unwrapIpc(await window.electron.world.create(data));
}

export async function listWorlds(): Promise<World[]> {
  return unwrapIpc(await window.electron.world.list());
}

export async function deleteWorld(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.world.delete(id));
}

export async function updateWorld(id: string, data: WorldUpdatePayload): Promise<World> {
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
