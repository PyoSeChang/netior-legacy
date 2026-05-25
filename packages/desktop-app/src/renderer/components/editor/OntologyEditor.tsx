import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { Boxes, CircleDot, Layers3, Plus, Waypoints } from 'lucide-react';
import { useInstanceStore } from '../../stores/instance-store';
import { useContextStore } from '../../stores/context-store';
import { useEditorStore } from '../../stores/editor-store';
import { useNetworkStore } from '../../stores/network-store';
import { useProjectStore } from '../../stores/project-store';
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

interface OntologyEditorProps {
  tab: EditorTab;
}

function getNetworkKindLabel(kind: string): string {
  if (kind === 'ontology') return 'Ontology';
  if (kind === 'universe') return 'Universe';
  return 'Network';
}

type CreatableOntologyType = 'network' | 'instance' | 'schema' | 'meaning' | 'context';

const EMPTY_LIST: never[] = [];

export function OntologyEditor({ tab }: OntologyEditorProps): JSX.Element {
  const { t } = useI18n();
  const display = useMemo(() => createOntologyDisplayResolver(t), [t]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const openEditorTab = useEditorStore((s) => s.openTab);
  const currentProject = useProjectStore((s) => s.currentProject);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const rawNetworks = useNetworkStore((s) => s.networks);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const loadNetworks = useNetworkStore((s) => s.loadNetworks);
  const loadNetworkTree = useNetworkStore((s) => s.loadNetworkTree);
  const createNetwork = useNetworkStore((s) => s.createNetwork);
  const openNetwork = useNetworkStore((s) => s.openNetwork);
  const rawInstances = useInstanceStore((s) => s.instances);
  const loadInstances = useInstanceStore((s) => s.loadByProject);
  const rawSchemas = useSchemaStore((s) => s.schemas);
  const loadSchemas = useSchemaStore((s) => s.loadByProject);
  const createSchema = useSchemaStore((s) => s.createSchema);
  const rawModels = useMeaningStore((s) => s.meanings);
  const loadMeanings = useMeaningStore((s) => s.loadByProject);
  const createMeaning = useMeaningStore((s) => s.createMeaning);
  const rawContexts = useContextStore((s) => s.contexts);
  const loadContexts = useContextStore((s) => s.loadContexts);
  const createContext = useContextStore((s) => s.createContext);
  const networks = Array.isArray(rawNetworks) ? rawNetworks : EMPTY_LIST;
  const instances = Array.isArray(rawInstances) ? rawInstances : EMPTY_LIST;
  const schemas = Array.isArray(rawSchemas) ? rawSchemas : EMPTY_LIST;
  const meanings = Array.isArray(rawModels) ? rawModels : EMPTY_LIST;
  const contexts = Array.isArray(rawContexts) ? rawContexts : EMPTY_LIST;

  const projectId = tab.projectId
    ?? (tab.targetId === 'global' ? currentProject?.id : tab.targetId)
    ?? currentProject?.id
    ?? null;
  const project = projects.find((item) => item.id === projectId)
    ?? (currentProject?.id === projectId ? currentProject : null);
  const tr = useCallback((key: string, fallback: string) => {
    const value = t(key as never);
    return value === key ? fallback : value;
  }, [t]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!projectId) return;
    void loadNetworks(projectId);
    void loadNetworkTree(projectId);
    void loadInstances(projectId);
    void loadSchemas(projectId);
    void loadMeanings(projectId);
  }, [
    loadInstances,
    loadMeanings,
    loadNetworks,
    loadNetworkTree,
    loadSchemas,
    projectId,
  ]);

  const contextNetworkId = useMemo(() => {
    if (currentNetwork?.project_id === projectId) return currentNetwork.id;
    const projectNetworks = networks.filter((network) => network.project_id === projectId);
    return projectNetworks.find((network) => network.kind === 'ontology')?.id
      ?? projectNetworks[0]?.id
      ?? null;
  }, [currentNetwork?.id, currentNetwork?.project_id, networks, projectId]);

  useEffect(() => {
    if (!contextNetworkId) return;
    void loadContexts(contextNetworkId);
  }, [contextNetworkId, loadContexts]);

  const ensureContextNetworkId = useCallback(async () => {
    if (contextNetworkId) return contextNetworkId;
    if (!projectId) return null;

    const ontology = await networkService.getProjectOntology(projectId);
    if (ontology) {
      await loadNetworks(projectId);
      await loadNetworkTree(projectId);
      return ontology.id;
    }

    const created = await createNetwork({
      project_id: projectId,
      name: tr('network.defaultName', 'New Network'),
      kind: 'network',
    });
    await loadNetworks(projectId);
    await loadNetworkTree(projectId);
    return created.id;
  }, [contextNetworkId, createNetwork, loadNetworkTree, loadNetworks, projectId, tr]);

  const handleCreate = useCallback(async (objectType: CreatableOntologyType) => {
    if (!projectId) return;

    switch (objectType) {
      case 'network': {
        const created = await createNetwork({
          project_id: projectId,
          name: tr('network.defaultName', 'New Network'),
          kind: 'network',
        });
        await loadNetworks(projectId);
        await loadNetworkTree(projectId);
        await openNetwork(created.id);
        await openEditorTab({
          type: 'network',
          targetId: created.id,
          title: created.name,
          projectId,
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
          projectId,
          draftData: currentNetwork?.project_id === projectId
            ? { networkId: currentNetwork.id }
            : {},
        });
        break;
      }
      case 'schema': {
        const created = await createSchema({
          project_id: projectId,
          name: tr('schema.newDefault', 'New Schema'),
        });
        await openEditorTab({
          type: 'schema',
          targetId: created.id,
          title: created.name,
          projectId,
          isDirty: true,
        });
        break;
      }
      case 'meaning': {
        const created = await createMeaning({
          project_id: projectId,
          name: tr('meaning.newDefault', 'New Meaning'),
        });
        await openEditorTab({
          type: 'meaning',
          targetId: created.id,
          title: display.meaningName(created),
          projectId,
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
          projectId,
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
    currentNetwork?.project_id,
    display,
    ensureContextNetworkId,
    loadContexts,
    loadNetworkTree,
    loadNetworks,
    openEditorTab,
    openNetwork,
    projectId,
    t,
    tr,
  ]);

  const createActions = useMemo<Array<{
    key: CreatableOntologyType;
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
          .filter((item) => !projectId || item.project_id === projectId)
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
    currentProject?.id,
    meanings,
    networks,
    projectId,
    projects,
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
          projectId: network?.project_id ?? projectId ?? undefined,
        });
        break;
      }
      case 'project':
        await openEditorTab({ type: 'project', targetId: item.id, title: item.title });
        break;
      case 'instance':
        await openEditorTab({ type: 'instance', targetId: item.id, title: item.title });
        break;
      case 'schema':
        await openEditorTab({ type: 'schema', targetId: item.id, title: item.title, projectId: projectId ?? undefined });
        break;
      case 'meaning':
        await openEditorTab({ type: 'meaning', targetId: item.id, title: item.title, projectId: projectId ?? undefined });
        break;
      case 'context':
        await openEditorTab({ type: 'context', targetId: item.id, title: item.title });
        break;
      default:
        break;
    }
  }, [networks, openEditorTab, projectId]);

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden bg-surface-editor text-default">
      <NetworkObjectBrowser
        title={project ? `${project.name} Ontology` : 'Ontology'}
        searchPlaceholder={t('sidebar.search')}
        sections={browserSections}
        selectedKey={selectedKey}
        showHeader={false}
        toolbar={createActions.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            size="sm"
            variant="secondary"
            disabled={!projectId}
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
