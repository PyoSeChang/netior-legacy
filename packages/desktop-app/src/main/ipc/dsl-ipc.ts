import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import type { NetiorDslEvaluateRequest } from '@netior/shared/dsl';
import { evaluateRemoteDsl } from '../netior-service/netior-service-client';

export function registerDslIpc(): void {
  ipcMain.handle('dsl:evaluate', async (_event, data: NetiorDslEvaluateRequest): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await evaluateRemoteDsl(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
