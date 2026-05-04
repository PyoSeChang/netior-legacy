const reloadRegistry = new Map<string, () => void>();

export function registerFileEditorReloadHandler(tabId: string, handler: () => void): void {
  reloadRegistry.set(tabId, handler);
}

export function unregisterFileEditorReloadHandler(tabId: string): void {
  reloadRegistry.delete(tabId);
}

export function getFileEditorReloadHandler(tabId: string): (() => void) | undefined {
  return reloadRegistry.get(tabId);
}
