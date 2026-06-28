import { useEffect } from 'react';
import { useDomainStore } from '../stores/domain-store';

export function useNetiorSync(rootNetworkId: string | null): void {
  useEffect(() => {
    if (!rootNetworkId) return;

    const cleanup = window.electron.mocSync?.onChangeEvent(() => {
      void useDomainStore.getState().refreshCurrentWorld();
    });

    return cleanup;
  }, [rootNetworkId]);
}
