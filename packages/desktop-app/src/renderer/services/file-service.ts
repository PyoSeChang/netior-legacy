import {
  NETIOR_RPC_METHODS,
  type ResourceCreate,
  type ResourceRecord,
  type ResourceSourceKind,
} from '@netior/shared';
import { domainService } from './domain-service';

export interface FileEntity {
  id: string;
  root_id: string;
  path: string;
  type: ResourceSourceKind;
  metadata?: string | null;
}

export type FileEntityCreate = ResourceCreate & { path?: string };
export type FileEntityUpdate = { metadata?: string | null };

function toFileEntity(resource: ResourceRecord): FileEntity {
  return {
    id: resource.id,
    root_id: resource.root_id,
    path: resource.relative_path ?? resource.source_uri ?? resource.locator ?? resource.id,
    type: resource.source_kind,
    metadata: null,
  };
}

export async function createFileEntity(data: FileEntityCreate): Promise<FileEntity> {
  const resource = await domainService.rpc<ResourceRecord>(NETIOR_RPC_METHODS.resourceRegister, {
    ...data,
    relative_path: data.relative_path ?? data.path ?? null,
  });
  return toFileEntity(resource);
}

export async function getFileEntity(id: string): Promise<FileEntity | undefined> {
  const resource = await domainService.rpc<ResourceRecord | null>(NETIOR_RPC_METHODS.resourceGet, { id });
  return resource ? toFileEntity(resource) : undefined;
}

export async function getFileEntityByPath(rootId: string, path: string): Promise<FileEntity | undefined> {
  const normalized = path.replace(/\\/g, '/');
  const resources = await getFileEntitiesByRoot(rootId);
  return resources.find((resource) => resource.path.replace(/\\/g, '/') === normalized);
}

export async function getFileEntitiesByRoot(rootId: string): Promise<FileEntity[]> {
  const resources = await domainService.rpc<ResourceRecord[]>(NETIOR_RPC_METHODS.resourceList, { rootId });
  return resources.map(toFileEntity);
}

export async function updateFileEntity(id: string, _data: FileEntityUpdate): Promise<FileEntity> {
  const entity = await getFileEntity(id);
  if (!entity) {
    throw new Error(`Resource not found: ${id}`);
  }
  return entity;
}

export async function deleteFileEntity(id: string): Promise<boolean> {
  await domainService.rpc<ResourceRecord>(NETIOR_RPC_METHODS.resourceArchive, { id });
  return true;
}

export const fileService = {
  create: createFileEntity,
  get: getFileEntity,
  getByPath: getFileEntityByPath,
  getByRoot: getFileEntitiesByRoot,
  update: updateFileEntity,
  delete: deleteFileEntity,
};
