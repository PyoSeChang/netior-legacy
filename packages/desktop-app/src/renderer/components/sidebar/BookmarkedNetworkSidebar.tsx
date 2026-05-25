import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Context, NetworkObjectType } from '@netior/shared/types';
import { contextService, networkService } from '../../services';
import type { NetworkFullData } from '../../services/network-service';
import { useMeaningStore } from '../../stores/meaning-store';
import { useContextStore } from '../../stores/context-store';
import { useEditorStore } from '../../stores/editor-store';
import { useNetworkStore } from '../../stores/network-store';
import { useProjectStore } from '../../stores/project-store';
import { useI18n } from '../../hooks/useI18n';
import { openFileTab } from '../../lib/open-file-tab';
import { createOntologyDisplayResolver } from '@netior/shared';
import {
  NetworkObjectBrowser,
  type NetworkBrowserItem,
  type NetworkBrowserObjectType,
} from '../editor/NetworkObjectBrowser';
import { Spinner } from '../ui/Spinner';

interface BookmarkedNetworkSidebarProps {
  networkId: string;
}

type SupportedSidebarObjectType = Extract<
  NetworkObjectType,
  'project' | 'network' | 'instance' | 'meaning' | 'context' | 'file'
>;

interface BookmarkedSidebarItem extends NetworkBrowserItem {
  objectType: SupportedSidebarObjectType;
  filePath?: string;
}

const SECTION_ORDER: SupportedSidebarObjectType[] = [
  'project',
  'network',
  'instance',
  'file',
  'meaning',
  'context',
];

function isSupportedSidebarObjectType(type: NetworkObjectType): type is SupportedSidebarObjectType {
  return (
    type === 'project'
    || type === 'network'
    || type === 'instance'
    || type === 'meaning'
    || type === 'context'
    || type === 'file'
  );
}

function getNetworkKindLabel(kind: string): string {
  if (kind === 'ontology') return 'Ontology';
  if (kind === 'universe') return 'Universe';
  return 'Network';
}

function getFileTitle(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

export function BookmarkedNetworkSidebar({ networkId }: BookmarkedNetworkSidebarProps): JSX.Element {
  const { t } = useI18n();
  const display = useMemo(() => createOntologyDisplayResolver(t), [t]);
  const [fullData, setFullData] = useState<NetworkFullData | null>(null);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const openNetwork = useNetworkStore((state) => state.openNetwork);
  const networks = useNetworkStore((state) => state.networks);
  const projects = useProjectStore((state) => state.projects);
  const meanings = useMeaningStore((state) => state.meanings);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextFullData, nextContexts] = await Promise.all([
          networkService.getFull(networkId),
          contextService.list(networkId),
        ]);
        if (cancelled) {
          return;
        }
        setFullData(nextFullData ?? null);
        setContexts(nextContexts);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('[BookmarkedNetworkSidebar] Failed to load network data', error);
        setFullData(null);
        setContexts([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [networkId]);

  const networksById = useMemo(
    () => new Map(networks.map((network) => [network.id, network])),
    [networks],
  );
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const meaningsById = useMemo(
    () => new Map(meanings.map((meaning) => [meaning.id, meaning])),
    [meanings],
  );
  const contextsById = useMemo(
    () => new Map(contexts.map((context) => [context.id, context])),
    [contexts],
  );

  const sectionLabels = useMemo<Record<SupportedSidebarObjectType, string>>(
    () => ({
      project: t('project.title' as never) ?? 'Projects',
      network: t('sidebar.networks'),
      instance: t('objectPanel.instance' as never),
      file: t('sidebar.files'),
      meaning: t('meaning.title' as never),
      context: t('context.title'),
    }),
    [t],
  );

  const items = useMemo<BookmarkedSidebarItem[]>(() => {
    if (!fullData) {
      return [];
    }

    const seen = new Set<string>();
    const nextItems: BookmarkedSidebarItem[] = [];

    for (const node of fullData.nodes) {
      const object = node.object;
      if (!object || !isSupportedSidebarObjectType(object.object_type)) {
        continue;
      }

      const itemKey = `${object.object_type}:${object.ref_id}`;
      if (seen.has(itemKey)) {
        continue;
      }
      seen.add(itemKey);

      switch (object.object_type) {
        case 'project': {
          const project = projectsById.get(object.ref_id);
          nextItems.push({
            id: object.ref_id,
            objectType: 'project',
            title: project?.name ?? object.ref_id,
            subtitle: project?.root_dir ?? (t('project.title' as never) ?? 'Project'),
          });
          break;
        }
        case 'network': {
          const network = networksById.get(object.ref_id);
          nextItems.push({
            id: object.ref_id,
            objectType: 'network',
            title: network?.name ?? object.ref_id,
            subtitle: getNetworkKindLabel(network?.kind ?? 'network'),
            networkKind: network?.kind ?? 'network',
          });
          break;
        }
        case 'instance': {
          const instance = node.instance;
          const meaningName = instance?.schema_id
            ? (() => {
              const meaning = meaningsById.get(instance.schema_id);
              return meaning ? display.meaningName(meaning) : null;
            })()
            : null;
          nextItems.push({
            id: object.ref_id,
            objectType: 'instance',
            title: instance?.title ?? object.ref_id,
            subtitle: meaningName ?? t('objectPanel.instance' as never),
          });
          break;
        }
        case 'file': {
          const filePath = node.file?.path ?? object.ref_id;
          nextItems.push({
            id: object.ref_id,
            objectType: 'file',
            title: getFileTitle(filePath),
            subtitle: filePath,
            filePath,
          });
          break;
        }
        case 'meaning': {
          const meaning = meaningsById.get(object.ref_id);
          nextItems.push({
            id: object.ref_id,
            objectType: 'meaning',
            title: meaning ? display.meaningName(meaning) : object.ref_id,
            subtitle: meaning ? display.meaningDescription(meaning) ?? t('meaning.title' as never) : t('meaning.title' as never),
          });
          break;
        }
        case 'context': {
          const context = contextsById.get(object.ref_id);
          nextItems.push({
            id: object.ref_id,
            objectType: 'context',
            title: context?.name ?? object.ref_id,
            subtitle: context?.description ?? fullData.network.name,
          });
          break;
        }
      }
    }

    return nextItems;
  }, [
    display,
    meaningsById,
    contextsById,
    fullData,
    networksById,
    projectsById,
    t,
  ]);

  const sections = useMemo(
    () => SECTION_ORDER
      .map((objectType) => ({
        key: objectType as NetworkBrowserObjectType,
        label: sectionLabels[objectType],
        items: items
          .filter((item) => item.objectType === objectType)
          .sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .filter((section) => section.items.length > 0),
    [items, sectionLabels],
  );

  useEffect(() => {
    if (items.length === 0) {
      setSelectedKey(null);
      return;
    }

    if (selectedKey && items.some((item) => `${item.objectType}:${item.id}` === selectedKey)) {
      return;
    }

    const firstItem = items[0];
    setSelectedKey(`${firstItem.objectType}:${firstItem.id}`);
  }, [items, selectedKey]);

  const handleOpen = useCallback(async (item: BookmarkedSidebarItem) => {
    switch (item.objectType) {
      case 'project':
        await useEditorStore.getState().openTab({ type: 'project', targetId: item.id, title: item.title });
        return;
      case 'network':
        await openNetwork(item.id);
        await useEditorStore.getState().openTab({ type: 'network', targetId: item.id, title: item.title });
        return;
      case 'instance':
        await openNetwork(networkId);
        await useEditorStore.getState().openTab({ type: 'instance', targetId: item.id, title: item.title });
        return;
      case 'file':
        if (item.filePath) {
          await openFileTab({ filePath: item.filePath });
        }
        return;
      case 'meaning':
        await useEditorStore.getState().openTab({ type: 'meaning', targetId: item.id, title: item.title });
        return;
      case 'context':
        await openNetwork(networkId);
        await useContextStore.getState().loadContexts(networkId);
        await useEditorStore.getState().openTab({ type: 'context', targetId: item.id, title: item.title });
        return;
    }
  }, [networkId, openNetwork]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-panel">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!fullData) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-panel px-4 text-center text-xs text-muted">
        {t('network.notFound')}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex h-full flex-col bg-surface-panel">
        <div className="border-b border-subtle bg-surface-card px-5 py-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-secondary">
            {t('sidebar.networkObjects' as never)}
          </div>
          <div className="mt-1 text-lg font-semibold text-default">{fullData.network.name}</div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted">
          {t('common.none' as never)}
        </div>
      </div>
    );
  }

  return (
    <NetworkObjectBrowser
      title={fullData.network.name}
      searchPlaceholder={t('sidebar.search')}
      sections={sections}
      selectedKey={selectedKey}
      onSelect={(item) => setSelectedKey(`${item.objectType}:${item.id}`)}
      onOpen={(item) => { void handleOpen(item as BookmarkedSidebarItem); }}
    />
  );
}
