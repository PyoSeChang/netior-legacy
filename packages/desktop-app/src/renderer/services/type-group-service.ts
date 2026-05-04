import type { TypeGroup, TypeGroupCreate, TypeGroupUpdate, TypeGroupKind } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createTypeGroup(data: TypeGroupCreate): Promise<TypeGroup> {
  return unwrapIpc(await window.electron.typeGroup.create(data as unknown as Record<string, unknown>));
}

export async function listTypeGroups(projectId: string, kind: TypeGroupKind): Promise<TypeGroup[]> {
  return unwrapIpc(await window.electron.typeGroup.list(projectId, kind));
}

export async function updateTypeGroup(id: string, data: TypeGroupUpdate): Promise<TypeGroup> {
  return unwrapIpc(await window.electron.typeGroup.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteTypeGroup(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.typeGroup.delete(id));
}

export const typeGroupService = {
  create: createTypeGroup,
  list: listTypeGroups,
  update: updateTypeGroup,
  delete: deleteTypeGroup,
};
