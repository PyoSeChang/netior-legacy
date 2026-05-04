const knownSignatureRegistry = new Map<string, string>();
const suppressUntilRegistry = new Map<string, number>();

export function getKnownFileTabSignature(tabId: string): string | undefined {
  return knownSignatureRegistry.get(tabId);
}

export function setKnownFileTabSignature(tabId: string, signature: string): void {
  knownSignatureRegistry.set(tabId, signature);
}

export function markFileTabSaved(tabId: string, signature: string, suppressMs = 1000): void {
  knownSignatureRegistry.set(tabId, signature);
  suppressUntilRegistry.set(tabId, Date.now() + suppressMs);
}

export function shouldSuppressFileTabChange(tabId: string): boolean {
  const suppressUntil = suppressUntilRegistry.get(tabId);
  if (suppressUntil == null) return false;
  if (suppressUntil > Date.now()) return true;
  suppressUntilRegistry.delete(tabId);
  return false;
}

export function clearMissingFileTabState(activeTabIds: Iterable<string>): void {
  const activeSet = new Set(activeTabIds);
  for (const tabId of [...knownSignatureRegistry.keys()]) {
    if (!activeSet.has(tabId)) knownSignatureRegistry.delete(tabId);
  }
  for (const tabId of [...suppressUntilRegistry.keys()]) {
    if (!activeSet.has(tabId)) suppressUntilRegistry.delete(tabId);
  }
}
