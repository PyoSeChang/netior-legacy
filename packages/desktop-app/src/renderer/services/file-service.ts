import type { FileEntity, FileEntityCreate, FileEntityUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createFileEntity(data: FileEntityCreate): Promise<FileEntity> {
  return unwrapIpc(await window.electron.fileEntity.create(data as unknown as Record<string, unknown>));
}

export async function getFileEntity(id: string): Promise<FileEntity | undefined> {
  return unwrapIpc(await window.electron.fileEntity.get(id));
}

export async function getFileEntityByPath(rootNetworkId: string, path: string): Promise<FileEntity | undefined> {
  return unwrapIpc(await window.electron.fileEntity.getByPath(rootNetworkId, path));
}

export async function getFileEntitiesByWorld(rootNetworkId: string): Promise<FileEntity[]> {
  return unwrapIpc(await window.electron.fileEntity.getByRootNetwork(rootNetworkId));
}

export async function updateFileEntity(id: string, data: FileEntityUpdate): Promise<FileEntity> {
  return unwrapIpc(await window.electron.fileEntity.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteFileEntity(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fileEntity.delete(id));
}

export const fileService = {
  create: createFileEntity,
  get: getFileEntity,
  getByPath: getFileEntityByPath,
  getByRootNetwork: getFileEntitiesByWorld,
  update: updateFileEntity,
  delete: deleteFileEntity,
};
