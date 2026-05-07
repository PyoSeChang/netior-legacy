import React from 'react';
import { Layers } from 'lucide-react';
import { useNetworkStore } from '../../stores/network-store';
import { useI18n } from '../../hooks/useI18n';

interface NodeNetworkOverlayProps {
  instanceId: string;
  /** Screen-space position of the node */
  x: number;
  y: number;
  onClose: () => void;
}

export function NodeNetworkOverlay({ instanceId, x, y, onClose }: NodeNetworkOverlayProps): JSX.Element | null {
  const { t } = useI18n();
  const { openNetwork, currentNetwork, networks } = useNetworkStore();

  // Show child networks of the current network
  const childNetworks = currentNetwork
    ? networks.filter((n) => n.parent_network_id === currentNetwork.id)
    : [];

  if (childNetworks.length === 0) return null;

  const handleClick = async (networkId: string) => {
    if (currentNetwork) {
      useNetworkStore.setState((s) => ({
        networkHistory: [...s.networkHistory, currentNetwork.id],
      }));
    }
    await openNetwork(networkId);
    onClose();
  };

  return (
    <div
      className="fixed z-40 bg-surface-panel border border-default rounded-md shadow-lg py-1 min-w-[140px]"
      style={{ left: x, top: y - 8, transform: 'translateY(-100%)' }}
      onMouseLeave={onClose}
    >
      <div className="px-2 py-1 text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
        <Layers size={10} />
        {t('network.networksForInstance') ?? 'Networks'}
      </div>
      {childNetworks.map((c) => (
        <button
          key={c.id}
          type="button"
          className="w-full text-left px-3 py-1 text-xs text-default hover:bg-state-hover transition-colors"
          onClick={() => handleClick(c.id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
