import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { syncRemoteInstanceFromAgent, syncRemoteInstanceToAgent } from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerInstanceContentIpc(): void {
  ipcMain.handle('instance:syncToAgent', async (_e, instanceId: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await syncRemoteInstanceToAgent(instanceId);
      broadcastChange({ type: 'instances', action: 'updated', id: instanceId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('instance:syncFromAgent', async (_e, instanceId: string, agentContent: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await syncRemoteInstanceFromAgent(instanceId, agentContent);
      broadcastChange({ type: 'instances', action: 'updated', id: instanceId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
