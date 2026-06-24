import React, { useCallback } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useWorldStore } from '../../stores/world-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';

interface WorldEditorProps {
  tab: EditorTab;
}

interface WorldState {
  name: string;
}

export function WorldEditor({ tab }: WorldEditorProps): JSX.Element {
  const { t } = useI18n();
  const rootNetworkId = tab.targetId;
  const worlds = useWorldStore((s) => s.worlds);
  const currentWorld = useWorldStore((s) => s.currentWorld);
  const updateWorld = useWorldStore((s) => s.updateWorld);
  const openWorld = useWorldStore((s) => s.openWorld);
  const deleteWorld = useWorldStore((s) => s.deleteWorld);
  const world = worlds.find((item) => item.id === rootNetworkId) ?? null;

  const session = useEditorSession<WorldState>({
    tabId: tab.id,
    load: () => {
      const current = useWorldStore.getState().worlds.find((item) => item.id === rootNetworkId);
      return { name: current?.name ?? '' };
    },
    save: async (state) => {
      const updated = await updateWorld(rootNetworkId, { name: state.name });
      useEditorStore.getState().updateTitle(tab.id, updated.name);
    },
    deps: [rootNetworkId, world?.name],
  });

  const handleOpenWorkspace = useCallback(async () => {
    const target = useWorldStore.getState().worlds.find((item) => item.id === rootNetworkId);
    if (!target) return;
    await openWorld(target);
  }, [openWorld, rootNetworkId]);

  const handleDelete = useCallback(async () => {
    await deleteWorld(rootNetworkId);
    useEditorStore.getState().closeTab(tab.id);
  }, [deleteWorld, rootNetworkId, tab.id]);

  if (!world) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('world.noWorld')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <div className="h-full overflow-y-auto">
      <NetworkObjectEditorShell
        badge={t('world.name')}
        title={session.state.name || world.name}
        subtitle={currentWorld?.id === world.id ? 'Current World' : 'World'}
        description={world.root_dir}
        actions={(
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => { void handleOpenWorkspace(); }}>
              {t('common.open')}
            </Button>
          </div>
        )}
      >
        <NetworkObjectEditorSection title={t('editorShell.overview' as never)} defaultOpen={tab.isDirty} viewMode="body">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('world.name')}</label>
            <Input
              value={session.state.name}
              onChange={(event) => {
                session.setState((prev) => ({ ...prev, name: event.target.value }));
              }}
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('world.folder')} defaultOpen={false} viewMode="details">
          <NetworkObjectMetadataList
            items={[
              { label: t('world.folder'), value: world.root_dir },
            ]}
          />
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false} viewMode="details">
          <NetworkObjectMetadataList
            items={[
              { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{world.id}</code> },
              { label: 'Updated', value: world.updated_at },
            ]}
          />
        </NetworkObjectEditorSection>

        <div className="mx-auto flex w-full max-w-[760px] justify-end px-6 pt-1" data-network-object-view-mode="details">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="bg-status-error/10 text-status-error hover:bg-status-error/15 hover:text-status-error"
            onClick={() => { void handleDelete(); }}
          >
            {t('common.delete')}
          </Button>
        </div>
      </NetworkObjectEditorShell>
    </div>
  );
}
