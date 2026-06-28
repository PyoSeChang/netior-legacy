import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { Box, ChevronRight, ExternalLink, Orbit, Plus, RefreshCw } from 'lucide-react';
import { type WorldNodeRecord } from '@netior/shared';
import type { World } from '@netior/shared/types';
import { useFileStore } from '../../stores/file-store';
import { useUIStore } from '../../stores/ui-store';
import { useWorldStore } from '../../stores/world-store';
import { FileTree } from './FileTree';
import { ScrollArea } from '../ui/ScrollArea';
import { Spinner } from '../ui/Spinner';
import { Tooltip } from '../ui/Tooltip';
import { fsService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { openFileTab } from '../../lib/open-file-tab';
import { WorldCreateDialog } from '../home/WorldCreateDialog';
import { AgentSessionPanel } from './AgentSessionPanel';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { useEditorStore } from '../../stores/editor-store';
import { formatCompactPath } from '../../utils/path-utils';
import { getWorldRootDir } from '../../utils/world-utils';
import { useDomainStore } from '../../stores/domain-store';

interface SidebarProps {
  world: World | null;
}

interface ModelTreeNode {
  record: WorldNodeRecord;
  children: ModelTreeNode[];
}

type DomainRecord = Record<string, unknown>;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getWorldRootId(world: World): string {
  return stringValue((world as unknown as DomainRecord).root_id) ?? world.id;
}

function getPathBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.split('/').filter(Boolean).pop() ?? path;
}

function buildModelTree(nodes: WorldNodeRecord[], rootId: string): ModelTreeNode[] {
  const childrenByParent = new Map<string, WorldNodeRecord[]>();
  for (const node of nodes) {
    if (node.node_type !== 'model' || node.root_id !== rootId || node.status === 'archived') continue;
    const parentId = node.parent_id ?? rootId;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(node);
    childrenByParent.set(parentId, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  const visit = (parentId: string): ModelTreeNode[] => (
    (childrenByParent.get(parentId) ?? []).map((record) => ({
      record,
      children: visit(record.id),
    }))
  );

  return visit(rootId);
}

function AppWorkspaceSidebar(): JSX.Element {
  const { t } = useI18n();
  const worlds = useWorldStore((s) => s.worlds);
  const createWorld = useWorldStore((s) => s.createWorld);
  const openWorld = useWorldStore((s) => s.openWorld);
  const currentWorld = useWorldStore((s) => s.currentWorld);
  const [showCreateWorld, setShowCreateWorld] = useState(false);
  const [worldContextMenu, setWorldContextMenu] = useState<{
    x: number;
    y: number;
    world: World;
  } | null>(null);

  const handleCreateWorld = async (name: string, rootDir: string) => {
    const world = await createWorld(name, rootDir);
    await handleOpenWorld(world);
  };

  const handleOpenWorld = async (world: World) => {
    await openWorld(world);
  };

  const worldContextMenuItems: ContextMenuEntry[] = worldContextMenu
    ? [
      {
        label: t('editor.openInEditor'),
        icon: <ExternalLink size={14} />,
        onClick: () => {
          void useEditorStore.getState().openTab({
            type: 'world',
            targetId: worldContextMenu.world.id,
            title: worldContextMenu.world.name,
          });
        },
      },
    ]
    : [];

  return (
    <div className="flex min-h-full flex-col gap-4 py-2">
      <div className="px-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-secondary">{t('world.title' as never) ?? 'Worlds'}</div>
          <button
            type="button"
            className="rounded p-1 text-muted transition-colors hover:bg-state-hover hover:text-default"
            onClick={() => setShowCreateWorld(true)}
            title={t('world.create')}
          >
            <Plus size={12} />
          </button>
        </div>
        {worlds.length > 0 ? (
          <div className="flex flex-col gap-1">
            {worlds.map((world) => (
              <button
                key={world.id}
                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  currentWorld?.id === world.id
                    ? 'bg-state-selected text-accent'
                    : 'text-default hover:bg-state-hover'
                }`}
                onClick={() => {
                  void handleOpenWorld(world);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setWorldContextMenu({ x: event.clientX, y: event.clientY, world });
                }}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  currentWorld?.id === world.id
                    ? 'bg-accent-muted text-accent'
                    : 'bg-surface-hover text-secondary group-hover:text-default'
                }`}
                >
                  <Orbit size={14} />
                </span>
                <Tooltip content={getWorldRootDir(world)} position="bottom" className="min-w-0 flex-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{world.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {formatCompactPath(getWorldRootDir(world))}
                    </span>
                  </span>
                </Tooltip>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded border border-subtle bg-surface-card px-2 py-3 text-xs text-muted">
            {t('world.noWorldsYet')}
          </div>
        )}
      </div>

      <WorldCreateDialog
        open={showCreateWorld}
        onClose={() => setShowCreateWorld(false)}
        onCreate={handleCreateWorld}
      />
      {worldContextMenu && (
        <ContextMenu
          x={worldContextMenu.x}
          y={worldContextMenu.y}
          items={worldContextMenuItems}
          onClose={() => setWorldContextMenu(null)}
        />
      )}
    </div>
  );
}

function ModelTreeRow({
  node,
  depth,
  activeModelId,
  expanded,
  onToggle,
  onOpen,
}: {
  node: ModelTreeNode;
  depth: number;
  activeModelId: string | null;
  expanded: Set<string>;
  onToggle: (modelId: string) => void;
  onOpen: (model: WorldNodeRecord) => void;
}): JSX.Element {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.record.id);
  const isActive = activeModelId === node.record.id;

  return (
    <div>
      <button
        type="button"
        className={`group flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors ${
          isActive ? 'bg-state-selected text-accent' : 'text-default hover:bg-state-hover'
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onOpen(node.record)}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted ${hasChildren ? 'hover:bg-surface-hover hover:text-default' : ''}`}
          onClick={(event) => {
            if (!hasChildren) return;
            event.stopPropagation();
            onToggle(node.record.id);
          }}
        >
          {hasChildren ? (
            <ChevronRight size={13} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          ) : (
            <span className="h-1 w-1 rounded-full bg-border-strong" />
          )}
        </span>
        <Box size={13} className={isActive ? 'text-accent' : 'text-secondary group-hover:text-default'} />
        <span className="min-w-0 flex-1 truncate font-medium">{node.record.name}</span>
      </button>
      {hasChildren && isOpen && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <ModelTreeRow
              key={child.record.id}
              node={child}
              depth={depth + 1}
              activeModelId={activeModelId}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorldModelTree({ world }: { world: World }): JSX.Element {
  const { t } = useI18n();
  const snapshot = useDomainStore((s) => s.snapshot);
  const activeModelId = useDomainStore((s) => s.activeModelId);
  const setActiveModelId = useDomainStore((s) => s.setActiveModelId);
  const refreshCurrentWorld = useDomainStore((s) => s.refreshCurrentWorld);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [creating, setCreating] = useState(false);
  const rootId = getWorldRootId(world);
  const modelTree = useMemo(
    () => buildModelTree(snapshot?.worldNodes ?? [], rootId),
    [rootId, snapshot?.worldNodes],
  );

  useEffect(() => {
    setExpanded((current) => {
      if (current.has(rootId)) return current;
      const next = new Set(current);
      next.add(rootId);
      for (const node of modelTree) next.add(node.record.id);
      return next;
    });
  }, [modelTree, rootId]);

  const openModel = useCallback((model: WorldNodeRecord) => {
    setActiveModelId(model.id);
    void useEditorStore.getState().openTab({
      type: 'model',
      targetId: model.id,
      title: model.name,
      rootNetworkId: rootId,
    });
  }, [rootId, setActiveModelId]);

  const createModel = useCallback(async () => {
    setCreating(true);
    try {
      const draftId = `draft-model:${crypto.randomUUID()}`;
      await useEditorStore.getState().openTab({
        type: 'model',
        targetId: draftId,
        title: t('domainEditor.newModel' as never),
        rootNetworkId: rootId,
        isDirty: true,
        draftData: {
          mode: 'create',
          parentId: rootId,
          rootId,
        },
      });
    } finally {
      setCreating(false);
    }
  }, [rootId, t]);

  return (
    <section className="px-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-default">{world.name}</div>
          <div className="truncate text-[11px] text-muted">{formatCompactPath(getWorldRootDir(world))}</div>
        </div>
        <Tooltip content={t('sidebar.createModel' as never)} position="bottom">
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted hover:bg-state-hover hover:text-default disabled:opacity-50"
            onClick={createModel}
            disabled={creating}
          >
            <Plus size={13} />
          </button>
        </Tooltip>
      </div>

      {modelTree.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {modelTree.map((node) => (
            <ModelTreeRow
              key={node.record.id}
              node={node}
              depth={0}
              activeModelId={activeModelId}
              expanded={expanded}
              onToggle={(modelId) => {
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(modelId)) next.delete(modelId);
                  else next.add(modelId);
                  return next;
                });
              }}
              onOpen={openModel}
            />
          ))}
        </div>
      ) : (
        <button
          type="button"
          className="w-full rounded border border-subtle bg-surface-card px-2 py-3 text-left text-xs text-muted hover:bg-state-hover"
          onClick={createModel}
          disabled={creating}
        >
          {t('sidebar.noModelsYet' as never)}
        </button>
      )}
    </section>
  );
}

function FolderSection({
  world,
  loading,
  fileTree,
  onRefresh,
  onFileClick,
}: {
  world: World;
  loading: boolean;
  fileTree: Parameters<typeof FileTree>[0]['nodes'];
  onRefresh: () => void;
  onFileClick: (absolutePath: string) => void;
}): JSX.Element {
  const { t } = useI18n();
  const rootDir = getWorldRootDir(world);

  return (
    <section className="px-2">
      <div className="mb-2 flex items-center">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-default">{getPathBaseName(rootDir)}</div>
          <div className="truncate text-[11px] text-muted">{formatCompactPath(rootDir)}</div>
        </div>
        <Tooltip content={t('fileTree.refresh')} position="bottom">
          <button
            className="shrink-0 rounded p-1 text-muted hover:bg-state-hover hover:text-default"
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw size={14} />
          </button>
        </Tooltip>
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="sm" />
        </div>
      ) : (
        <FileTree nodes={fileTree} onFileClick={onFileClick} />
      )}
    </section>
  );
}

export function Sidebar({ world }: SidebarProps): JSX.Element {
  const { sidebarView, sidebarWidth } = useUIStore();
  const { loadFileTree, fileTree, refreshFileTree, loading: fileLoading } = useFileStore();

  useEffect(() => {
    if (!world) return undefined;
    const dirs = [getWorldRootDir(world)].filter((dir): dir is string => Boolean(dir));
    if (dirs.length === 0) return undefined;

    loadFileTree(dirs);
    fsService.watchDirs(dirs);
    return () => { fsService.unwatchDirs(); };
  }, [loadFileTree, world]);

  // Auto-refresh on filesystem changes
  useEffect(() => {
    if (!world) return undefined;
    const unsubscribe = fsService.onDirChanged(() => {
      refreshFileTree();
    });
    return unsubscribe;
  }, [refreshFileTree, world]);

  const handleRefresh = useCallback(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  const handleFileClick = (absolutePath: string) => {
    if (!world) return;
    void openFileTab({ filePath: absolutePath, rootNetworkId: world.id });
  };

  return (
    <div
      className="sidebar-surface flex h-full shrink-0 flex-col"
      style={{ width: sidebarWidth }}
    >
      {!world || sidebarView === 'worlds' ? (
        <ScrollArea className="flex-1">
          <AppWorkspaceSidebar />
        </ScrollArea>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex min-h-full flex-col py-2">
            {sidebarView === 'models' && <WorldModelTree world={world} />}
            {sidebarView === 'files' && (
              <FolderSection
                world={world}
                loading={fileLoading}
                fileTree={fileTree}
                onRefresh={handleRefresh}
                onFileClick={handleFileClick}
              />
            )}
            {sidebarView === 'sessions' && <AgentSessionPanel rootNetworkId={world.id} />}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
