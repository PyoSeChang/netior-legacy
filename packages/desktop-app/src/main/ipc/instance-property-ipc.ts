import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  deleteRemoteInstanceProperty,
  getRemoteInstanceProperties,
  upsertRemoteInstanceProperty,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerInstancePropertyIpc(): void {
  ipcMain.handle('instanceProp:upsert', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await upsertRemoteInstanceProperty(data);
      broadcastChange({ type: 'instances', action: 'updated', id: data.instance_id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('instanceProp:getByInstance', async (_e, instanceId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteInstanceProperties(instanceId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('instanceProp:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteInstanceProperty(id);
      broadcastChange({ type: 'instances', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
