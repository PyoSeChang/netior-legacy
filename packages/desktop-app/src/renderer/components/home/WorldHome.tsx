import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useWorldStore } from '../../stores/world-store';
import { useModuleStore } from '../../stores/module-store';
import { useNetworkStore } from '../../stores/network-store';
import { useI18n } from '../../hooks/useI18n';
import { WorldCard } from './WorldCard';
import { WorldCreateDialog } from './WorldCreateDialog';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';

export function WorldHome(): JSX.Element {
  const { t } = useI18n();
  const { worlds, loading, loadWorlds, restoreLastWorld, createWorld, openWorld, deleteWorld, missingPathWorld, resolveMissingPath, dismissMissingPath } =
    useWorldStore();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadWorlds().then(() => restoreLastWorld());
  }, [loadWorlds, restoreLastWorld]);

  const handleCreate = async (name: string, rootDir: string) => {
    const world = await createWorld(name, rootDir);
    const { createModule, setActiveModule } = useModuleStore.getState();
    const mod = await createModule({ root_network_id: world.id, name, path: rootDir });
    await setActiveModule(mod.id);
    await handleOpenWorld(world);
  };

  const handleOpenWorld = async (world: Parameters<typeof openWorld>[0]) => {
    await openWorld(world);
    if (useWorldStore.getState().currentWorld?.id !== world.id) return;

    const networkStore = useNetworkStore.getState();
    await Promise.all([
      networkStore.loadNetworks(world.id),
      networkStore.loadNetworkTree(world.id),
    ]);
    await networkStore.openNetwork(world.id);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteWorld(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-default">Netior</h1>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} className="mr-1" />
            {t('world.newWorld')}
          </Button>
        </div>

        {/* World List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : worlds.length === 0 ? (
          <div className="rounded-lg border border-subtle py-12 text-center">
            <p className="text-sm text-muted">{t('world.noWorldsYet')}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowCreate(true)}>
              {t('world.createFirst')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {worlds.map((p) => (
              <WorldCard
                key={p.id}
                world={p}
                onOpen={(world) => { void handleOpenWorld(world); }}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <WorldCreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        variant="danger"
        title={t('world.deleteTitle')}
        message={t('world.deleteMessage')}
      />
      <ConfirmDialog
        open={!!missingPathWorld}
        onClose={dismissMissingPath}
        onConfirm={resolveMissingPath}
        variant="primary"
        title={t('world.missingPathTitle')}
        message={t('world.missingPathMessage', { path: missingPathWorld?.root_dir ?? '' })}
        confirmLabel={t('world.selectNewPath')}
      />
    </div>
  );
}
