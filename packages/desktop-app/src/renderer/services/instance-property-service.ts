import type { InstanceProperty, InstancePropertyUpsert } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function upsertProperty(data: InstancePropertyUpsert): Promise<InstanceProperty> {
  return unwrapIpc(await window.electron.instanceProp.upsert(data as unknown as Record<string, unknown>));
}

export async function getByInstanceId(instanceId: string): Promise<InstanceProperty[]> {
  return unwrapIpc(await window.electron.instanceProp.getByInstance(instanceId));
}

export async function deleteProperty(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.instanceProp.delete(id));
}

export const instancePropertyService = {
  upsert: upsertProperty,
  getByInstance: getByInstanceId,
  delete: deleteProperty,
};
