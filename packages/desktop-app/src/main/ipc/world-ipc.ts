import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { callNetiorRpc } from '../netior-service/netior-service-client';

export function registerWorldIpc(): void {
  ipcMain.handle('world:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await callNetiorRpc('world.create', data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('world:list', async (): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await callNetiorRpc('world.list') };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('world:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await callNetiorRpc('world.archive', { id }) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('world:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const method = data && typeof data === 'object' && 'name' in data
        ? 'world.rename'
        : 'world.updateSettings';
      return { success: true, data: await callNetiorRpc(method, { id, ...data }) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('world:updateRootDir', async (_e, id: string, rootDir: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await callNetiorRpc('world.updateSettings', { id, root_uri: rootDir }) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
