export interface EditorSessionHandle {
  save: () => Promise<void>;
  isDirty: () => boolean;
  revert: () => void;
}

const registry = new Map<string, EditorSessionHandle>();

export function registerSession(tabId: string, handle: EditorSessionHandle): void {
  registry.set(tabId, handle);
}

export function unregisterSession(tabId: string): void {
  registry.delete(tabId);
}

export function getSession(tabId: string): EditorSessionHandle | undefined {
  return registry.get(tabId);
}

export function hasUnsavedChanges(tabId: string): boolean {
  return registry.get(tabId)?.isDirty() ?? false;
}
