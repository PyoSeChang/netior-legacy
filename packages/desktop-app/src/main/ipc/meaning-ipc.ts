import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteModel,
  deleteRemoteModel,
  getRemoteModel,
  listRemoteModels,
  updateRemoteModel,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerModelIpc(): void {
  ipcMain.handle('meaning:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteModel(data);
      broadcastChange({ type: 'meanings', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('meaning:list', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteModels(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('meaning:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteModel(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('meaning:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteModel(id, data);
      broadcastChange({ type: 'meanings', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('meaning:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      console.info('[ModelDelete][main-ipc] start', { id });
      const result = await deleteRemoteModel(id);
      console.info('[ModelDelete][main-ipc] result', { id, result });
      broadcastChange({ type: 'meanings', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      console.error('[ModelDelete][main-ipc] failed', { id, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  });
}
