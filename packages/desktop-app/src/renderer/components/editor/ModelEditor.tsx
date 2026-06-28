import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import {
  NETIOR_RPC_METHODS,
  type ModelDirectoryBindingRecord,
  type ModelRecord,
  type WorldNodeRecord,
} from '@netior/shared';
import type { EditorTab } from '../../types/editor';
import { useDomainStore } from '../../stores/domain-store';
import { useEditorStore } from '../../stores/editor-store';
import { useFileStore, type FileTreeNode } from '../../stores/file-store';
import { useWorldStore } from '../../stores/world-store';
import { domainService } from '../../services/domain-service';
import { useI18n } from '../../hooks/useI18n';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';
import { getWorldRootDir } from '../../utils/world-utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select, type SelectOption } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { FileIcon } from '../sidebar/FileIcon';
import {
  EditorHeader,
  EditorScroll,
  ErrorBanner,
  Field,
} from './domain-editor-shared';

interface ModelEditorProps {
  tab: EditorTab;
}

interface ModelDraftData {
  mode: 'create';
  parentId: string;
  rootId: string;
}

function getModelDraftData(value: unknown): ModelDraftData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<ModelDraftData>;
  return data.mode === 'create' && typeof data.parentId === 'string' && typeof data.rootId === 'string'
    ? { mode: 'create', parentId: data.parentId, rootId: data.rootId }
    : null;
}

function normalizeRelativePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function normalizeAbsolutePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/g, '');
}

interface DirectoryTreeItem {
  node: FileTreeNode;
  depth: number;
  relativePath: string;
}

function getRelativeDirectoryPath(node: FileTreeNode, rootDir: string): string {
  const normalizedRoot = normalizeAbsolutePath(rootDir);
  const normalizedPath = normalizeAbsolutePath(node.path);
  return normalizeRelativePath(
    normalizedPath.startsWith(`${normalizedRoot}/`)
      ? normalizedPath.slice(normalizedRoot.length + 1)
      : normalizedPath,
  );
}

function buildVisibleDirectoryItems(
  nodes: FileTreeNode[],
  rootDir: string,
  expandedPaths: Set<string>,
  depth = 0,
): DirectoryTreeItem[] {
  const items: DirectoryTreeItem[] = [];
  for (const node of nodes) {
    if (node.type !== 'directory') continue;
    const relativePath = getRelativeDirectoryPath(node, rootDir);
    if (relativePath) {
      items.push({ node, depth, relativePath });
    }
    if (expandedPaths.has(node.path) && node.children) {
      items.push(...buildVisibleDirectoryItems(node.children, rootDir, expandedPaths, depth + 1));
    }
  }
  return items;
}

function collectDescendantIds(nodes: WorldNodeRecord[], modelId: string): Set<string> {
  const childrenByParent = new Map<string, WorldNodeRecord[]>();
  for (const node of nodes) {
    if (!node.parent_id || node.status === 'archived') continue;
    const children = childrenByParent.get(node.parent_id) ?? [];
    children.push(node);
    childrenByParent.set(node.parent_id, children);
  }

  const descendantIds = new Set<string>();
  const visit = (parentId: string): void => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      descendantIds.add(child.id);
      visit(child.id);
    }
  };
  visit(modelId);
  return descendantIds;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const normalizedRight = new Set(right.map((item) => item.toLocaleLowerCase()));
  return left.every((item) => normalizedRight.has(item.toLocaleLowerCase()));
}

function DirectoryTreeSelect({
  value,
  items,
  expandedPaths,
  boundPaths,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onSelect,
  onToggle,
}: {
  value: string;
  items: DirectoryTreeItem[];
  expandedPaths: Set<string>;
  boundPaths: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  onSelect: (value: string) => void;
  onToggle: (node: FileTreeNode) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownPos = useAnchoredDropdown(open, anchorRef, { estimatedHeight: 320 }, dropdownRef);
  const normalizedBoundPaths = useMemo(
    () => new Set(boundPaths.map((path) => path.toLocaleLowerCase())),
    [boundPaths],
  );
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) => (
      item.node.name.toLocaleLowerCase().includes(query)
      || item.relativePath.toLocaleLowerCase().includes(query)
    ));
  }, [items, searchQuery]);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }
    const handle = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(handle);
  }, [open]);

  return (
    <div className="relative block w-full">
      <div
        ref={anchorRef}
        role="combobox"
        aria-expanded={open}
        tabIndex={0}
        className={`flex w-full cursor-pointer items-center rounded-lg border px-3 py-2 text-left text-sm outline-none transition-all duration-fast ${
          open ? 'border-accent' : 'border-input hover:border-strong'
        } bg-surface-input text-default`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((current) => !current);
          }
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-muted'}`}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} className={`ml-2 shrink-0 text-muted transition-transform duration-fast ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed overflow-hidden rounded-lg border border-default bg-surface-panel"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
            visibility: dropdownPos.ready ? 'visible' : 'hidden',
            zIndex: 10001,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-subtle px-2 py-2">
            <div className="flex items-center gap-2 rounded-md border border-subtle bg-surface-editor px-2.5 py-1.5">
              <Search size={14} className="shrink-0 text-muted" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-default outline-none placeholder:text-muted"
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false);
                }}
              />
            </div>
          </div>
          <div className="max-h-[268px] overflow-auto py-1">
            {filteredItems.length > 0 ? (
              filteredItems.map(({ node, depth, relativePath }) => {
                const expanded = expandedPaths.has(node.path);
                const selected = value === relativePath;
                const alreadyBound = normalizedBoundPaths.has(relativePath.toLocaleLowerCase());
                return (
                  <div
                    key={node.path}
                    className={`group flex items-center gap-1 px-2 py-1.5 text-xs ${
                      selected ? 'bg-accent-muted text-accent' : 'text-default hover:bg-state-hover'
                    } ${alreadyBound ? 'opacity-50' : ''}`}
                    style={{ paddingLeft: 8 + depth * 14 }}
                  >
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted hover:bg-state-hover hover:text-default"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(node);
                      }}
                    >
                      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-not-allowed"
                      disabled={alreadyBound}
                      onClick={() => {
                        onSelect(relativePath);
                        setOpen(false);
                      }}
                    >
                      <FileIcon name={node.name} isFolder isOpen={expanded} size={14} className="shrink-0" />
                      <span className="truncate">{node.name}</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-xs text-muted">{emptyMessage}</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function ModelEditor({ tab }: ModelEditorProps): JSX.Element {
  const { t } = useI18n();
  const snapshot = useDomainStore((s) => s.snapshot);
  const refreshCurrentWorld = useDomainStore((s) => s.refreshCurrentWorld);
  const fileTree = useFileStore((s) => s.fileTree);
  const loadChildren = useFileStore((s) => s.loadChildren);
  const currentWorld = useWorldStore((s) => s.currentWorld);
  const draft = getModelDraftData(tab.draftData);
  const model = snapshot?.worldNodes.find((node) => node.id === tab.targetId && node.node_type === 'model') ?? null;
  const savedBindings = useMemo(
    () => (snapshot?.directoryBindings ?? []).filter((binding) => binding.model_id === tab.targetId),
    [snapshot?.directoryBindings, tab.targetId],
  );

  const initialParentId = draft?.parentId ?? model?.parent_id ?? null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [directoryBindings, setDirectoryBindings] = useState<string[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [expandedDirectoryPaths, setExpandedDirectoryPaths] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (draft) {
      setParentId(draft.parentId);
      return;
    }
    if (!model) return;
    setName(model.name);
    setDescription(model.description ?? '');
    setParentId(model.parent_id);
    setError(null);
  }, [draft, model]);

  useEffect(() => {
    if (draft) return;
    setDirectoryBindings(savedBindings.map((binding) => binding.relative_path));
  }, [draft, savedBindings]);

  const worldRootId = draft?.rootId ?? model?.root_id ?? tab.rootNetworkId ?? null;
  const worldRootDir = getWorldRootDir(currentWorld);
  const modelNodes = useMemo(
    () => (snapshot?.worldNodes ?? []).filter((node) => node.node_type === 'model' && node.status !== 'archived'),
    [snapshot?.worldNodes],
  );
  const descendantIds = useMemo(
    () => (model ? collectDescendantIds(snapshot?.worldNodes ?? [], model.id) : new Set<string>()),
    [model, snapshot?.worldNodes],
  );
  const parentOptions = useMemo<SelectOption[]>(() => {
    if (!worldRootId) return [];
    const options: SelectOption[] = [{ value: worldRootId, label: currentWorld?.name ?? t('domainEditor.worldRoot' as never) }];
    for (const node of modelNodes) {
      if (node.root_id !== worldRootId || node.id === model?.id || descendantIds.has(node.id)) continue;
      options.push({ value: node.id, label: node.name });
    }
    return options;
  }, [currentWorld?.name, descendantIds, model?.id, modelNodes, t, worldRootId]);
  const visibleDirectoryItems = useMemo(
    () => buildVisibleDirectoryItems(fileTree, worldRootDir, expandedDirectoryPaths),
    [expandedDirectoryPaths, fileTree, worldRootDir],
  );
  const savedBindingPaths = useMemo(
    () => savedBindings.map((binding) => binding.relative_path),
    [savedBindings],
  );
  const siblingModelNames = useMemo(
    () => new Set((snapshot?.worldNodes ?? [])
      .filter((node) => (
        node.node_type === 'model'
        && node.status !== 'archived'
        && node.parent_id === parentId
        && node.id !== model?.id
      ))
      .map((node) => node.name.trim().toLocaleLowerCase())),
    [model?.id, parentId, snapshot?.worldNodes],
  );

  const isDirty = draft
    ? name.trim().length > 0 || description.trim().length > 0 || directoryBindings.length > 0 || parentId !== draft.parentId
    : Boolean(model && (
      name !== model.name
      || description !== (model.description ?? '')
      || parentId !== model.parent_id
      || !sameStringSet(directoryBindings, savedBindingPaths)
    ));
  const displayTitle = name.trim() || (draft ? t('domainEditor.newModel' as never) : model?.name ?? t('domainEditor.title' as never));

  useEffect(() => {
    useEditorStore.getState().setDirty(tab.id, isDirty);
  }, [isDirty, tab.id]);

  function handleNameChange(nextName: string): void {
    setName(nextName);
    useEditorStore.getState().updateTitle(tab.id, nextName.trim() || t('domainEditor.newModel' as never));
  }

  function addDirectoryBinding(): void {
    if (!selectedDirectory) return;
    const relativePath = normalizeRelativePath(selectedDirectory);
    if (!relativePath) {
      setError(t('domainEditor.directoryBindingRequired' as never));
      return;
    }
    if (directoryBindings.some((path) => path.toLocaleLowerCase() === relativePath.toLocaleLowerCase())) {
      setError(t('domainEditor.directoryBindingAlreadyExists' as never));
      return;
    }
    setDirectoryBindings((current) => [...current, relativePath]);
    setSelectedDirectory('');
    setError(null);
  }

  function toggleDirectory(node: FileTreeNode): void {
    setExpandedDirectoryPaths((current) => {
      const next = new Set(current);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
        if (node.hasChildren !== false && !node.children) {
          void loadChildren(node.path);
        }
      }
      return next;
    });
  }

  async function saveModel(): Promise<void> {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      setError(t('domainEditor.nameRequired' as never));
      return;
    }
    if (!parentId) {
      setError(t('domainEditor.parentRequired' as never));
      return;
    }
    if (siblingModelNames.has(trimmedName.toLocaleLowerCase())) {
      setError(t('domainEditor.modelNameAlreadyExists' as never));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (draft) {
        const created = await domainService.rpc<ModelRecord>(NETIOR_RPC_METHODS.modelCreate, {
          worldId: parentId,
          name: trimmedName,
          description: trimmedDescription || null,
        });
        for (const relativePath of directoryBindings) {
          await domainService.rpc<ModelDirectoryBindingRecord>(NETIOR_RPC_METHODS.modelBindDirectory, {
            modelId: created.id,
            relativePath,
          });
        }
        await refreshCurrentWorld();
        useEditorStore.getState().navigateTab(tab.id, {
          type: 'model',
          targetId: created.id,
          title: created.name,
          rootNetworkId: created.root_id,
          isDirty: false,
        });
        return;
      }

      if (!model) return;
      if (parentId !== model.parent_id) {
        await domainService.rpc<ModelRecord>(NETIOR_RPC_METHODS.modelMove, {
          modelId: model.id,
          parentId,
        });
      }
      if (trimmedName !== model.name) {
        await domainService.rpc<ModelRecord>(NETIOR_RPC_METHODS.modelRename, {
          modelId: model.id,
          name: trimmedName,
        });
      }
      if (trimmedDescription !== (model.description ?? '')) {
        await domainService.rpc<ModelRecord>(NETIOR_RPC_METHODS.modelUpdateDescription, {
          modelId: model.id,
          description: trimmedDescription || null,
        });
      }

      const nextBindingSet = new Set(directoryBindings.map((path) => path.toLocaleLowerCase()));
      const savedBindingByPath = new Map(savedBindings.map((binding) => [binding.relative_path.toLocaleLowerCase(), binding]));
      for (const binding of savedBindings) {
        if (!nextBindingSet.has(binding.relative_path.toLocaleLowerCase())) {
          await domainService.rpc<boolean>(NETIOR_RPC_METHODS.modelUnbindDirectory, {
            bindingId: binding.id,
          });
        }
      }
      for (const relativePath of directoryBindings) {
        if (!savedBindingByPath.has(relativePath.toLocaleLowerCase())) {
          await domainService.rpc<ModelDirectoryBindingRecord>(NETIOR_RPC_METHODS.modelBindDirectory, {
            modelId: model.id,
            relativePath,
          });
        }
      }

      await refreshCurrentWorld();
      useEditorStore.getState().updateTitle(tab.id, trimmedName);
      useEditorStore.getState().setDirty(tab.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!draft && !model) {
    return <EditorScroll><div className="text-sm text-muted">{t('domainEditor.modelNotFound' as never)}</div></EditorScroll>;
  }

  return (
    <EditorScroll>
      <EditorHeader
        eyebrow={draft ? t('domainEditor.newModel' as never) : t('domainEditor.title' as never)}
        title={displayTitle}
        subtitle={draft ? t('domainEditor.newModelDescription' as never) : t('domainEditor.modelDefinitionDescription' as never)}
      />
      <ErrorBanner message={error} />

      <div className="rounded-xl border border-subtle bg-surface-card p-4">
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-default">{t('domainEditor.basicInfo' as never)}</h3>
            <Field label={t('domainEditor.name' as never)}>
              <Input
                value={name}
                autoFocus={Boolean(draft)}
                onChange={(event) => handleNameChange(event.target.value)}
              />
            </Field>
            <Field label={t('domainEditor.description' as never)}>
              <TextArea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </section>

          <section className="space-y-3 border-t border-subtle pt-5">
            <h3 className="text-sm font-semibold text-default">{t('domainEditor.modelLocation' as never)}</h3>
            <Field label={t('domainEditor.parentModel' as never)}>
              <Select
                value={parentId ?? ''}
                options={parentOptions}
                searchable
                searchPlaceholder={t('domainEditor.searchModel' as never)}
                emptyMessage={t('domainEditor.noParentModels' as never)}
                onChange={(event) => setParentId(event.target.value)}
              />
            </Field>
          </section>

          <section className="space-y-3 border-t border-subtle pt-5">
            <h3 className="text-sm font-semibold text-default">{t('domainEditor.directoryBindings' as never)}</h3>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <DirectoryTreeSelect
                  value={selectedDirectory}
                  items={visibleDirectoryItems}
                  expandedPaths={expandedDirectoryPaths}
                  boundPaths={directoryBindings}
                  placeholder={t('domainEditor.selectDirectory' as never)}
                  searchPlaceholder={t('domainEditor.searchDirectory' as never)}
                  emptyMessage={t('domainEditor.noDirectoriesAvailable' as never)}
                  onSelect={setSelectedDirectory}
                  onToggle={toggleDirectory}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!selectedDirectory}
                onClick={addDirectoryBinding}
              >
                {t('domainEditor.addDirectoryBinding' as never)}
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-subtle bg-surface-input">
              {directoryBindings.length > 0 ? (
                directoryBindings.map((relativePath) => (
                  <div key={relativePath} className="flex items-center gap-3 border-b border-subtle px-3 py-2.5 last:border-b-0">
                    <span className="min-w-0 flex-1 truncate text-sm text-default">{relativePath}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDirectoryBindings((current) => current.filter((path) => path !== relativePath))}
                    >
                      {t('domainEditor.remove' as never)}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="px-3 py-6 text-center text-xs text-muted">{t('domainEditor.noDirectoryBindingsYet' as never)}</div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end border-t border-subtle pt-4">
          <Button size="sm" isLoading={saving} disabled={!isDirty || !name.trim()} onClick={() => void saveModel()}>
            {t('domainEditor.save' as never)}
          </Button>
        </div>
      </div>
    </EditorScroll>
  );
}
