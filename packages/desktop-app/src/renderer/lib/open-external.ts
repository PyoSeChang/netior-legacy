import { openBrowserTab } from './open-browser-tab';

export async function openExternal(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;
  if (await openBrowserTab(trimmed)) return;
  await window.electron.shell.openExternal(trimmed);
}
