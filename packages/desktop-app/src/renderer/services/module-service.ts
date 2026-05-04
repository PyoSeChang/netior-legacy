import type {
  Module, ModuleCreate, ModuleUpdate,
  ModuleDirectory, ModuleDirectoryCreate,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createModule(data: ModuleCreate): Promise<Module> {
  return unwrapIpc(await window.electron.module.create(data as unknown as Record<string, unknown>));
}

export async function listModules(projectId: string): Promise<Module[]> {
  return unwrapIpc(await window.electron.module.list(projectId));
}

export async function updateModule(id: string, data: ModuleUpdate): Promise<Module> {
  return unwrapIpc(await window.electron.module.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteModule(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.module.delete(id));
}

export async function addModuleDirectory(data: ModuleDirectoryCreate): Promise<ModuleDirectory> {
  return unwrapIpc(await window.electron.moduleDir.add(data as unknown as Record<string, unknown>));
}

export async function listModuleDirectories(moduleId: string): Promise<ModuleDirectory[]> {
  return unwrapIpc(await window.electron.moduleDir.list(moduleId));
}

export async function removeModuleDirectory(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.moduleDir.remove(id));
}

export async function updateModuleDirectoryPath(id: string, dirPath: string): Promise<ModuleDirectory> {
  return unwrapIpc(await window.electron.moduleDir.updatePath(id, dirPath));
}

export const moduleService = {
  create: createModule, list: listModules, update: updateModule, delete: deleteModule,
  dir: { add: addModuleDirectory, list: listModuleDirectories, remove: removeModuleDirectory, updatePath: updateModuleDirectoryPath },
};
