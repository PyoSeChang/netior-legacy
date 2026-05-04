import { useState, useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from '../stores/editor-store';
import { registerSession, unregisterSession } from '../lib/editor-session-registry';

export interface EditorSessionConfig<T> {
  tabId: string;
  /** Load initial/persisted state */
  load: () => Promise<T> | T;
  /** Persist state */
  save: (state: T) => Promise<void>;
  /** Custom equality check (default: JSON.stringify comparison) */
  isEqual?: (a: T, b: T) => boolean;
  /** Dependencies that trigger reload */
  deps?: unknown[];
}

export interface EditorSession<T> {
  state: T;
  setState: (updater: T | ((prev: T) => T)) => void;
  isDirty: boolean;
  save: () => Promise<void>;
  revert: () => void;
  isLoading: boolean;
  reload: (forceFresh?: boolean) => Promise<void>;
}

function defaultIsEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Draft cache that survives component unmount/remount */
const draftCache = new Map<string, { draft: unknown; snapshot: unknown }>();

export function clearDraftCache(tabId: string): void {
  draftCache.delete(tabId);
}

export function replaceDraftCache<T>(tabId: string, data: T): void {
  draftCache.set(tabId, { draft: data, snapshot: data });
}

export function useEditorSession<T>(config: EditorSessionConfig<T>): EditorSession<T> {
  const { tabId, load, save, isEqual = defaultIsEqual, deps = [] } = config;

  const cached = draftCache.get(tabId) as { draft: T; snapshot: T } | undefined;
  const [state, setStateRaw] = useState<T>(cached?.draft ?? (undefined as unknown as T));
  const [isLoading, setIsLoading] = useState(!cached);
  const [isDirty, setIsDirtyLocal] = useState(() => {
    if (cached) return !defaultIsEqual(cached.draft, cached.snapshot);
    return false;
  });
  const snapshotRef = useRef<T>(cached?.snapshot ?? (undefined as unknown as T));
  const stateRef = useRef<T>(cached?.draft ?? (undefined as unknown as T));
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;

  // Stable refs for save config to avoid stale closures
  const saveRef = useRef(save);
  saveRef.current = save;
  const loadRef = useRef(load);
  loadRef.current = load;

  const syncDirty = useCallback((current: T) => {
    const dirty = !isEqualRef.current(snapshotRef.current, current);
    setIsDirtyLocal(dirty);
    useEditorStore.getState().setDirty(tabId, dirty);
  }, [tabId]);

  const doLoad = useCallback(async (forceFresh = false) => {
    // If we have a cached draft, use it instead of reloading from disk
    const existing = draftCache.get(tabId) as { draft: T; snapshot: T } | undefined;
    if (existing && !forceFresh) {
      snapshotRef.current = existing.snapshot;
      stateRef.current = existing.draft;
      setStateRaw(existing.draft);
      const dirty = !isEqualRef.current(existing.snapshot, existing.draft);
      setIsDirtyLocal(dirty);
      useEditorStore.getState().setDirty(tabId, dirty);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await loadRef.current();
      const initialDirty = forceFresh
        ? false
        : (useEditorStore.getState().tabs.find((tab) => tab.id === tabId)?.isDirty ?? false);
      snapshotRef.current = data;
      stateRef.current = data;
      setStateRaw(data);
      setIsDirtyLocal(initialDirty);
      useEditorStore.getState().setDirty(tabId, initialDirty);
      draftCache.set(tabId, { draft: data, snapshot: data });
    } finally {
      setIsLoading(false);
    }
  }, [tabId, syncDirty]);

  // Load on mount and when deps change
  useEffect(() => {
    doLoad();
  }, [doLoad, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    setStateRaw((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      stateRef.current = next;
      // Update draft cache
      draftCache.set(tabId, { draft: next, snapshot: snapshotRef.current });
      // Defer dirty sync to avoid setState-during-render
      queueMicrotask(() => syncDirty(next));
      return next;
    });
  }, [tabId, syncDirty]);

  const handleSave = useCallback(async () => {
    const current = stateRef.current;
    await saveRef.current(current);
    snapshotRef.current = current;
    setIsDirtyLocal(false);
    useEditorStore.getState().setDirty(tabId, false);
    draftCache.set(tabId, { draft: current, snapshot: current });
  }, [tabId]);

  const revert = useCallback(() => {
    const snap = snapshotRef.current;
    stateRef.current = snap;
    setStateRaw(snap);
    setIsDirtyLocal(false);
    useEditorStore.getState().setDirty(tabId, false);
    draftCache.set(tabId, { draft: snap, snapshot: snap });
  }, [tabId]);

  // Register/unregister with session registry
  useEffect(() => {
    const handle = {
      save: () => {
        const s = useEditorStore.getState();
        const tab = s.tabs.find((t) => t.id === tabId);
        if (!tab?.isDirty) return Promise.resolve();
        return handleSave();
      },
      isDirty: () => useEditorStore.getState().tabs.find((t) => t.id === tabId)?.isDirty ?? false,
      revert,
    };
    registerSession(tabId, handle);
    return () => unregisterSession(tabId);
  }, [tabId, handleSave, revert]);

  return { state, setState, isDirty, save: handleSave, revert, isLoading, reload: doLoad };
}
