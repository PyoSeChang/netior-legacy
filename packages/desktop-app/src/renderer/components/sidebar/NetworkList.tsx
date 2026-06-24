import React, { useState, useCallback, useEffect } from 'react';
import { Boxes, Plus, Trash2, Waypoints, ChevronRight, ChevronDown, ExternalLink, Pin, PinOff } from 'lucide-react';
import type { NetworkKind, NetworkTreeNode } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorStore } from '../../stores/editor-store';
import { useActivityBarStore } from '../../stores/activity-bar-store';
import { useI18n } from '../../hooks/useI18n';
import { getWorldNetworkBookmarkIds } from '../../lib/activity-bar-layout';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { openNetworkViewerTab } from '../../lib/open-network-viewer-tab';

interface NetworkListProps {
  rootNetworkId: string;
  kindFilter?: NetworkKind | NetworkKind[];
  title?: string;
  canCreate?: boolean;
}

function filterTreeByKind(nodes: NetworkTreeNode[], kinds: NetworkKind | NetworkKind[]): NetworkTreeNode[] {
  const kindSet = new Set(Array.isArray(kinds) ? kinds : [kinds]);

  const visit = (treeNodes: NetworkTreeNode[]): NetworkTreeNode[] => treeNodes.flatMap((node) => {
    if (kindSet.has(node.network.kind)) {
      return [node];
    }

    return visit(node.children);
  });

  return visit(nodes);
}

// ??? Context Menu ????????????????????????????????????????????????

interface NetworkContextMenuState {
  x: number;
  y: number;
  networkId: string;
  networkName: string;
  networkKind: string;
  networkRootNetworkId: string | null;
}

// ??? Tree Item ???????????????????????????????????????????????????

function TreeNode({
  treeNode,
  depth,
  currentNetworkId,
  onOpen,
  onContextMenu,
}: {
  treeNode: NetworkTreeNode;
  depth: number;
  currentNetworkId?: string;
  onOpen: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, name: string, kind: string, rootNetworkId: string | null) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(depth < 2);
  const isActive = currentNetworkId === treeNode.network.id;
  const hasChildren = treeNode.children.length > 0;
  const NetworkIcon = treeNode.network.kind === 'root' ? Boxes : Waypoints;

  return (
    <>
      {/* Network row */}
      <div
        className={`group flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors ${
          isActive
            ? 'bg-state-selected text-accent'
            : 'text-secondary hover:bg-state-hover hover:text-default'
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => onOpen(treeNode.network.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, treeNode.network.id, treeNode.network.name, treeNode.network.kind, treeNode.network.root_network_id);
        }}
      >
        {hasChildren ? (
          <button
            className="shrink-0 p-0.5"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <NetworkIcon size={12} className="shrink-0 opacity-60" />
        <span className="flex-1 truncate">{treeNode.network.name}</span>
      </div>

      {/* Children */}
      {expanded && treeNode.children.map((child) => (
        <TreeNode
          key={child.network.id}
          treeNode={child}
          depth={depth + 1}
          currentNetworkId={currentNetworkId}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

// ??? NetworkList Root ?????????????????????????????????????????????

export function NetworkList({ rootNetworkId, kindFilter, title, canCreate }: NetworkListProps): JSX.Element {
  const { t } = useI18n();
  const { currentNetwork, createNetwork, openNetwork, loadNetworkTree, networkTree } = useNetworkStore();
  const ensureActivityBarLoaded = useActivityBarStore((state) => state.ensureLoaded);
  const addBookmark = useActivityBarStore((state) => state.addBookmark);
  const removeBookmark = useActivityBarStore((state) => state.removeBookmark);
  const bookmarkedNetworkIds = useActivityBarStore((state) => getWorldNetworkBookmarkIds(state.config, rootNetworkId));
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [contextMenu, setContextMenu] = useState<NetworkContextMenuState | null>(null);
  const allowCreate = canCreate ?? kindFilter !== 'root';
  const visibleTree = kindFilter ? filterTreeByKind(networkTree, kindFilter) : networkTree;

  useEffect(() => {
    loadNetworkTree(rootNetworkId);
  }, [rootNetworkId, loadNetworkTree]);

  useEffect(() => {
    void ensureActivityBarLoaded();
  }, [ensureActivityBarLoaded]);

  useEffect(() => {
    if (!creating) return undefined;

    const handleWindowBlur = () => {
      setCreating(false);
      setNewName('');
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [creating]);

  const handleCreate = async () => {
    if (!allowCreate) return;
    if (!newName.trim()) return;
    const network = await createNetwork({
      root_network_id: rootNetworkId,
      name: newName.trim(),
    });
    await openNetwork(network.id);
    await loadNetworkTree(rootNetworkId);
    setNewName('');
    setCreating(false);
  };

  const handleCancel = () => {
    setCreating(false);
    setNewName('');
  };

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    networkId: string,
    networkName: string,
    networkKind: string,
    networkRootNetworkId: string | null,
  ) => {
    setContextMenu({ x: e.clientX, y: e.clientY, networkId, networkName, networkKind, networkRootNetworkId });
  }, []);

  const contextMenuIsSystem = contextMenu?.networkKind === 'universe' || contextMenu?.networkKind === 'root';
  const contextMenuIsBookmarked = contextMenu ? bookmarkedNetworkIds.includes(contextMenu.networkId) : false;
  const contextMenuItems: ContextMenuEntry[] = contextMenu ? [
    {
      label: t('network.openViewer' as never),
      icon: <Waypoints size={14} />,
      onClick: () => {
        void openNetworkViewerTab({
          networkId: contextMenu.networkId,
          title: contextMenu.networkName,
          rootNetworkId: contextMenu.networkRootNetworkId ?? rootNetworkId,
        });
      },
    },
    {
      label: t('editor.openInEditor'),
      icon: <ExternalLink size={14} />,
      onClick: () => {
        void useEditorStore.getState().openTab({
          type: 'network',
          targetId: contextMenu.networkId,
          title: contextMenu.networkName,
          rootNetworkId: contextMenu.networkRootNetworkId ?? rootNetworkId,
        });
      },
    },
    ...(!contextMenuIsSystem ? [{
      label: contextMenuIsBookmarked ? t('sidebar.removeBookmark' as never) : t('sidebar.addBookmark' as never),
      icon: contextMenuIsBookmarked ? <PinOff size={14} /> : <Pin size={14} />,
      onClick: async () => {
        if (contextMenuIsBookmarked) {
          await removeBookmark(rootNetworkId, contextMenu.networkId);
          return;
        }
        await addBookmark(rootNetworkId, contextMenu.networkId);
      },
    } satisfies ContextMenuEntry] : []),
    ...(!contextMenuIsSystem ? [
      { type: 'divider' as const },
      {
        label: t('network.createSubNetwork'),
        icon: <Plus size={14} />,
        onClick: async () => {
          const child = await createNetwork({
            root_network_id: contextMenu.networkRootNetworkId ?? rootNetworkId,
            name: t('network.defaultName'),
            parent_network_id: contextMenu.networkId,
          });
          await loadNetworkTree(rootNetworkId);
          await openNetwork(child.id);
          void openNetworkViewerTab({
            networkId: child.id,
            title: child.name,
            rootNetworkId: child.root_network_id ?? rootNetworkId,
            isDirty: true,
          });
        },
      },
      {
        label: t('common.delete'),
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: async () => {
          await useNetworkStore.getState().deleteNetwork(contextMenu.networkId);
          await loadNetworkTree(rootNetworkId);
        },
      },
    ] : []),
  ] : [];

  return (
    <div className="flex flex-col gap-0.5" onMouseDown={() => setContextMenu(null)}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-secondary">{title ?? t('sidebar.networks')}</span>
        {allowCreate && (
          <button
            className="rounded p-0.5 text-muted hover:bg-state-hover hover:text-default"
            onClick={() => setCreating(true)}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {allowCreate && creating && (
        <div className="flex flex-col gap-1 px-2">
          <input
            className="rounded border border-subtle bg-surface-input px-2 py-1 text-xs text-default outline-none focus:border-accent"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleCancel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder={t('network.namePlaceholder')}
            autoFocus
          />
        </div>
      )}

      {visibleTree.map((treeNode) => (
        <TreeNode
          key={treeNode.network.id}
          treeNode={treeNode}
          depth={0}
          currentNetworkId={currentNetwork?.id}
          onOpen={openNetwork}
          onContextMenu={handleContextMenu}
        />
      ))}

      {visibleTree.length === 0 && !creating && (
        <div className="px-3 py-4 text-xs text-muted text-center">
          {t('network.noNetworks') ?? 'No networks'}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
