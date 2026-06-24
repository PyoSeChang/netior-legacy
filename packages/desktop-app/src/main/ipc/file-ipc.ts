import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteFile,
  deleteRemoteFile,
  getRemoteFile,
  getRemoteFileByPath,
  listRemoteFilesByWorld,
  updateRemoteFile,
} from '../netior-service/netior-service-client';

export function registerFileIpc(): void {
  ipcMain.handle('file:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await createRemoteFile(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteFile(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:getByPath', async (_e, rootNetworkId: string, path: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteFileByPath(rootNetworkId, path) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:getByRootNetwork', async (_e, rootNetworkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteFilesByWorld(rootNetworkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await updateRemoteFile(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await deleteRemoteFile(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
