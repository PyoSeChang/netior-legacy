import React, { useEffect, useMemo, useState } from 'react';
import type { NetworkObjectType } from '@netior/shared/types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useInstanceStore } from '../../stores/instance-store';
import { useNetworkStore } from '../../stores/network-store';
import { useModelStore } from '../../stores/model-store';
import { useSchemaStore } from '../../stores/schema-store';
import { useContextStore } from '../../stores/context-store';
import { useProjectStore } from '../../stores/project-store';
import { useI18n } from '../../hooks/useI18n';
import { createOntologyDisplayResolver } from '@netior/shared';
import { NodeVisual } from './node-components/NodeVisual';

interface ObjectPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (objectType: NetworkObjectType, refId: string) => void;
  initialTab?: PickerTab;
  allowedTabs?: PickerTab[];
}

type PickerTab = 'instance' | 'network' | 'project' | 'schema' | 'model' | 'context';

const TABS: PickerTab[] = ['instance', 'network', 'project', 'schema', 'model', 'context'];

export function ObjectPickerModal({
  open,
  onClose,
  onSelect,
  initialTab = 'instance',
  allowedTabs,
}: ObjectPickerModalProps): JSX.Element {
  const { t } = useI18n();
  const display = useMemo(() => createOntologyDisplayResolver(t), [t]);
  const [activeTab, setActiveTab] = useState<PickerTab>(initialTab);
  const [search, setSearch] = useState('');
  const tabs = useMemo<PickerTab[]>(
    () => (allowedTabs && allowedTabs.length > 0 ? [...allowedTabs] : TABS),
    [allowedTabs],
  );
  const tabsKey = tabs.join('|');

  const instances = useInstanceStore((s) => s.instances);
  const networks = useNetworkStore((s) => s.networks);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const projects = useProjectStore((s) => s.projects);
  const schemas = useSchemaStore((s) => s.schemas);
  const models = useModelStore((s) => s.models);
  const contexts = useContextStore((s) => s.contexts);

  const tabLabels: Record<PickerTab, string> = {
    instance: t('instance.title'),
    network: t('sidebar.networks' as never),
    project: t('project.title' as never) ?? 'Projects',
    schema: t('schema.title' as never),
    model: t('model.title' as never),
    context: t('context.title'),
  };

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setActiveTab(tabs.includes(initialTab) ? initialTab : tabs[0] ?? 'instance');
  }, [initialTab, open, tabsKey]);

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (value: string) => value.toLowerCase().includes(query);

    switch (activeTab) {
      case 'instance':
        return instances
          .filter((instance) => !query || matches(instance.title))
          .map((instance) => ({ id: instance.id, title: instance.title, subtitle: t('instance.model'), icon: instance.icon }));
      case 'network':
        return networks
          .filter((network) => network.id !== currentNetwork?.id)
          .filter((network) => !query || matches(network.name))
          .map((network) => ({ id: network.id, title: network.name, subtitle: t('sidebar.networks' as never), icon: null }));
      case 'project':
        return projects
          .filter((project) => !query || matches(project.name))
          .map((project) => ({ id: project.id, title: project.name, subtitle: t('project.title' as never) ?? 'Project', icon: null }));
      case 'schema':
        return schemas
          .filter((schema) => !query || matches(schema.name) || (schema.description ? matches(schema.description) : false))
          .map((schema) => ({
            id: schema.id,
            title: schema.name,
            subtitle: schema.description ?? t('schema.title' as never),
            icon: schema.icon,
          }));
      case 'model':
        return models
          .filter((model) => {
            const title = display.modelName(model);
            const description = display.modelDescription(model);
            return !query || matches(title) || matches(model.key) || (description ? matches(description) : false);
          })
          .map((model) => ({
            id: model.id,
            title: display.modelName(model),
            subtitle: display.modelDescription(model) ?? t('model.title' as never),
            icon: model.icon,
          }));
      case 'context':
        return contexts
          .filter((context) => !query || matches(context.name))
          .map((context) => ({ id: context.id, title: context.name, subtitle: t('context.title'), icon: null }));
      default:
        return [];
    }
  }, [activeTab, display, instances, contexts, currentNetwork?.id, models, networks, projects, schemas, search, t]);

  const handleSelect = (refId: string) => {
    onSelect(activeTab, refId);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('common.add')} width="520px">
      <div className="flex min-h-[360px] flex-col gap-3">
        <div className="flex flex-wrap gap-1 border-b border-subtle pb-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded px-2 py-1 text-xs transition-colors ${
                activeTab === tab
                  ? 'bg-state-selected text-accent'
                  : 'text-secondary hover:bg-state-hover hover:text-default'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <Input
          inputSize="sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('network.searchPlaceholder')}
          autoFocus
        />

        <div className="flex-1 overflow-auto rounded border border-subtle bg-surface-card">
          {items.length > 0 ? (
            <div className="flex flex-col py-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-state-hover"
                  onClick={() => handleSelect(item.id)}
                >
                  {item.icon && <NodeVisual icon={item.icon} size={14} imageSize={20} className="mt-0.5 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-default">{item.title}</span>
                    <span className="block truncate text-[11px] text-muted">{item.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-xs text-muted">
              {t('common.noResults')}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
