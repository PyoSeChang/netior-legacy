import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteWorld,
  deleteRemoteWorld,
  listRemoteWorlds,
  updateRemoteWorld,
  updateRemoteWorldRootDir,
} from '../netior-service/netior-service-client';

export function registerWorldIpc(): void {
  ipcMain.handle('world:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await createRemoteWorld(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('world:list', async (): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteWorlds() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('world:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await deleteRemoteWorld(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('world:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await updateRemoteWorld(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('world:updateRootDir', async (_e, id: string, rootDir: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await updateRemoteWorldRootDir(id, rootDir) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
