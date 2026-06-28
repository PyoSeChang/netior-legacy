import React, { useMemo } from 'react';
import {
  Box,
  Boxes,
  Database,
  Eye,
  FileQuestion,
  FolderTree,
  GitBranch,
  Link2,
  PackageOpen,
  Plus,
  Shapes,
} from 'lucide-react';
import type {
  DomainSnapshot,
  InstanceRecord,
  KindRecord,
  RelationKindRecord,
  ResourceRecord,
  ViewRecord,
} from '@netior/shared';
import type { World } from '@netior/shared/types';
import type { DomainModelSummary, DomainViewSummary } from '../../stores/domain-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { formatCompactPath } from '../../utils/path-utils';

interface ExplorerViewProps {
  world: World | null;
  models: DomainModelSummary[];
  views: DomainViewSummary[];
  activeModelId: string | null;
  snapshot: DomainSnapshot | null;
}

interface ExplorerSectionProps {
  title: string;
  count?: number;
  onCreate?: () => void;
  children: React.ReactNode;
}

interface ExplorerRowProps {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  icon: React.ReactNode;
  onClick?: () => void;
}

function getWorldRoot(world: World): string {
  return world.root_uri;
}

function isActive(record: { status?: string; archived_at?: string | null }): boolean {
  return record.status !== 'archived' && !record.archived_at;
}

function ExplorerSection({ title, count, onCreate, children }: ExplorerSectionProps): JSX.Element {
  return (
    <section className="rounded-lg border border-subtle bg-surface-card">
      <header className="flex items-center justify-between border-b border-subtle px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-default">{title}</h3>
          {typeof count === 'number' && <span className="text-xs text-muted">{count}</span>}
        </div>
        {onCreate && (
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted hover:bg-state-hover hover:text-default"
            onClick={onCreate}
          >
            <Plus size={14} />
          </button>
        )}
      </header>
      <div className="divide-y divide-subtle">{children}</div>
    </section>
  );
}

function EmptySection({ label }: { label: string }): JSX.Element {
  return <div className="px-3 py-4 text-center text-xs text-muted">{label}</div>;
}

function ExplorerRow({ title, subtitle, meta, icon, onClick }: ExplorerRowProps): JSX.Element {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-state-hover disabled:cursor-default disabled:hover:bg-transparent"
      disabled={!onClick}
      onClick={onClick}
    >
      <div className="shrink-0 text-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-default">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>}
      </div>
      {meta && <div className="shrink-0 text-xs text-muted">{meta}</div>}
    </button>
  );
}

export function ExplorerView({ world, models, views, activeModelId, snapshot }: ExplorerViewProps): JSX.Element {
  const { t } = useI18n();
  const openTab = useEditorStore((s) => s.openTab);

  if (!world) {
    return <div className="flex h-full items-center justify-center text-xs text-muted">{t('explorer.noWorldSelected' as never)}</div>;
  }

  const activeModel = models.find((model) => model.id === activeModelId) ?? models[0] ?? null;
  const modelId = activeModel?.id ?? null;
  const rootId = modelId
    ? snapshot?.worldNodes.find((node) => node.id === modelId)?.root_id ?? world.id
    : world.id;

  const modelViews = useMemo(
    () => (snapshot?.views ?? []).filter((view) => view.owner_model_id === modelId),
    [modelId, snapshot?.views],
  );
  const bindings = useMemo(
    () => (snapshot?.directoryBindings ?? []).filter((binding) => binding.model_id === modelId),
    [modelId, snapshot?.directoryBindings],
  );
  const childModels = useMemo(
    () => (snapshot?.worldNodes ?? []).filter((node) => node.parent_id === modelId && node.node_type === 'model' && isActive(node)),
    [modelId, snapshot?.worldNodes],
  );
  const kinds = useMemo(
    () => (snapshot?.kinds ?? []).filter((kind) => kind.model_id === modelId && isActive(kind)),
    [modelId, snapshot?.kinds],
  );
  const relationKinds = useMemo(
    () => (snapshot?.relationKinds ?? []).filter((relationKind) => relationKind.model_id === modelId && isActive(relationKind)),
    [modelId, snapshot?.relationKinds],
  );
  const instances = useMemo(
    () => (snapshot?.instances ?? []).filter((instance) => instance.home_model_id === modelId && isActive(instance)),
    [modelId, snapshot?.instances],
  );
  const instanceIds = useMemo(() => new Set(instances.map((instance) => instance.id)), [instances]);
  const resourceById = useMemo(
    () => new Map((snapshot?.resources ?? []).map((resource) => [resource.id, resource])),
    [snapshot?.resources],
  );
  const resourcesByInstanceId = useMemo(() => {
    const next = new Map<string, ResourceRecord[]>();
    for (const link of snapshot?.instanceResourceLinks ?? []) {
      const resource = resourceById.get(link.resource_id);
      if (!resource || !isActive(resource)) continue;
      const items = next.get(link.instance_id) ?? [];
      items.push(resource);
      next.set(link.instance_id, items);
    }
    return next;
  }, [resourceById, snapshot?.instanceResourceLinks]);
  const resources = useMemo(() => {
    const links = snapshot?.instanceResourceLinks ?? [];
    const resourceIds = new Set(links.filter((link) => instanceIds.has(link.instance_id)).map((link) => link.resource_id));
    return (snapshot?.resources ?? []).filter((resource) => resourceIds.has(resource.id) && isActive(resource));
  }, [instanceIds, snapshot?.instanceResourceLinks, snapshot?.resources]);
  const unassignedResources = useMemo(() => {
    const linkedResourceIds = new Set((snapshot?.instanceResourceLinks ?? []).map((link) => link.resource_id));
    return (snapshot?.resources ?? []).filter((resource) => (
      resource.root_id === rootId
      && isActive(resource)
      && !linkedResourceIds.has(resource.id)
    ));
  }, [rootId, snapshot?.instanceResourceLinks, snapshot?.resources]);

  const openEditor = (type: 'model' | 'kind' | 'relationKind' | 'instance' | 'resource', targetId: string, title: string): void => {
    void openTab({ type, targetId, title, rootNetworkId: rootId });
  };

  const createRecord = (type: 'kind' | 'relationKind' | 'instance' | 'view'): void => {
    if (!modelId) return;
    const draftId = `draft-${type}:${crypto.randomUUID()}`;
    if (type === 'kind') {
      void openTab({
        type: 'kind',
        targetId: draftId,
        title: t('domainEditor.newKind' as never),
        rootNetworkId: rootId,
        isDirty: true,
        draftData: { mode: 'create', modelId, rootId },
      });
      return;
    }
    if (type === 'relationKind') {
      void openTab({
        type: 'relationKind',
        targetId: draftId,
        title: t('domainEditor.newRelationKind' as never),
        rootNetworkId: rootId,
        isDirty: true,
        draftData: { mode: 'create', modelId, rootId },
      });
      return;
    }
    if (type === 'instance') {
      void openTab({
        type: 'instance',
        targetId: draftId,
        title: t('domainEditor.newInstance' as never),
        rootNetworkId: rootId,
        isDirty: true,
        draftData: { mode: 'create', modelId, rootId },
      });
      return;
    }
    void openTab({
      type: 'view',
      targetId: draftId,
      title: t('domainEditor.newView' as never),
      rootNetworkId: rootId,
      isDirty: true,
      draftData: { mode: 'create', modelId, rootId, viewType: 'canvas' },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-canvas">
      <div className="border-b border-subtle px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-default">
          <FolderTree size={16} />
          <span className="truncate">{activeModel?.name ?? world.name}</span>
        </div>
        <div className="mt-1 truncate text-xs text-muted">{formatCompactPath(getWorldRoot(world))}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!activeModel ? (
          <div className="flex h-full items-center justify-center text-xs text-muted">{t('explorer.noModelSelected' as never)}</div>
        ) : (
          <div className="space-y-4">
            <ExplorerSection title={t('explorer.model' as never)}>
              <ExplorerRow
                title={activeModel.name}
                subtitle={activeModel.description}
                meta={t('explorer.definition' as never)}
                icon={<Database size={15} />}
                onClick={() => openEditor('model', activeModel.id, activeModel.name)}
              />
            </ExplorerSection>

            <ExplorerSection title={t('explorer.childModels' as never)} count={childModels.length}>
              {childModels.length > 0 ? childModels.map((model) => (
                <ExplorerRow
                  key={model.id}
                  title={model.name}
                  subtitle={model.description}
                  icon={<FolderTree size={15} />}
                  onClick={() => openEditor('model', model.id, model.name)}
                />
              )) : <EmptySection label={t('explorer.noChildModels' as never)} />}
            </ExplorerSection>

            <ExplorerSection title={t('explorer.directoryBindings' as never)} count={bindings.length}>
              {bindings.length > 0 ? bindings.map((binding) => (
                <ExplorerRow
                  key={binding.id}
                  title={binding.relative_path}
                  meta={t('explorer.directory' as never)}
                  icon={<FolderTree size={15} />}
                />
              )) : <EmptySection label={t('explorer.noDirectoryBindings' as never)} />}
            </ExplorerSection>

            <ExplorerSection title={t('explorer.kinds' as never)} count={kinds.length} onCreate={() => createRecord('kind')}>
              {kinds.length > 0 ? kinds.map((kind: KindRecord) => (
                <ExplorerRow
                  key={kind.id}
                  title={kind.name}
                  subtitle={kind.description ?? kind.key}
                  icon={<Shapes size={15} />}
                  onClick={() => openEditor('kind', kind.id, kind.name)}
                />
              )) : <EmptySection label={t('explorer.noKinds' as never)} />}
            </ExplorerSection>

            <ExplorerSection title={t('explorer.relationKinds' as never)} count={relationKinds.length} onCreate={() => createRecord('relationKind')}>
              {relationKinds.length > 0 ? relationKinds.map((relationKind: RelationKindRecord) => (
                <ExplorerRow
                  key={relationKind.id}
                  title={relationKind.name}
                  subtitle={relationKind.description ?? relationKind.key}
                  meta={relationKind.directed ? t('explorer.directed' as never) : t('explorer.undirected' as never)}
                  icon={<GitBranch size={15} />}
                  onClick={() => openEditor('relationKind', relationKind.id, relationKind.name)}
                />
              )) : <EmptySection label={t('explorer.noRelationKinds' as never)} />}
            </ExplorerSection>

            <ExplorerSection title={t('explorer.instancesAndResources' as never)} count={instances.length + resources.length} onCreate={() => createRecord('instance')}>
              {instances.length > 0 ? instances.map((instance: InstanceRecord) => {
                const assignments = (snapshot?.kindAssignments ?? []).filter((assignment) => assignment.instance_id === instance.id && assignment.status === 'accepted');
                const linkedResources = resourcesByInstanceId.get(instance.id) ?? [];
                return (
                  <div key={instance.id}>
                    <ExplorerRow
                      title={instance.display_name}
                      subtitle={assignments.length > 0 ? t('explorer.kindAssignmentCount' as never, { count: assignments.length }) : t('explorer.noAcceptedKind' as never)}
                      icon={<Boxes size={15} />}
                      onClick={() => openEditor('instance', instance.id, instance.display_name)}
                    />
                    {linkedResources.length > 0 && (
                      <div className="pb-2 pl-9 pr-3">
                        {linkedResources.map((resource) => (
                          <button
                            key={resource.id}
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-secondary hover:bg-state-hover hover:text-default"
                            onClick={() => openEditor('resource', resource.id, resource.relative_path ?? resource.source_uri ?? 'Resource')}
                          >
                            <Link2 size={13} className="shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate">{resource.relative_path ?? resource.source_uri ?? resource.locator ?? resource.id}</span>
                            <span className="shrink-0 text-muted">{resource.observed_status}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }) : <EmptySection label={t('explorer.noInstances' as never)} />}

              <div className="px-3 py-2 text-xs font-semibold text-secondary">{t('explorer.unassignedResources' as never)} {unassignedResources.length}</div>
              {unassignedResources.length > 0 ? unassignedResources.map((resource: ResourceRecord) => (
                  <ExplorerRow
                    key={resource.id}
                    title={resource.relative_path ?? resource.source_uri ?? resource.locator ?? resource.id}
                    subtitle={resource.source_kind}
                    meta={resource.observed_status}
                    icon={<FileQuestion size={15} />}
                    onClick={() => openEditor('resource', resource.id, resource.relative_path ?? resource.source_uri ?? 'Resource')}
                  />
                )) : <EmptySection label={t('explorer.noUnassignedResources' as never)} />}
            </ExplorerSection>

            <ExplorerSection title={t('explorer.views' as never)} count={modelViews.length} onCreate={() => createRecord('view')}>
              {modelViews.length > 0 ? modelViews.map((view: ViewRecord) => (
                <ExplorerRow
                  key={view.id}
                  title={view.name}
                  subtitle={view.type}
                  icon={<Box size={15} />}
                />
              )) : <EmptySection label={t('explorer.noViews' as never)} />}
            </ExplorerSection>
          </div>
        )}
      </div>
    </div>
  );
}
