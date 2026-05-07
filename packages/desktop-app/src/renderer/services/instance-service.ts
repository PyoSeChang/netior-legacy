import type { Instance, InstanceCreate, InstanceUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createInstance(data: InstanceCreate): Promise<Instance> {
  return unwrapIpc(await window.electron.instance.create(data as unknown as Record<string, unknown>));
}

export async function getInstancesByProject(projectId: string): Promise<Instance[]> {
  return unwrapIpc(await window.electron.instance.getByProject(projectId));
}

export async function updateInstance(id: string, data: InstanceUpdate): Promise<Instance> {
  return unwrapIpc(await window.electron.instance.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteInstance(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.instance.delete(id));
}

export const instanceService = {
  create: createInstance,
  getByProject: getInstancesByProject,
  update: updateInstance,
  delete: deleteInstance,
};
