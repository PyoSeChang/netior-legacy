import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { Boxes, CircleDot, Layers3, Plus, Waypoints } from 'lucide-react';
import { useInstanceStore } from '../../stores/instance-store';
import { useContextStore } from '../../stores/context-store';
import { useEditorStore } from '../../stores/editor-store';
import { useNetworkStore } from '../../stores/network-store';
import { useWorldStore } from '../../stores/world-store';
import { useMeaningStore } from '../../stores/meaning-store';
import { useSchemaStore } from '../../stores/schema-store';
import { useI18n } from '../../hooks/useI18n';
import { createOntologyDisplayResolver } from '@netior/shared';
import { networkService } from '../../services';
import { Button } from '../ui/Button';
import {
  NetworkObjectBrowser,
  type NetworkBrowserItem,
} from './NetworkObjectBrowser';

interface RootNetworkEditorProps {
  tab: EditorTab;
}

function getNetworkKindLabel(kind: string): string {
  if (kind === 'root') return 'Root Network';
  if (kind === 'universe') return 'Universe';
  return 'Network';
}

type CreatableRootNetworkObjectType = 'network' | 'instance' | 'schema' | 'meaning' | 'context';

const EMPTY_LIST: never[] = [];

export function RootNetworkEditor({ tab }: RootNetworkEditorProps): JSX.Element {
  const { t } = useI18n();
  const display = useMemo(() => createOntologyDisplayResolver(t), [t]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const openEditorTab = useEditorStore((s) => s.openTab);
  const currentWorld = useWorldStore((s) => s.currentWorld);
  const worlds = useWorldStore((s) => s.worlds);
  const loadWorlds = useWorldStore((s) => s.loadWorlds);
  const rawNetworks = useNetworkStore((s) => s.networks);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const loadNetworks = useNetworkStore((s) => s.loadNetworks);
  const loadNetworkTree = useNetworkStore((s) => s.loadNetworkTree);
  const createNetwork = useNetworkStore((s) => s.createNetwork);
  const openNetwork = useNetworkStore((s) => s.openNetwork);
  const rawInstances = useInstanceStore((s) => s.instances);
  const loadInstances = useInstanceStore((s) => s.loadByWorld);
  const rawSchemas = useSchemaStore((s) => s.schemas);
  const loadSchemas = useSchemaStore((s) => s.loadByWorld);
  const createSchema = useSchemaStore((s) => s.createSchema);
  const rawModels = useMeaningStore((s) => s.meanings);
  const loadMeanings = useMeaningStore((s) => s.loadByWorld);
  const createMeaning = useMeaningStore((s) => s.createMeaning);
  const rawContexts = useContextStore((s) => s.contexts);
  const loadContexts = useContextStore((s) => s.loadContexts);
  const createContext = useContextStore((s) => s.createContext);
  const networks = Array.isArray(rawNetworks) ? rawNetworks : EMPTY_LIST;
  const instances = Array.isArray(rawInstances) ? rawInstances : EMPTY_LIST;
  const schemas = Array.isArray(rawSchemas) ? rawSchemas : EMPTY_LIST;
  const meanings = Array.isArray(rawModels) ? rawModels : EMPTY_LIST;
  const contexts = Array.isArray(rawContexts) ? rawContexts : EMPTY_LIST;

  const rootNetworkId = tab.rootNetworkId
    ?? (tab.targetId === 'global' ? currentWorld?.id : tab.targetId)
    ?? currentWorld?.id
    ?? null;
  const world = worlds.find((item) => item.id === rootNetworkId)
    ?? (currentWorld?.id === rootNetworkId ? currentWorld : null);
  const tr = useCallback((key: string, fallback: string) => {
    const value = t(key as never);
    return value === key ? fallback : value;
  }, [t]);

  useEffect(() => {
    void loadWorlds();
  }, [loadWorlds]);

  useEffect(() => {
    if (!rootNetworkId) return;
    void loadNetworks(rootNetworkId);
    void loadNetworkTree(rootNetworkId);
    void loadInstances(rootNetworkId);
    void loadSchemas(rootNetworkId);
    void loadMeanings(rootNetworkId);
  }, [
    loadInstances,
    loadMeanings,
    loadNetworks,
    loadNetworkTree,
    loadSchemas,
    rootNetworkId,
  ]);

  const contextNetworkId = useMemo(() => {
    if (currentNetwork?.root_network_id === rootNetworkId) return currentNetwork.id;
    const worldNetworks = networks.filter((network) => network.root_network_id === rootNetworkId);
    return worldNetworks.find((network) => network.kind === 'root')?.id
      ?? worldNetworks[0]?.id
      ?? null;
  }, [currentNetwork?.id, currentNetwork?.root_network_id, networks, rootNetworkId]);

  useEffect(() => {
    if (!contextNetworkId) return;
    void loadContexts(contextNetworkId);
  }, [contextNetworkId, loadContexts]);

  const ensureContextNetworkId = useCallback(async () => {
    if (contextNetworkId) return contextNetworkId;
    if (!rootNetworkId) return null;

    const rootNetwork = await networkService.getRoot(rootNetworkId);
    if (rootNetwork) {
      await loadNetworks(rootNetworkId);
      await loadNetworkTree(rootNetworkId);
      return rootNetwork.id;
    }

    const created = await createNetwork({
      root_network_id: rootNetworkId,
      name: tr('network.defaultName', 'New Network'),
      kind: 'network',
    });
    await loadNetworks(rootNetworkId);
    await loadNetworkTree(rootNetworkId);
    return created.id;
  }, [contextNetworkId, createNetwork, loadNetworkTree, loadNetworks, rootNetworkId, tr]);

  const handleCreate = useCallback(async (objectType: CreatableRootNetworkObjectType) => {
    if (!rootNetworkId) return;

    switch (objectType) {
      case 'network': {
        const created = await createNetwork({
          root_network_id: rootNetworkId,
          name: tr('network.defaultName', 'New Network'),
          kind: 'network',
        });
        await loadNetworks(rootNetworkId);
        await loadNetworkTree(rootNetworkId);
        await openNetwork(created.id);
        await openEditorTab({
          type: 'network',
          targetId: created.id,
          title: created.name,
          rootNetworkId,
          isDirty: true,
        });
        break;
      }
      case 'instance': {
        const draftId = `draft-${Date.now()}`;
        await openEditorTab({
          type: 'instance',
          targetId: draftId,
          title: tr('instance.defaultTitle', 'New Instance'),
          rootNetworkId,
          draftData: currentNetwork?.root_network_id === rootNetworkId
            ? { networkId: currentNetwork.id }
            : {},
        });
        break;
      }
      case 'schema': {
        const created = await createSchema({
          root_network_id: rootNetworkId,
          name: tr('schema.newDefault', 'New Schema'),
        });
        await openEditorTab({
          type: 'schema',
          targetId: created.id,
          title: created.name,
          rootNetworkId,
          isDirty: true,
        });
        break;
      }
      case 'meaning': {
        const created = await createMeaning({
          root_network_id: rootNetworkId,
          name: tr('meaning.newDefault', 'New Meaning'),
        });
        await openEditorTab({
          type: 'meaning',
          targetId: created.id,
          title: display.meaningName(created),
          rootNetworkId,
          isDirty: true,
        });
        break;
      }
      case 'context': {
        const networkId = await ensureContextNetworkId();
        if (!networkId) return;
        const created = await createContext({
          network_id: networkId,
          name: tr('context.newDefault', 'New Context'),
        });
        await loadContexts(networkId);
        await openEditorTab({
          type: 'context',
          targetId: created.id,
          title: created.name,
          rootNetworkId,
          networkId,
          isDirty: true,
        });
        break;
      }
      default:
        break;
    }
  }, [
    createContext,
    createMeaning,
    createSchema,
    createNetwork,
    currentNetwork?.id,
    currentNetwork?.root_network_id,
    display,
    ensureContextNetworkId,
    loadContexts,
    loadNetworkTree,
    loadNetworks,
    openEditorTab,
    openNetwork,
    rootNetworkId,
    t,
    tr,
  ]);

  const createActions = useMemo<Array<{
    key: CreatableRootNetworkObjectType;
    label: string;
    icon: React.ElementType;
  }>>(() => [
    { key: 'network', label: t('sidebar.networks'), icon: Waypoints },
    { key: 'instance', label: t('objectPanel.instance' as never), icon: CircleDot },
    { key: 'schema', label: t('schema.title'), icon: Boxes },
    { key: 'meaning', label: t('meaning.title' as never), icon: Boxes },
    { key: 'context', label: t('context.title'), icon: Layers3 },
  ], [t]);

  const browserSections = useMemo(() => {
    const sections: Array<{
      key: NetworkBrowserItem['objectType'];
      label: string;
      items: NetworkBrowserItem[];
    }> = [
      {
        key: 'network' as const,
        label: t('sidebar.networks'),
        items: [...networks]
          .filter((item) => !rootNetworkId || item.root_network_id === rootNetworkId)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'network' as const,
            title: item.name,
            subtitle: getNetworkKindLabel(item.kind),
            isActive: item.id === currentNetwork?.id,
            networkKind: item.kind,
          })),
      },
      {
        key: 'instance' as const,
        label: t('objectPanel.instance' as never),
        items: [...instances]
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((item) => ({
            id: item.id,
            objectType: 'instance' as const,
            title: item.title,
            subtitle: item.schema_id
              ? (() => {
                const schema = schemas.find((candidate) => candidate.id === item.schema_id);
                return schema ? schema.name : t('objectPanel.instance' as never);
              })()
              : t('objectPanel.instance' as never),
          })),
      },
      {
        key: 'schema' as const,
        label: t('schema.title'),
        items: [...schemas]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'schema' as const,
            title: item.name,
            subtitle: item.description ?? t('schema.title'),
          })),
      },
      {
        key: 'meaning' as const,
        label: t('meaning.title' as never),
        items: [...meanings]
          .sort((a, b) => display.meaningName(a).localeCompare(display.meaningName(b)))
          .map((item) => ({
            id: item.id,
            objectType: 'meaning' as const,
            title: display.meaningName(item),
            subtitle: display.meaningDescription(item) ?? t('meaning.title' as never),
          })),
      },
      {
        key: 'context' as const,
        label: t('context.title'),
        items: [...contexts]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'context' as const,
            title: item.name,
            subtitle: item.description ?? t('context.title'),
          })),
      },
    ];

    return sections;
  }, [
    instances,
    contexts,
    currentNetwork?.id,
    currentWorld?.id,
    meanings,
    networks,
    rootNetworkId,
    worlds,
    schemas,
    display,
    t,
  ]);

  const openItem = useCallback(async (item: NetworkBrowserItem) => {
    setSelectedKey(`${item.objectType}:${item.id}`);
    switch (item.objectType) {
      case 'network': {
        const network = networks.find((candidate) => candidate.id === item.id);
        await openEditorTab({
          type: 'network',
          targetId: item.id,
          title: item.title,
          rootNetworkId: network?.root_network_id ?? rootNetworkId ?? undefined,
        });
        break;
      }
      case 'world':
        await openEditorTab({ type: 'world', targetId: item.id, title: item.title });
        break;
      case 'instance':
        await openEditorTab({ type: 'instance', targetId: item.id, title: item.title });
        break;
      case 'schema':
        await openEditorTab({ type: 'schema', targetId: item.id, title: item.title, rootNetworkId: rootNetworkId ?? undefined });
        break;
      case 'meaning':
        await openEditorTab({ type: 'meaning', targetId: item.id, title: item.title, rootNetworkId: rootNetworkId ?? undefined });
        break;
      case 'context':
        await openEditorTab({ type: 'context', targetId: item.id, title: item.title });
        break;
      default:
        break;
    }
  }, [networks, openEditorTab, rootNetworkId]);

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden bg-surface-editor text-default">
      <NetworkObjectBrowser
        title={world ? `${world.name} Root Network` : 'Root Network'}
        searchPlaceholder={t('sidebar.search')}
        sections={browserSections}
        selectedKey={selectedKey}
        showHeader={false}
        toolbar={createActions.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            size="sm"
            variant="secondary"
            disabled={!rootNetworkId}
            onClick={() => {
              void handleCreate(key);
            }}
          >
            <Plus size={13} />
            <Icon size={13} />
            {label}
          </Button>
        ))}
        onSelect={(item) => setSelectedKey(`${item.objectType}:${item.id}`)}
        onOpen={(item) => {
          void openItem(item);
        }}
      />
    </div>
  );
}
