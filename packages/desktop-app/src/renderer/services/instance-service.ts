import type { Instance, InstanceCreate, InstanceUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createInstance(data: InstanceCreate): Promise<Instance> {
  return unwrapIpc(await window.electron.instance.create(data as unknown as Record<string, unknown>));
}

export async function getInstancesByWorld(rootNetworkId: string): Promise<Instance[]> {
  return unwrapIpc(await window.electron.instance.getByRootNetwork(rootNetworkId));
}

export async function updateInstance(id: string, data: InstanceUpdate): Promise<Instance> {
  return unwrapIpc(await window.electron.instance.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteInstance(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.instance.delete(id));
}

export const instanceService = {
  create: createInstance,
  getByRootNetwork: getInstancesByWorld,
  update: updateInstance,
  delete: deleteInstance,
};
