import { BrowserWindow, ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import type { NetiorServiceEvent } from '@netior/shared';
import {
  callNetiorRpc,
  deleteRemoteResourceContent,
  readRemoteResourceContent,
  subscribeRemoteEvents,
  writeRemoteResourceContent,
  type ResourceContentWriteInput,
} from '../netior-service/netior-service-client';

const NETIOR_SERVICE_EVENT_CHANNEL = 'netior:service-event';

let unsubscribeEvents: (() => void) | null = null;

export function registerNetiorRpcIpc(): void {
  ipcMain.handle('netior:rpc:call', async (_event, method: string, params?: unknown): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await callNetiorRpc(method, params) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('netior:resource:getContent', async (_event, resourceId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await readRemoteResourceContent(resourceId) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'netior:resource:putContent',
    async (_event, resourceId: string, input: ResourceContentWriteInput): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await writeRemoteResourceContent(resourceId, input) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  ipcMain.handle('netior:resource:deleteContent', async (_event, resourceId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await deleteRemoteResourceContent(resourceId) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  startNetiorEventRelay();
}

function startNetiorEventRelay(): void {
  if (unsubscribeEvents) return;
  unsubscribeEvents = subscribeRemoteEvents(
    (event) => broadcastNetiorServiceEvent(event),
    (error) => {
      console.warn('[netior-service] Event relay error:', error.message);
      stopNetiorEventRelay();
    },
  );
}

function stopNetiorEventRelay(): void {
  const unsubscribe = unsubscribeEvents;
  unsubscribeEvents = null;
  unsubscribe?.();
}

function broadcastNetiorServiceEvent(event: NetiorServiceEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(NETIOR_SERVICE_EVENT_CHANNEL, event);
    }
  }
}
