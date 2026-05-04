export async function openExternal(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;
  await window.electron.shell.openExternal(trimmed);
}
