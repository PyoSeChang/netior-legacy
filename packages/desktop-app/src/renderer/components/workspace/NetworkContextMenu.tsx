import React, { useEffect, useState } from 'react';
import { Plus, Shapes, ArrowRightLeft, File } from 'lucide-react';
import type { Network } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useI18n } from '../../hooks/useI18n';
import { WorkspaceContextMenuSurface } from './WorkspaceContextMenuSurface';

interface NetworkContextMenuProps {
  x: number;
  y: number;
  onCreateConcept?: () => void;
  onAddObject?: () => void;
  onAddFileNode?: () => void;
  onClose: () => void;
}

export function NetworkContextMenu({
  x,
  y,
  onCreateConcept,
  onAddObject,
  onAddFileNode,
  onClose,
}: NetworkContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const { currentNetwork, networks, openNetwork } = useNetworkStore();
  const [siblingNetworks, setSiblingNetworks] = useState<Network[]>([]);

  // Load sibling networks (same parent_network_id)
  useEffect(() => {
    if (!currentNetwork) return;
    setSiblingNetworks(
      networks.filter((c) => c.id !== currentNetwork.id && c.parent_network_id === currentNetwork.parent_network_id)
    );
  }, [currentNetwork, networks]);

  const handleSwitch = async (networkId: string) => {
    await openNetwork(networkId);
    onClose();
  };

  return (
    <WorkspaceContextMenuSurface x={x} y={y} onClose={onClose}>
      {onCreateConcept && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={() => {
            onCreateConcept();
            onClose();
          }}
        >
          <Plus size={14} />
          {t('network.createConcept')}
        </button>
      )}

      {onAddObject && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={() => {
            onAddObject();
            onClose();
          }}
        >
          <Shapes size={14} />
          {t('common.add')}
        </button>
      )}

      {onAddFileNode && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
          onClick={() => {
            onAddFileNode();
            onClose();
          }}
        >
          <File size={14} />
          {t('network.addFileNode')}
        </button>
      )}

      {siblingNetworks.length > 0 && (
        <>
          <div className="my-1 border-t border-subtle" />
          <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
            <ArrowRightLeft size={10} />
            {t('network.switchNetwork') ?? 'Switch Network'}
          </div>
          {siblingNetworks.map((c) => (
            <button
              key={c.id}
              className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-state-hover cursor-pointer"
              onClick={() => handleSwitch(c.id)}
            >
              {c.name}
            </button>
          ))}
        </>
      )}
    </WorkspaceContextMenuSurface>
  );
}
