import { useEffect } from 'react';
import type { NetiorChangeEvent } from '@netior/shared/types';
import { useSchemaStore } from '../stores/schema-store';
import { useInstanceStore } from '../stores/instance-store';
import { useMeaningStore } from '../stores/meaning-store';
import { useNetworkStore } from '../stores/network-store';
import { useContextStore } from '../stores/context-store';

export function useNetiorSync(rootNetworkId: string | null): void {
  useEffect(() => {
    if (!rootNetworkId) return;

    const cleanup = window.electron.mocSync?.onChangeEvent((event: unknown) => {
      const change = event as NetiorChangeEvent;
      switch (change.type) {
        case 'meanings':
          useSchemaStore.getState().loadByWorld(rootNetworkId);
          useMeaningStore.getState().loadByWorld(rootNetworkId);
          break;
        case 'instances':
          useInstanceStore.getState().loadByWorld(rootNetworkId);
          break;
        case 'networks':
          useNetworkStore.getState().loadNetworks(rootNetworkId);
          useNetworkStore.getState().loadNetworkTree(rootNetworkId);
          {
            const currentNetwork = useNetworkStore.getState().currentNetwork;
            if (currentNetwork) {
              useNetworkStore.getState().openNetwork(currentNetwork.id);
            }
          }
          break;
        case 'contexts': {
          const currentNetwork = useNetworkStore.getState().currentNetwork;
          if (currentNetwork) {
            useContextStore.getState().loadContexts(currentNetwork.id);
          }
          break;
        }
        case 'edges':
        case 'relationships':
        case 'layouts': {
          // Refresh the current network to get updated relationship-backed edges/layouts.
          const currentNetwork = useNetworkStore.getState().currentNetwork;
          if (currentNetwork) {
            useNetworkStore.getState().openNetwork(currentNetwork.id);
          }
          break;
        }
      }
    });

    return cleanup;
  }, [rootNetworkId]);
}
