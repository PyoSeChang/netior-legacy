import { useEffect } from 'react';
import { useEditorStore } from '../stores/editor-store';
import { getSession } from '../lib/editor-session-registry';

export function useGlobalSave(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const tabId = useEditorStore.getState().activeTabId;
        if (tabId) {
          getSession(tabId)?.save();
        }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}
