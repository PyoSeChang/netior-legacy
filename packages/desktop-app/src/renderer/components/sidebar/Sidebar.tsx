import React, { useEffect, useCallback, useState } from 'react';
import { ExternalLink, Orbit, Plus, RefreshCw } from 'lucide-react';
import type { World } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useFileStore } from '../../stores/file-store';
import { useModuleStore } from '../../stores/module-store';
import { useUIStore } from '../../stores/ui-store';
import { useWorldStore } from '../../stores/world-store';
import { NetworkList } from './NetworkList';
import { FileTree } from './FileTree';
import { ModuleSelector } from './ModuleSelector';
import { ObjectPanel } from './ObjectPanel';
import { BookmarkedNetworkSidebar } from './BookmarkedNetworkSidebar';
import { useInstanceStore } from '../../stores/instance-store';
import { useMeaningStore } from '../../stores/meaning-store';
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

interface SidebarProps {
  world: World | null;
}

const OBJECT_PANEL_TYPES = {
  instances: ['instance'],
  meanings: ['meaning'],
  contexts: ['context'],
} as const;

function AppWorkspaceSidebar(): JSX.Element {
  const { t } = useI18n();
  const worlds = useWorldStore((s) => s.worlds);
  const createWorld = useWorldStore((s) => s.createWorld);
  const openWorld = useWorldStore((s) => s.openWorld);
  const currentWorld = useWorldStore((s) => s.currentWorld);
  const createModule = useModuleStore((s) => s.createModule);
  const [showCreateWorld, setShowCreateWorld] = useState(false);
  const [worldContextMenu, setWorldContextMenu] = useState<{
    x: number;
    y: number;
    world: World;
  } | null>(null);

  const handleCreateWorld = async (name: string, rootDir: string) => {
    const world = await createWorld(name, rootDir);
    await createModule({ root_network_id: world.id, name, path: rootDir });
    await handleOpenWorld(world);
  };

  const handleOpenWorld = async (world: World) => {
    await openWorld(world);
    if (useWorldStore.getState().currentWorld?.id !== world.id) return;

    const networkStore = useNetworkStore.getState();
    await Promise.all([
      networkStore.loadNetworks(world.id),
      networkStore.loadNetworkTree(world.id),
    ]);
    await networkStore.openNetwork(world.id);
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
                <Tooltip content={world.root_dir} position="bottom" className="min-w-0 flex-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{world.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {formatCompactPath(world.root_dir)}
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

export function Sidebar({ world }: SidebarProps): JSX.Element {
  const { t } = useI18n();
  const { sidebarView, sidebarWidth, bookmarkedSidebarNetworkId } = useUIStore();
  const { loadFileTree, fileTree, refreshFileTree, loading: fileLoading } = useFileStore();
  const { loadNetworks, loadNetworkTree } = useNetworkStore();
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const { loadModules, directories } = useModuleStore();
  const { loadByWorld: loadInstances } = useInstanceStore();
  const { loadByWorld: loadMeanings } = useMeaningStore();

  const moduleOwnerNetworkId = world && currentNetwork?.root_network_id === world.id
    ? currentNetwork.id
    : world?.id ?? null;

  useEffect(() => {
    if (!world) return;
    loadNetworks(world.id);
    loadNetworkTree(world.id);
    if (moduleOwnerNetworkId) {
      loadModules(moduleOwnerNetworkId);
    }
    loadInstances(world.id);
    loadMeanings(world.id);
  }, [moduleOwnerNetworkId, world?.id, loadNetworks, loadNetworkTree, loadModules, loadInstances, loadMeanings]);

  useEffect(() => {
    if (!world) return undefined;
    const dirs = (directories.length > 0 ? directories.map((d) => d.dir_path) : [world.root_dir])
      .filter((dir): dir is string => Boolean(dir));
    if (dirs.length === 0) return undefined;

    loadFileTree(dirs);
    fsService.watchDirs(dirs);
    return () => { fsService.unwatchDirs(); };
  }, [directories, loadFileTree, world]);

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
      ) : sidebarView === 'bookmarkedNetwork' && bookmarkedSidebarNetworkId ? (
        <BookmarkedNetworkSidebar networkId={bookmarkedSidebarNetworkId} />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex min-h-full flex-col py-2">
            {sidebarView === 'rootNetwork' && (
              <NetworkList
                rootNetworkId={world.id}
                kindFilter="root"
                title={t('sidebar.rootNetwork' as never)}
                canCreate={false}
              />
            )}
            {sidebarView === 'networks' && <NetworkList rootNetworkId={world.id} kindFilter={['root', 'network']} />}
            {sidebarView === 'files' && (
              <>
                <div className="flex items-center">
                  <div className="flex-1">
                    <ModuleSelector networkId={moduleOwnerNetworkId ?? world.id} worldRootDir={world.root_dir} />
                  </div>
                  <Tooltip content={t('fileTree.refresh')} position="bottom">
                    <button
                      className="mr-2 shrink-0 rounded p-1 text-muted hover:bg-state-hover hover:text-default"
                      onClick={handleRefresh}
                    >
                      <RefreshCw size={14} />
                    </button>
                  </Tooltip>
                </div>
                {fileLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="sm" />
                  </div>
                ) : (
                  <FileTree nodes={fileTree} onFileClick={handleFileClick} />
                )}
              </>
            )}
            {sidebarView === 'instances' && <ObjectPanel types={[...OBJECT_PANEL_TYPES.instances]} />}
            {sidebarView === 'meanings' && <ObjectPanel types={[...OBJECT_PANEL_TYPES.meanings]} />}
            {sidebarView === 'contexts' && <ObjectPanel types={[...OBJECT_PANEL_TYPES.contexts]} />}
            {sidebarView === 'objects' && <ObjectPanel />}
            {sidebarView === 'sessions' && <AgentSessionPanel rootNetworkId={world.id} />}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
