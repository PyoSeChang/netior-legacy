import { useSettingsStore } from '../stores/settings-store';
import { openBrowserTab } from './open-browser-tab';

export async function openExternal(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;
  if (useSettingsStore.getState().browser.openLinksInApp && await openBrowserTab(trimmed)) return;
  await window.electron.shell.openExternal(trimmed);
}
