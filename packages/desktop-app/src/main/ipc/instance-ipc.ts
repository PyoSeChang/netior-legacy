import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteInstance,
  deleteRemoteInstance,
  listRemoteInstancesByWorld,
  searchRemoteInstances,
  updateRemoteInstance,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerInstanceIpc(): void {
  ipcMain.handle('instance:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteInstance(data);
      broadcastChange({ type: 'instances', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('instance:getByRootNetwork', async (_e, rootNetworkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteInstancesByWorld(rootNetworkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('instance:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteInstance(id, data);
      broadcastChange({ type: 'instances', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('instance:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteInstance(id);
      broadcastChange({ type: 'instances', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('instance:search', async (_e, rootNetworkId: string, query: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await searchRemoteInstances(rootNetworkId, query) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
