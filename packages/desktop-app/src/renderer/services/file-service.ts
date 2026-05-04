import type { FileEntity, FileEntityCreate, FileEntityUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createFileEntity(data: FileEntityCreate): Promise<FileEntity> {
  return unwrapIpc(await window.electron.fileEntity.create(data as unknown as Record<string, unknown>));
}

export async function getFileEntity(id: string): Promise<FileEntity | undefined> {
  return unwrapIpc(await window.electron.fileEntity.get(id));
}

export async function getFileEntityByPath(projectId: string, path: string): Promise<FileEntity | undefined> {
  return unwrapIpc(await window.electron.fileEntity.getByPath(projectId, path));
}

export async function getFileEntitiesByProject(projectId: string): Promise<FileEntity[]> {
  return unwrapIpc(await window.electron.fileEntity.getByProject(projectId));
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
  getByProject: getFileEntitiesByProject,
  update: updateFileEntity,
  delete: deleteFileEntity,
};
