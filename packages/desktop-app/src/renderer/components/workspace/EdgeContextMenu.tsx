import React, { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { WorkspaceContextMenuSurface } from './WorkspaceContextMenuSurface';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  onClose: () => void;
}

export function EdgeContextMenu({ x, y, edgeId, onClose }: EdgeContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const { removeEdge } = useNetworkStore();

  const handleDelete = useCallback(async () => {
    const tabId = `edge:${edgeId}`;
    const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
    if (tab) useEditorStore.getState().closeTab(tabId);

    await removeEdge(edgeId);
    onClose();
  }, [edgeId, removeEdge, onClose]);

  return (
    <WorkspaceContextMenuSurface x={x} y={y} onClose={onClose}>
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-red-400 hover:bg-state-hover cursor-pointer"
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        {t('edge.delete')}
      </button>
    </WorkspaceContextMenuSurface>
  );
}
