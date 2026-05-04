import { useEffect, useMemo, useRef } from 'react';
import { useEditorStore } from '../stores/editor-store';
import { fsService } from '../services';
import {
  clearMissingFileTabState,
  getKnownFileTabSignature,
  setKnownFileTabSignature,
  shouldSuppressFileTabChange,
} from '../lib/file-tab-stale-registry';

interface FileTabSnapshot {
  id: string;
  path: string;
}

function toFileSignature(fileStat: Awaited<ReturnType<typeof fsService.statItem>>): string {
  return fileStat.exists
    ? `${fileStat.mtimeMs ?? 0}:${fileStat.size ?? 0}`
    : 'missing';
}

export function useFileTabStaleWatcher(): void {
  const fileTabs = useEditorStore((s) =>
    s.tabs
      .filter((tab) => tab.type === 'file')
      .map((tab) => ({ id: tab.id, path: tab.targetId })),
  );
  const setStale = useEditorStore((s) => s.setStale);
  const fileTabsRef = useRef<FileTabSnapshot[]>(fileTabs);

  useEffect(() => {
    fileTabsRef.current = fileTabs;
  }, [fileTabs]);

  const fileTabKey = useMemo(
    () => fileTabs.map((tab) => `${tab.id}:${tab.path}`).join('|'),
    [fileTabs],
  );

  useEffect(() => {
    clearMissingFileTabState(fileTabs.map((tab) => tab.id));

    let cancelled = false;
    const primeKnownSignatures = async () => {
      for (const tab of fileTabs) {
        if (getKnownFileTabSignature(tab.id) != null) continue;
        const signature = toFileSignature(await fsService.statItem(tab.path));
        if (cancelled) return;
        setKnownFileTabSignature(tab.id, signature);
      }
    };

    void primeKnownSignatures();
    return () => {
      cancelled = true;
    };
  }, [fileTabKey, fileTabs]);

  useEffect(() => {
    const unsubscribe = fsService.onDirChanged(() => {
      void (async () => {
        for (const tab of fileTabsRef.current) {
          if (shouldSuppressFileTabChange(tab.id)) continue;
          const nextSignature = toFileSignature(await fsService.statItem(tab.path));
          const knownSignature = getKnownFileTabSignature(tab.id);
          if (knownSignature == null) {
            setKnownFileTabSignature(tab.id, nextSignature);
            continue;
          }
          if (knownSignature !== nextSignature) {
            setStale(tab.id, true);
          }
        }
      })();
    });

    return unsubscribe;
  }, [setStale]);
}
