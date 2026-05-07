import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { getRemoteEditorPrefs, upsertRemoteEditorPrefs } from '../netior-service/netior-service-client';

export function registerEditorPrefsIpc(): void {
  ipcMain.handle('editorPrefs:get', async (_e, instanceId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteEditorPrefs(instanceId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('editorPrefs:upsert', async (_e, instanceId: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await upsertRemoteEditorPrefs(instanceId, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
