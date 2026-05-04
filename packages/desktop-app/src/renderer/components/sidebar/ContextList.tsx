import React, { useEffect, useMemo } from 'react';
import { Plus, Layers3, Eye, EyeOff } from 'lucide-react';
import { useContextStore } from '../../stores/context-store';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { Spinner } from '../ui/Spinner';

export function ContextList(): JSX.Element {
  const { t } = useI18n();
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const loading = useContextStore((s) => s.loading);
  const contexts = useContextStore((s) => s.contexts);
  const activeContextId = useContextStore((s) => s.activeContextId);
  const loadContexts = useContextStore((s) => s.loadContexts);
  const createContext = useContextStore((s) => s.createContext);
  const setActiveContext = useContextStore((s) => s.setActiveContext);

  useEffect(() => {
    if (!currentNetwork) return;
    loadContexts(currentNetwork.id);
  }, [currentNetwork?.id, loadContexts]);

  const sortedContexts = useMemo(
    () => [...contexts].sort((a, b) => a.name.localeCompare(b.name)),
    [contexts],
  );

  const handleCreate = async () => {
    if (!currentNetwork) return;
    const context = await createContext({
      network_id: currentNetwork.id,
      name: t('context.newDefault'),
    });
    useEditorStore.getState().openTab({
      type: 'context',
      targetId: context.id,
      title: context.name,
      isDirty: true,
    });
  };

  const handleOpen = (contextId: string, name: string) => {
    useEditorStore.getState().openTab({
      type: 'context',
      targetId: contextId,
      title: name,
    });
  };

  if (!currentNetwork) {
    return (
      <div className="flex flex-col gap-1 px-3 py-4 text-xs text-muted">
        <span>{t('network.noNetworkSelected')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-secondary">{t('context.title')}</span>
        <button
          className="rounded p-0.5 text-muted hover:bg-state-hover hover:text-default"
          onClick={handleCreate}
          title={t('common.create')}
          type="button"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="px-2 pb-1">
        <div className="rounded border border-subtle bg-surface-card px-2 py-1.5 text-[11px] text-muted">
          {currentNetwork.name}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : sortedContexts.length > 0 ? (
        sortedContexts.map((context) => (
          <div
            key={context.id}
            className="group flex items-center gap-2 rounded px-2 py-1 text-xs text-secondary transition-colors hover:bg-state-hover hover:text-default"
          >
            <button
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => handleOpen(context.id, context.name)}
              type="button"
            >
              <Layers3 size={12} className="shrink-0 opacity-70" />
              <span className="truncate">{context.name}</span>
            </button>
            <button
              type="button"
              className={`rounded p-0.5 transition-colors ${
                activeContextId === context.id
                  ? 'text-accent'
                  : 'text-muted opacity-0 group-hover:opacity-100 hover:text-default'
              }`}
              onClick={() => setActiveContext(activeContextId === context.id ? null : context.id)}
              title={activeContextId === context.id ? 'Deactivate context' : 'Activate context'}
            >
              {activeContextId === context.id ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          </div>
        ))
      ) : (
        <div className="px-3 py-4 text-xs text-muted text-center">
          {t('context.noContexts')}
        </div>
      )}
    </div>
  );
}
