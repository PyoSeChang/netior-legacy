import { BrowserWindow } from 'electron';
import type { NetiorChangeEvent } from '@netior/shared/types';

/** Broadcast a workspace data change event to all renderer windows. */
export function broadcastChange(event: NetiorChangeEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('netior:change', event);
    }
  }
}
