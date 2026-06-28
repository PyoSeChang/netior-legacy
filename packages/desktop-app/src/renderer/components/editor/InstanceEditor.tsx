import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import {
  NETIOR_RPC_METHODS,
  type InstanceRecord,
  type InstanceResourceLinkRecord,
  type KindAssignmentRecord,
  type PropertyRecord,
  type PropertyValueRecord,
  type RelationAssertionRecord,
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
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { FileIcon } from '../sidebar/FileIcon';
import {
  EditorHeader,
  EditorScroll,
  ErrorBanner,
  Field,
} from './domain-editor-shared';

interface InstanceEditorProps {
  tab: EditorTab;
}

interface InstanceDraftData {
  mode: 'create';
  modelId: string;
  rootId: string;
}

function getInstanceDraftData(value: unknown): InstanceDraftData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<InstanceDraftData>;
  return data.mode === 'create' && typeof data.modelId === 'string' && typeof data.rootId === 'string'
    ? { mode: 'create', modelId: data.modelId, rootId: data.rootId }
    : null;
}

function labelOfResource(resource: { relative_path: string | null; source_uri: string | null; locator: string | null; id: string }): string {
  return resource.relative_path ?? resource.source_uri ?? resource.locator ?? resource.id;
}

function fileNameOf(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).pop() ?? value;
}

function normalizeRelativePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function normalizeAbsolutePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/g, '');
}

function getRelativePath(node: FileTreeNode, rootDir: string): string {
  const normalizedRoot = normalizeAbsolutePath(rootDir);
  const normalizedPath = normalizeAbsolutePath(node.path);
  return normalizeRelativePath(
    normalizedPath.startsWith(`${normalizedRoot}/`)
      ? normalizedPath.slice(normalizedRoot.length + 1)
      : normalizedPath,
  );
}

interface ResourceTreeItem {
  node: FileTreeNode;
  depth: number;
  relativePath: string;
}

function buildVisibleResourceItems(nodes: FileTreeNode[], rootDir: string, expandedPaths: Set<string>, depth = 0): ResourceTreeItem[] {
  const items: ResourceTreeItem[] = [];
  for (const node of nodes) {
    const relativePath = getRelativePath(node, rootDir);
    if (relativePath) items.push({ node, depth, relativePath });
    if (node.type === 'directory' && expandedPaths.has(node.path) && node.children) {
      items.push(...buildVisibleResourceItems(node.children, rootDir, expandedPaths, depth + 1));
    }
  }
  return items;
}

function ResourceTreeSelect({
  value,
  items,
  expandedPaths,
  placeholder,
  emptyMessage,
  onSelect,
  onToggle,
}: {
  value: string;
  items: ResourceTreeItem[];
  expandedPaths: Set<string>;
  placeholder: string;
  emptyMessage: string;
  onSelect: (value: string) => void;
  onToggle: (node: FileTreeNode) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPos = useAnchoredDropdown(open, anchorRef, { estimatedHeight: 340 }, dropdownRef);

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
      >
        <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-muted'}`}>{value || placeholder}</span>
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
          <div className="max-h-[340px] overflow-auto py-1">
            {items.length > 0 ? items.map(({ node, depth, relativePath }) => {
              const expanded = expandedPaths.has(node.path);
              const selected = value === relativePath;
              return (
                <div
                  key={node.path}
                  className={`group flex items-center gap-1 px-2 py-1.5 text-xs ${selected ? 'bg-accent-muted text-accent' : 'text-default hover:bg-state-hover'}`}
                  style={{ paddingLeft: 8 + depth * 14 }}
                >
                  {node.type === 'directory' ? (
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted hover:bg-state-hover hover:text-default"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(node);
                      }}
                    >
                      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                  <FileIcon name={node.name} isFolder={node.type === 'directory'} isOpen={expanded} size={14} className="shrink-0" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => {
                      onSelect(relativePath);
                      setOpen(false);
                    }}
                  >
                    {relativePath}
                  </button>
                </div>
              );
            }) : (
              <div className="px-3 py-6 text-center text-xs text-muted">{emptyMessage}</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function parseStoredValue(value: string | null): unknown {
  if (value === null) return '';
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function stringifyValue(property: PropertyRecord, value: unknown): unknown {
  if (property.value_type === 'number') return typeof value === 'number' ? value : Number(value || 0);
  if (property.value_type === 'boolean') return Boolean(value);
  return String(value ?? '');
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? '') === JSON.stringify(right ?? '');
}

function isRequiredProperty(property: PropertyRecord): boolean {
  return property.required_policy === 'required';
}

function isEmptyPropertyValue(property: PropertyRecord, value: unknown): boolean {
  if (property.value_type === 'boolean') return value === '' || value === null || value === undefined;
  if (property.value_type === 'number') return value === '' || value === null || value === undefined || Number.isNaN(Number(value));
  return String(value ?? '').trim().length === 0;
}

function ReadonlySelectValue({ value }: { value: string }): JSX.Element {
  return (
    <div className="flex w-full items-center rounded-lg border border-input bg-surface-input px-3 py-2 text-sm text-muted">
      <span className="min-w-0 flex-1 truncate">{value}</span>
    </div>
  );
}

function nextAssignmentStatus(status: string): 'accepted' | 'rejected' | 'superseded' {
  if (status === 'accepted') return 'rejected';
  if (status === 'rejected') return 'superseded';
  return 'accepted';
}

function nextObservedStatus(status: string): 'observed' | 'missing' | 'ignored' {
  if (status === 'observed') return 'missing';
  if (status === 'missing') return 'ignored';
  return 'observed';
}

export function InstanceEditor({ tab }: InstanceEditorProps): JSX.Element {
  const { t } = useI18n();
  const snapshot = useDomainStore((s) => s.snapshot);
  const refreshCurrentWorld = useDomainStore((s) => s.refreshCurrentWorld);
  const fileTree = useFileStore((s) => s.fileTree);
  const fileTreeRootDirs = useFileStore((s) => s.rootDirs);
  const loadFileTree = useFileStore((s) => s.loadFileTree);
  const loadChildren = useFileStore((s) => s.loadChildren);
  const currentWorld = useWorldStore((s) => s.currentWorld);
  const draft = getInstanceDraftData(tab.draftData);
  const instance = snapshot?.instances.find((item) => item.id === tab.targetId && item.status !== 'archived') ?? null;
  const modelId = instance?.home_model_id ?? draft?.modelId ?? null;
  const model = modelId ? snapshot?.worldNodes.find((node) => node.id === modelId) ?? null : null;
  const worldRootDir = getWorldRootDir(currentWorld);
  const kinds = useMemo(
    () => (snapshot?.kinds ?? []).filter((item) => item.model_id === modelId && item.status !== 'archived'),
    [modelId, snapshot?.kinds],
  );
  const assignments = useMemo(
    () => (snapshot?.kindAssignments ?? []).filter((item) => item.instance_id === tab.targetId && item.status !== 'archived'),
    [snapshot?.kindAssignments, tab.targetId],
  );
  const resources = useMemo(
    () => (snapshot?.resources ?? []).filter((item) => item.root_id === model?.root_id && item.observed_status !== 'archived'),
    [model?.root_id, snapshot?.resources],
  );
  const resourceLinks = useMemo(
    () => (snapshot?.instanceResourceLinks ?? []).filter((item) => item.instance_id === tab.targetId),
    [snapshot?.instanceResourceLinks, tab.targetId],
  );
  const propertyValues = useMemo(
    () => (snapshot?.propertyValues ?? []).filter((item) => item.instance_id === tab.targetId && item.status !== 'archived'),
    [snapshot?.propertyValues, tab.targetId],
  );
  const relations = useMemo(
    () => (snapshot?.relations ?? []).filter((item) => item.subject_instance_id === tab.targetId || item.object_instance_id === tab.targetId),
    [snapshot?.relations, tab.targetId],
  );
  const relationKinds = useMemo(
    () => (snapshot?.relationKinds ?? []).filter((item) => item.model_id === modelId && item.status !== 'archived'),
    [modelId, snapshot?.relationKinds],
  );
  const relationEndpointPairs = snapshot?.relationKindEndpointPairs ?? [];
  const otherInstances = useMemo(
    () => (snapshot?.instances ?? []).filter((item) => item.id !== tab.targetId && item.status !== 'archived'),
    [snapshot?.instances, tab.targetId],
  );
  const assignedKindIds = useMemo(() => new Set(assignments.map((item) => item.kind_id)), [assignments]);
  const linkedResourceIds = useMemo(() => new Set(resourceLinks.map((item) => item.resource_id)), [resourceLinks]);

  const [displayName, setDisplayName] = useState('');
  const [kindId, setKindId] = useState('');
  const [propertyKindId, setPropertyKindId] = useState('');
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, unknown>>({});
  const [resourceId, setResourceId] = useState('');
  const [resourcePath, setResourcePath] = useState('');
  const [expandedResourcePaths, setExpandedResourcePaths] = useState<Set<string>>(() => new Set());
  const [relationKindId, setRelationKindId] = useState('');
  const [objectInstanceId, setObjectInstanceId] = useState('');
  const [subjectKindId, setSubjectKindId] = useState('');
  const [objectKindId, setObjectKindId] = useState('');
  const [propertyErrors, setPropertyErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (instance) setDisplayName(instance.display_name);
  }, [instance]);

  useEffect(() => {
    if (!worldRootDir) return;
    const normalizedRoot = normalizeAbsolutePath(worldRootDir);
    const hasRoot = fileTreeRootDirs.some((dir) => normalizeAbsolutePath(dir) === normalizedRoot);
    if (!hasRoot) void loadFileTree(worldRootDir);
  }, [fileTreeRootDirs, loadFileTree, worldRootDir]);

  useEffect(() => {
    const firstAssignedKind = assignments.find((assignment) => assignment.status !== 'archived');
    if (!propertyKindId && firstAssignedKind) setPropertyKindId(firstAssignedKind.kind_id);
  }, [assignments, propertyKindId]);

  const kindOptions = kinds
    .filter((kind) => !assignedKindIds.has(kind.id))
    .map((kind) => ({ value: kind.id, label: kind.name }));
  const assignedKindOptions = assignments
    .map((assignment) => kinds.find((kind) => kind.id === assignment.kind_id))
    .filter((kind): kind is NonNullable<typeof kind> => Boolean(kind))
    .map((kind) => ({ value: kind.id, label: kind.name }));
  const resourceOptions = resources
    .filter((resource) => !linkedResourceIds.has(resource.id))
    .map((resource) => ({ value: resource.id, label: labelOfResource(resource) }));
  const selectedKindProperties = useMemo(
    () => (snapshot?.properties ?? []).filter((property) => property.kind_id === propertyKindId && property.status !== 'archived'),
    [propertyKindId, snapshot?.properties],
  );
  const assignedProperties = useMemo(
    () => (snapshot?.properties ?? []).filter((property) => assignedKindIds.has(property.kind_id) && property.status !== 'archived'),
    [assignedKindIds, snapshot?.properties],
  );
  const visibleResourceItems = useMemo(
    () => buildVisibleResourceItems(fileTree, worldRootDir, expandedResourcePaths),
    [expandedResourcePaths, fileTree, worldRootDir],
  );
  const relationKindOptions = relationKinds.map((relationKind) => ({ value: relationKind.id, label: relationKind.name }));
  const currentAssignedKinds = useMemo(
    () => assignments.map((assignment) => kinds.find((kind) => kind.id === assignment.kind_id)).filter((kind): kind is NonNullable<typeof kind> => Boolean(kind)),
    [assignments, kinds],
  );
  const selectedRelationKind = useMemo(
    () => relationKinds.find((relationKind) => relationKind.id === relationKindId) ?? null,
    [relationKindId, relationKinds],
  );
  const selectedRelationPairs = useMemo(
    () => relationEndpointPairs.filter((pair) => pair.relation_kind_id === relationKindId),
    [relationEndpointPairs, relationKindId],
  );
  const allowedObjectKindIds = useMemo(() => {
    if (!selectedRelationKind || selectedRelationPairs.length === 0) return null;
    const subjectIds = subjectKindId ? [subjectKindId] : currentAssignedKinds.map((kind) => kind.id);
    const allowed = new Set<string>();
    for (const subjectId of subjectIds) {
      for (const pair of selectedRelationPairs) {
        if (pair.subject_kind_id === subjectId) allowed.add(pair.object_kind_id);
        if (!selectedRelationKind.directed && pair.object_kind_id === subjectId) allowed.add(pair.subject_kind_id);
      }
    }
    return allowed;
  }, [currentAssignedKinds, selectedRelationKind, selectedRelationPairs, subjectKindId]);
  const targetInstanceOptions = useMemo(() => {
    if (!allowedObjectKindIds) return otherInstances.map((item) => ({ value: item.id, label: item.display_name }));
    return otherInstances
      .filter((item) => (snapshot?.kindAssignments ?? []).some((assignment) =>
        assignment.instance_id === item.id
        && assignment.status !== 'archived'
        && allowedObjectKindIds.has(assignment.kind_id),
      ))
      .map((item) => ({ value: item.id, label: item.display_name }));
  }, [allowedObjectKindIds, otherInstances, snapshot?.kindAssignments]);
  const selectedObjectAssignments = useMemo(
    () => (snapshot?.kindAssignments ?? []).filter((assignment) => assignment.instance_id === objectInstanceId && assignment.status !== 'archived'),
    [objectInstanceId, snapshot?.kindAssignments],
  );
  const selectedObjectKinds = useMemo(
    () => selectedObjectAssignments
      .map((assignment) => (snapshot?.kinds ?? []).find((kind) => kind.id === assignment.kind_id))
      .filter((kind): kind is NonNullable<typeof kind> => Boolean(kind))
      .filter((kind) => !allowedObjectKindIds || allowedObjectKindIds.has(kind.id)),
    [allowedObjectKindIds, selectedObjectAssignments, snapshot?.kinds],
  );
  const subjectKindOptions = currentAssignedKinds.map((kind) => ({ value: kind.id, label: kind.name }));
  const objectKindOptions = selectedObjectKinds.map((kind) => ({ value: kind.id, label: kind.name }));
  const hasPropertyDraftChanges = useMemo(
    () => Object.entries(propertyDrafts).some(([propertyId, value]) => {
      const property = snapshot?.properties.find((item) => item.id === propertyId);
      if (!property) return false;
      const current = parseStoredValue(getPropertyValue(propertyId)?.value_json ?? null);
      return !valuesEqual(stringifyValue(property, value), current);
    }),
    [propertyDrafts, propertyValues, snapshot?.properties],
  );

  useEffect(() => {
    if (subjectKindId && !currentAssignedKinds.some((kind) => kind.id === subjectKindId)) {
      setSubjectKindId('');
    }
  }, [currentAssignedKinds, subjectKindId]);

  useEffect(() => {
    if (objectInstanceId && !targetInstanceOptions.some((option) => option.value === objectInstanceId)) {
      setObjectInstanceId('');
      setObjectKindId('');
    }
  }, [objectInstanceId, targetInstanceOptions]);

  useEffect(() => {
    if (objectKindId && !selectedObjectKinds.some((kind) => kind.id === objectKindId)) {
      setObjectKindId('');
    }
  }, [objectKindId, selectedObjectKinds]);

  const displayTitle = displayName.trim() || (draft ? t('domainEditor.newInstance' as never) : instance?.display_name || t('domainEditor.instance' as never));
  const isDirty = draft
    ? displayName.trim().length > 0 || kindId.length > 0 || resourceId.length > 0
    : Boolean(instance && (displayName !== instance.display_name || hasPropertyDraftChanges));

  useEffect(() => {
    useEditorStore.getState().setDirty(tab.id, isDirty);
  }, [isDirty, tab.id]);

  function handleDisplayNameChange(nextName: string): void {
    setDisplayName(nextName);
    useEditorStore.getState().updateTitle(tab.id, nextName.trim() || (draft ? t('domainEditor.newInstance' as never) : t('domainEditor.instance' as never)));
  }

  function toggleResourceNode(node: FileTreeNode): void {
    if (node.type !== 'directory') return;
    setExpandedResourcePaths((current) => {
      const next = new Set(current);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
        if (!node.children && node.hasChildren !== false) void loadChildren(node.path);
      }
      return next;
    });
  }

  function getPropertyValue(propertyId: string): PropertyValueRecord | null {
    return propertyValues.find((value) => value.property_id === propertyId) ?? null;
  }

  function getPropertyDraft(property: PropertyRecord): unknown {
    if (property.id in propertyDrafts) return propertyDrafts[property.id];
    return parseStoredValue(getPropertyValue(property.id)?.value_json ?? null);
  }

  function setPropertyDraft(propertyId: string, value: unknown): void {
    setPropertyDrafts((current) => ({ ...current, [propertyId]: value }));
    setPropertyErrors((current) => {
      if (!current[propertyId]) return current;
      const next = { ...current };
      delete next[propertyId];
      return next;
    });
  }

  async function saveName(): Promise<void> {
    if ((!instance && !draft) || !displayName.trim()) return;
    const nextPropertyErrors: Record<string, string> = {};
    if (!draft) {
      for (const property of assignedProperties) {
        if (!isRequiredProperty(property)) continue;
        if (isEmptyPropertyValue(property, getPropertyDraft(property))) {
          nextPropertyErrors[property.id] = t('domainEditor.requiredPropertyMissing' as never);
        }
      }
    }
    if (Object.keys(nextPropertyErrors).length > 0) {
      setPropertyErrors(nextPropertyErrors);
      setError(t('domainEditor.requiredPropertyMissing' as never));
      return;
    }
    setSaving('name');
    setError(null);
    try {
      if (draft) {
        const created = await domainService.rpc<InstanceRecord>(NETIOR_RPC_METHODS.instanceCreate, {
          modelId: draft.modelId,
          displayName: displayName.trim(),
        });
        if (kindId) {
          await domainService.rpc<KindAssignmentRecord>(NETIOR_RPC_METHODS.instanceAssignKind, {
            instanceId: created.id,
            kindId,
            status: 'accepted',
          });
        }
        if (resourceId) {
          await domainService.rpc<InstanceResourceLinkRecord>(NETIOR_RPC_METHODS.instanceLinkResource, {
            instanceId: created.id,
            resourceId,
          });
        }
        await refreshCurrentWorld();
        useEditorStore.getState().updateTitle(tab.id, created.display_name);
        useEditorStore.getState().setDirty(tab.id, false);
        useEditorStore.getState().openTab({
          type: 'instance',
          targetId: created.id,
          title: created.display_name,
          rootNetworkId: draft.rootId,
        });
        return;
      }
      if (!instance) return;
      let current = instance;
      if (displayName.trim() !== instance.display_name) {
        current = await domainService.rpc<InstanceRecord>(NETIOR_RPC_METHODS.instanceUpdateDisplayName, {
          id: instance.id,
          displayName: displayName.trim(),
        });
      }
      for (const [propertyId, draftValue] of Object.entries(propertyDrafts)) {
        const property = snapshot?.properties.find((item) => item.id === propertyId);
        if (!property) continue;
        const value = stringifyValue(property, draftValue);
        const existing = getPropertyValue(propertyId);
        const currentValue = parseStoredValue(existing?.value_json ?? null);
        if (valuesEqual(value, currentValue)) continue;
        if (existing) {
          await domainService.rpc<PropertyValueRecord>(NETIOR_RPC_METHODS.propertyValueUpdate, {
            id: existing.id,
            value,
            status: 'accepted',
          });
        } else {
          await domainService.rpc<PropertyValueRecord>(NETIOR_RPC_METHODS.propertyValueCreate, {
            instanceId: instance.id,
            propertyId,
            value,
            status: 'accepted',
          });
        }
      }
      setPropertyDrafts({});
      setPropertyErrors({});
      await refreshCurrentWorld();
      useEditorStore.getState().updateTitle(tab.id, current.display_name);
      useEditorStore.getState().setDirty(tab.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function assignKind(): Promise<void> {
    if (!instance || !kindId) return;
    setSaving('kind');
    setError(null);
    try {
      await domainService.rpc<KindAssignmentRecord>(NETIOR_RPC_METHODS.instanceAssignKind, {
        instanceId: instance.id,
        kindId,
        status: 'accepted',
      });
      setKindId('');
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function removeKindAssignment(assignment: KindAssignmentRecord): Promise<void> {
    setSaving(`kind-remove:${assignment.id}`);
    setError(null);
    try {
      await domainService.rpc<boolean>(NETIOR_RPC_METHODS.instanceUnassignKind, { assignmentId: assignment.id });
      if (propertyKindId === assignment.kind_id) setPropertyKindId('');
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function cycleKindAssignmentStatus(assignment: KindAssignmentRecord): Promise<void> {
    const next = nextAssignmentStatus(assignment.status);
    const method = next === 'accepted'
      ? NETIOR_RPC_METHODS.kindAssignmentAccept
      : next === 'rejected'
        ? NETIOR_RPC_METHODS.kindAssignmentReject
        : NETIOR_RPC_METHODS.kindAssignmentSupersede;
    setSaving(`kind-status:${assignment.id}`);
    setError(null);
    try {
      await domainService.rpc<KindAssignmentRecord>(method, { assignmentId: assignment.id });
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function linkResource(): Promise<void> {
    if (!instance || !resourceId) return;
    setSaving('resource');
    setError(null);
    try {
      await domainService.rpc<InstanceResourceLinkRecord>(NETIOR_RPC_METHODS.instanceLinkResource, {
        instanceId: instance.id,
        resourceId,
      });
      setResourceId('');
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function unlinkResource(link: InstanceResourceLinkRecord): Promise<void> {
    setSaving(`resource-unlink:${link.id}`);
    setError(null);
    try {
      await domainService.rpc<boolean>(NETIOR_RPC_METHODS.instanceUnlinkResource, { linkId: link.id });
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function cycleResourceStatus(resourceIdToUpdate: string, currentStatus: string): Promise<void> {
    setSaving(`resource-status:${resourceIdToUpdate}`);
    setError(null);
    try {
      await domainService.rpc(NETIOR_RPC_METHODS.resourceUpdateObservedStatus, {
        resourceId: resourceIdToUpdate,
        observedStatus: nextObservedStatus(currentStatus),
      });
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function registerAndLinkResource(): Promise<void> {
    if (!instance || !model?.root_id || !resourcePath) return;
    setSaving('resource-path');
    setError(null);
    try {
      const isFolder = visibleResourceItems.find((item) => item.relativePath === resourcePath)?.node.type === 'directory';
      const resource = await domainService.rpc<{ id: string }>(NETIOR_RPC_METHODS.resourceRegister, {
        rootId: model.root_id,
        sourceKind: isFolder ? 'folder' : 'file',
        relativePath: resourcePath,
        observedStatus: 'observed',
      });
      await domainService.rpc<InstanceResourceLinkRecord>(NETIOR_RPC_METHODS.instanceLinkResource, {
        instanceId: instance.id,
        resourceId: resource.id,
      });
      setResourcePath('');
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function createRelation(): Promise<void> {
    if (!instance || !relationKindId || !objectInstanceId) return;
    const nextSubjectKindId = currentAssignedKinds.length === 1 ? currentAssignedKinds[0].id : subjectKindId;
    const nextObjectKindId = selectedObjectKinds.length === 1 ? selectedObjectKinds[0].id : objectKindId;
    if (!nextSubjectKindId || !nextObjectKindId) {
      setError(t('domainEditor.relationKindIdentityRequired' as never));
      return;
    }
    setSaving('relation');
    setError(null);
    try {
      await domainService.rpc<RelationAssertionRecord>(NETIOR_RPC_METHODS.relationCreate, {
        subjectInstanceId: instance.id,
        subjectKindId: nextSubjectKindId,
        relationKindId,
        objectInstanceId,
        objectKindId: nextObjectKindId,
        status: 'accepted',
      });
      setRelationKindId('');
      setObjectInstanceId('');
      setSubjectKindId('');
      setObjectKindId('');
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  async function cycleRelationStatus(relation: RelationAssertionRecord): Promise<void> {
    const next = nextAssignmentStatus(relation.status);
    const method = next === 'accepted'
      ? NETIOR_RPC_METHODS.relationAccept
      : next === 'rejected'
        ? NETIOR_RPC_METHODS.relationReject
        : NETIOR_RPC_METHODS.relationSupersede;
    setSaving(`relation-status:${relation.id}`);
    setError(null);
    try {
      await domainService.rpc<RelationAssertionRecord>(method, { relationId: relation.id });
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  function editRelation(relation: RelationAssertionRecord): void {
    setRelationKindId(relation.relation_kind_id);
    setObjectInstanceId(relation.subject_instance_id === tab.targetId ? relation.object_instance_id : relation.subject_instance_id);
    setSubjectKindId(relation.subject_kind_id ?? '');
    setObjectKindId(relation.object_kind_id ?? '');
  }

  async function deleteRelation(relation: RelationAssertionRecord): Promise<void> {
    setSaving(`relation-delete:${relation.id}`);
    setError(null);
    try {
      await domainService.rpc<boolean>(NETIOR_RPC_METHODS.relationDelete, { relationId: relation.id });
      await refreshCurrentWorld();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  function renderPropertyInput(property: PropertyRecord): JSX.Element {
    const value = getPropertyDraft(property);
    if (property.value_type === 'number') {
      return <NumberInput value={typeof value === 'number' ? value : Number(value || 0)} onChange={(next) => setPropertyDraft(property.id, next)} />;
    }
    if (property.value_type === 'boolean') {
      return <Checkbox checked={Boolean(value)} onChange={(next) => setPropertyDraft(property.id, next)} />;
    }
    if (property.value_type === 'date') {
      return <Input type="date" value={String(value ?? '')} onChange={(event) => setPropertyDraft(property.id, event.target.value)} />;
    }
    if (property.value_type === 'datetime') {
      return <Input type="datetime-local" value={String(value ?? '')} onChange={(event) => setPropertyDraft(property.id, event.target.value)} />;
    }
    if (property.value_type === 'resource-ref') {
      return <Select options={resources.map((resource) => ({ value: resource.id, label: labelOfResource(resource) }))} value={String(value ?? '')} onChange={(event) => setPropertyDraft(property.id, event.target.value)} />;
    }
    if (property.value_type === 'text') {
      return <TextArea value={String(value ?? '')} onChange={(event) => setPropertyDraft(property.id, event.target.value)} />;
    }
    return <Input value={String(value ?? '')} onChange={(event) => setPropertyDraft(property.id, event.target.value)} />;
  }

  if (!draft && !instance) {
    return <EditorScroll><div className="text-sm text-muted">{t('domainEditor.instanceNotFound' as never)}</div></EditorScroll>;
  }

  return (
    <EditorScroll>
      <EditorHeader
        eyebrow={draft ? t('domainEditor.newInstance' as never) : t('domainEditor.instance' as never)}
        title={displayTitle}
        subtitle={draft ? t('domainEditor.newInstanceDescription' as never) : t('domainEditor.instanceEditorDescription' as never)}
      />
      <ErrorBanner message={error} />

      <div className="rounded-xl border border-subtle bg-surface-card p-4">
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-default">{t('domainEditor.basicInfo' as never)}</h3>
            <Field label={t('domainEditor.displayName' as never)}>
              <Input value={displayName} onChange={(event) => handleDisplayNameChange(event.target.value)} />
            </Field>
          </section>

          <section className="space-y-3 border-t border-subtle pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-default">{t('domainEditor.kinds' as never)}</h3>
              <span className="text-xs text-muted">{assignments.length}</span>
            </div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Field label={t('domainEditor.kind' as never)}>
                  <Select options={kindOptions} value={kindId} placeholder={t('domainEditor.selectKind' as never)} onChange={(event) => setKindId(event.target.value)} />
                </Field>
              </div>
              <div className="flex items-end">
                <Button size="sm" variant="secondary" isLoading={saving === 'kind'} disabled={Boolean(draft) || !kindId} onClick={() => void assignKind()}>
                  {t('common.assign')}
                </Button>
              </div>
            </div>
            {!draft && <div className="overflow-hidden rounded-lg border border-subtle bg-surface-input">
              {assignments.length > 0 ? assignments.map((assignment) => {
                const kind = kinds.find((item) => item.id === assignment.kind_id);
                return (
                  <div key={assignment.id} className="group flex items-center gap-3 border-b border-subtle px-3 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-default">{kind?.name ?? assignment.kind_id}</div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-state-hover hover:text-default"
                      onClick={() => void cycleKindAssignmentStatus(assignment)}
                    >
                      <RefreshCw size={11} />
                      {assignment.status}
                    </button>
                    <IconButton
                      label={t('common.delete' as never)}
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      disabled={saving === `kind-remove:${assignment.id}`}
                      onClick={() => void removeKindAssignment(assignment)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                );
              }) : (
                <div className="px-3 py-6 text-center text-xs text-muted">{t('domainEditor.noKindAssignmentsYet' as never)}</div>
              )}
            </div>}
          </section>

          <section className="space-y-3 border-t border-subtle pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-default">{t('domainEditor.properties' as never)}</h3>
              <span className="text-xs text-muted">{selectedKindProperties.length}</span>
            </div>
            <Field label={t('domainEditor.kind' as never)}>
              <Select
                options={assignedKindOptions}
                value={propertyKindId}
                placeholder={t('domainEditor.selectKind' as never)}
                onChange={(event) => setPropertyKindId(event.target.value)}
                disabled={Boolean(draft) || assignedKindOptions.length === 0}
              />
            </Field>
            {!draft && (
              <div className="space-y-3">
                {selectedKindProperties.length > 0 ? selectedKindProperties.map((property) => (
                  <div key={property.id} className="space-y-1.5">
                    <div className="text-xs font-medium text-secondary">
                      {property.name}
                      {isRequiredProperty(property) && <span className="ml-0.5 text-status-error">*</span>}
                    </div>
                    {renderPropertyInput(property)}
                    {propertyErrors[property.id] && (
                      <div className="text-xs text-status-error">{propertyErrors[property.id]}</div>
                    )}
                  </div>
                )) : (
                  <div className="py-3 text-xs text-muted">{t('domainEditor.noPropertiesYet' as never)}</div>
                )}
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-subtle pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-default">{t('domainEditor.resources' as never)}</h3>
              <span className="text-xs text-muted">{resourceLinks.length}</span>
            </div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Field label={t('domainEditor.resources' as never)}>
                  <Select options={resourceOptions} value={resourceId} onChange={(event) => setResourceId(event.target.value)} />
                </Field>
              </div>
              <div className="flex items-end">
                <Button size="sm" variant="secondary" isLoading={saving === 'resource'} disabled={Boolean(draft) || !resourceId} onClick={() => void linkResource()}>
                  {t('domainEditor.linkResource' as never)}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Field label={t('domainEditor.selectResourceFromTree' as never)}>
                  <ResourceTreeSelect
                    value={resourcePath}
                    items={visibleResourceItems}
                    expandedPaths={expandedResourcePaths}
                    placeholder={t('domainEditor.selectResourceFromTree' as never)}
                    emptyMessage={t('domainEditor.noResourcesYet' as never)}
                    onSelect={setResourcePath}
                    onToggle={toggleResourceNode}
                  />
                </Field>
              </div>
              <div className="flex items-end">
                <Button size="sm" variant="secondary" isLoading={saving === 'resource-path'} disabled={Boolean(draft) || !resourcePath} onClick={() => void registerAndLinkResource()}>
                  {t('domainEditor.linkResource' as never)}
                </Button>
              </div>
            </div>
            {!draft && <div className="overflow-hidden rounded-lg border border-subtle bg-surface-input">
              {resourceLinks.length > 0 ? resourceLinks.map((link) => {
                const resource = resources.find((item) => item.id === link.resource_id);
                const resourceLabel = resource ? labelOfResource(resource) : link.resource_id;
                return (
                  <div key={link.id} className="group flex items-center gap-3 border-b border-subtle px-3 py-2.5 last:border-b-0">
                    <FileIcon name={fileNameOf(resourceLabel)} isFolder={resource?.source_kind === 'folder'} size={15} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-default">{resourceLabel}</div>
                      {link.is_primary ? <div className="truncate text-xs text-muted">primary</div> : null}
                    </div>
                    {resource && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-state-hover hover:text-default"
                        onClick={() => void cycleResourceStatus(resource.id, resource.observed_status)}
                      >
                        <RefreshCw size={11} />
                        {resource.observed_status}
                      </button>
                    )}
                    <IconButton
                      label={t('common.remove' as never)}
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      disabled={saving === `resource-unlink:${link.id}`}
                      onClick={() => void unlinkResource(link)}
                    >
                      <X size={14} />
                    </IconButton>
                  </div>
                );
              }) : (
                <div className="px-3 py-6 text-center text-xs text-muted">{t('domainEditor.noLinkedResourcesYet' as never)}</div>
              )}
            </div>}
          </section>

          <section className="space-y-3 border-t border-subtle pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-default">{t('domainEditor.relations' as never)}</h3>
              <span className="text-xs text-muted">{relations.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('domainEditor.relationKind' as never)}>
                <Select options={relationKindOptions} value={relationKindId} onChange={(event) => setRelationKindId(event.target.value)} disabled={Boolean(draft)} />
              </Field>
              {currentAssignedKinds.length > 1 ? (
                <Field label={t('domainEditor.subjectIdentityKind' as never)}>
                  <Select options={subjectKindOptions} value={subjectKindId} onChange={(event) => setSubjectKindId(event.target.value)} disabled={Boolean(draft)} />
                </Field>
              ) : <div />}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('domainEditor.targetInstance' as never)}>
                <Select options={targetInstanceOptions} value={objectInstanceId} onChange={(event) => setObjectInstanceId(event.target.value)} disabled={Boolean(draft)} />
              </Field>
              <Field label={t('domainEditor.objectIdentityKind' as never)}>
                {selectedObjectKinds.length > 1 ? (
                  <Select options={objectKindOptions} value={objectKindId} onChange={(event) => setObjectKindId(event.target.value)} disabled={Boolean(draft)} />
                ) : (
                  <ReadonlySelectValue value={selectedObjectKinds[0]?.name ?? ''} />
                )}
              </Field>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                isLoading={saving === 'relation'}
                disabled={Boolean(draft) || !relationKindId || !objectInstanceId}
                onClick={() => void createRelation()}
              >
                {t('domainEditor.addRelation' as never)}
              </Button>
            </div>
            {!draft && <div className="overflow-hidden rounded-lg border border-subtle bg-surface-input">
              {relations.length > 0 ? relations.map((relation) => {
                const relationKind = relationKinds.find((item) => item.id === relation.relation_kind_id) ?? snapshot?.relationKinds.find((item) => item.id === relation.relation_kind_id);
                const subject = snapshot?.instances.find((item) => item.id === relation.subject_instance_id);
                const object = snapshot?.instances.find((item) => item.id === relation.object_instance_id);
                return (
                  <div key={relation.id} className="group flex items-center gap-3 border-b border-subtle px-3 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-default">
                        {subject?.display_name ?? relation.subject_instance_id} -- {relationKind?.name ?? relation.relation_kind_id} -- {object?.display_name ?? relation.object_instance_id}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-state-hover hover:text-default"
                      onClick={() => void cycleRelationStatus(relation)}
                    >
                      <RefreshCw size={11} />
                      {relation.status}
                    </button>
                    <IconButton
                      label={t('common.edit' as never)}
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => editRelation(relation)}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label={t('common.delete' as never)}
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      disabled={saving === `relation-delete:${relation.id}`}
                      onClick={() => void deleteRelation(relation)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                );
              }) : (
                <div className="px-3 py-6 text-center text-xs text-muted">{t('domainEditor.noRelationsYet' as never)}</div>
              )}
            </div>}
          </section>
        </div>

        <div className="mt-6 flex justify-end border-t border-subtle pt-4">
          <Button size="sm" isLoading={saving === 'name'} disabled={!isDirty || !displayName.trim()} onClick={() => void saveName()}>
            {t('domainEditor.save' as never)}
          </Button>
        </div>
      </div>
    </EditorScroll>
  );
}
