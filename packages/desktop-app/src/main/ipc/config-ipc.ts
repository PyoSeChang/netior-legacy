import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { getDesktopConfig, setDesktopConfig } from '../config/desktop-config-store';
import { isNarreManagedSettingKey, syncNarreServerWithSettings, writeNarreSetting } from '../narre/narre-config';

export function registerConfigIpc(): void {
  ipcMain.handle('config:get', async (_e, key: string): Promise<IpcResult<unknown>> => {
    try {
      const value = getDesktopConfig(key);
      return { success: true, data: value ?? null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    'config:set',
    async (_e, key: string, value: unknown): Promise<IpcResult<unknown>> => {
      try {
        if (isNarreManagedSettingKey(key)) {
          await writeNarreSetting(key, value);
          await syncNarreServerWithSettings();
        } else {
          setDesktopConfig(key, value);
        }
        return { success: true, data: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}
