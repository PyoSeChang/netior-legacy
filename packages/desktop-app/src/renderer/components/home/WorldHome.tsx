import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useWorldStore } from '../../stores/world-store';
import { useI18n } from '../../hooks/useI18n';
import { WorldCard } from './WorldCard';
import { WorldCreateDialog } from './WorldCreateDialog';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { AppChromeMark } from '../ui/NetiorTitleMark';

interface WorldHomeProps {
  windowControls?: React.ReactNode;
}

export function WorldHome({ windowControls = null }: WorldHomeProps): JSX.Element {
  const { t } = useI18n();
  const { worlds, loading, createWorld, openWorld, deleteWorld } = useWorldStore();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleCreate = async (name: string, rootDir: string) => {
    const world = await createWorld(name, rootDir);
    await handleOpenWorld(world);
  };

  const handleOpenWorld = async (world: Parameters<typeof openWorld>[0]) => {
    await openWorld(world);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteWorld(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-base">
      <div
        className="flex h-10 shrink-0 items-center justify-between border-b border-subtle pl-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex min-w-0 items-center gap-2 text-secondary">
          <AppChromeMark />
          <span className="truncate text-xs font-medium text-default">Netior</span>
        </div>
        {windowControls}
      </div>

      <main className="flex min-h-0 flex-1 justify-center overflow-auto px-6 py-8">
        <div className="w-full max-w-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-base font-semibold text-default">{t('world.title' as never) ?? 'Worlds'}</h1>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-1" />
              {t('world.newWorld')}
            </Button>
          </div>

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
      </main>

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
    </div>
  );
}
