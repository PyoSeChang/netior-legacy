import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from '@netior/shared/i18n';
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Eye,
  EyeOff,
  Layers3,
  Plus,
  Trash2,
  Waypoints,
} from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';
import { useWorldStore } from '../../stores/world-store';
import { useInstanceStore } from '../../stores/instance-store';
import { useNetworkStore } from '../../stores/network-store';
import { useMeaningStore } from '../../stores/meaning-store';
import { useContextStore } from '../../stores/context-store';
import { useEditorStore } from '../../stores/editor-store';
import { useNetworkObjectSelectionStore } from '../../stores/network-object-selection-store';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { getIconComponent } from '../ui/lucide-utils';
import { NodeVisual } from '../workspace/node-components/NodeVisual';
import { openNetworkViewerTab } from '../../lib/open-network-viewer-tab';
import { createOntologyDisplayResolver } from '@netior/shared';

type PanelObjectType = 'instance' | 'network' | 'meaning' | 'context';

interface ObjectPanelProps {
  types?: PanelObjectType[];
}

type PanelItem =
  {
    id: string;
    kind: 'object';
    objectType: PanelObjectType;
    title: string;
    subtitle: string;
    color?: string | null;
    isActive?: boolean;
    iconName?: string | null;
    networkKind?: string;
  };

type PanelRow = {
  key: string;
  depth: number;
  item: PanelItem;
};

type PanelSection = {
  objectType: PanelObjectType;
  label: string;
  totalRows: number;
  rows: PanelRow[];
};

type ContextMenuState = {
  x: number;
  y: number;
  row: PanelRow | null;
};

const FILTERS: Array<{ key: PanelObjectType; icon: React.ElementType; labelKey: TranslationKey | string }> = [
  { key: 'instance', icon: CircleDot, labelKey: 'objectPanel.instance' },
  { key: 'network', icon: Waypoints, labelKey: 'sidebar.networks' },
  { key: 'meaning', icon: Boxes, labelKey: 'meaning.title' },
  { key: 'context', icon: Layers3, labelKey: 'context.title' },
];

function getSelectionRange(rows: PanelRow[], anchorKey: string | null, targetKey: string): string[] {
  const anchorIndex = anchorKey ? rows.findIndex((row) => row.key === anchorKey) : -1;
  const targetIndex = rows.findIndex((row) => row.key === targetKey);
  if (targetIndex === -1) return [targetKey];
  const start = anchorIndex === -1 ? targetIndex : Math.min(anchorIndex, targetIndex);
  const end = anchorIndex === -1 ? targetIndex : Math.max(anchorIndex, targetIndex);
  return rows.slice(start, end + 1).map((row) => row.key);
}

function buildObjectRows<T extends { id: string; name: string }>(
  objectType: PanelObjectType,
  items: T[],
  mapItem: (item: T) => Omit<Extract<PanelItem, { kind: 'object' }>, 'id' | 'kind' | 'objectType'>,
): PanelRow[] {
  return [...items]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => {
      const mapped = mapItem(item);
      return {
        key: `object:${objectType}:${item.id}`,
        depth: 0,
        item: {
          ...mapped,
          id: item.id,
          kind: 'object',
          objectType,
        },
      };
    });
}

function ObjectTypeFilterSelect({
  selectedTypes,
  onChange,
  labelFor,
  allLabel,
}: {
  selectedTypes: PanelObjectType[];
  onChange: (next: PanelObjectType[]) => void;
  labelFor: (type: PanelObjectType) => string;
  allLabel: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPos = useAnchoredDropdown(open, rootRef, {
    estimatedHeight: 190,
    minWidth: 192,
  }, dropdownRef);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleWindowBlur = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [open]);

  const summary = selectedTypes.length === FILTERS.length
    ? allLabel
    : selectedTypes.length === 1
      ? labelFor(selectedTypes[0])
      : `${selectedTypes.length}`;
  const toggleType = (type: PanelObjectType) => {
    const selected = selectedTypes.includes(type);
    const next = selected
      ? selectedTypes.filter((selectedType) => selectedType !== type)
      : [...selectedTypes, type];
    onChange(next.length === 0 ? FILTERS.map((item) => item.key) : next);
  };

  return (
    <div className="shrink-0" ref={rootRef}>
      <button
        type="button"
        className="flex h-7 w-16 items-center justify-between rounded border border-input bg-surface-input px-2 text-xs text-default transition-colors hover:border-strong"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed rounded-md border border-default bg-surface-floating p-1 shadow-lg"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
            visibility: dropdownPos.ready ? 'visible' : 'hidden',
            zIndex: 10001,
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {FILTERS.map((filter) => {
            const Icon = filter.icon;
            const selected = selectedTypes.includes(filter.key);
            return (
              <div
                key={filter.key}
                role="menuitemcheckbox"
                aria-checked={selected}
                tabIndex={0}
                className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-default transition-colors hover:bg-state-hover"
                onClick={() => toggleType(filter.key)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  toggleType(filter.key);
                }}
              >
                <div onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={selected} onChange={() => toggleType(filter.key)} />
                </div>
                <Icon size={14} className="shrink-0 text-secondary" />
                <span className="min-w-0 flex-1 truncate">{labelFor(filter.key)}</span>
              </div>
            );
          })}
        </div>
      , document.body)}
    </div>
  );
}

export function ObjectPanel({ types }: ObjectPanelProps = {}): JSX.Element {
  const { t } = useI18n();
  const display = useMemo(() => createOntologyDisplayResolver(t), [t]);
  const tk = (key: string) => t(key as TranslationKey);
  const currentWorld = useWorldStore((state) => state.currentWorld);
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const networks = useNetworkStore((state) => state.networks);
  const instances = useInstanceStore((state) => state.instances);
  const meanings = useMeaningStore((state) => state.meanings);
  const contexts = useContextStore((state) => state.contexts);
  const activeContextId = useContextStore((state) => state.activeContextId);
  const loadContexts = useContextStore((state) => state.loadContexts);
  const createContext = useContextStore((state) => state.createContext);
  const deleteContext = useContextStore((state) => state.deleteContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const createMeaning = useMeaningStore((state) => state.createMeaning);
  const deleteMeaning = useMeaningStore((state) => state.deleteMeaning);
  const deleteInstance = useInstanceStore((state) => state.deleteInstance);
  const createNetwork = useNetworkStore((state) => state.createNetwork);
  const deleteNetwork = useNetworkStore((state) => state.deleteNetwork);
  const openNetwork = useNetworkStore((state) => state.openNetwork);
  const loadNetworkTree = useNetworkStore((state) => state.loadNetworkTree);
  const networkObjectSelection = useNetworkObjectSelectionStore((state) => state.selection);
  const selectedNetworkObjects = useNetworkObjectSelectionStore((state) => state.selectedItems);
  const setNetworkObjectSelection = useNetworkObjectSelectionStore((state) => state.setSelection);
  const setNetworkObjectSelectionState = useNetworkObjectSelectionStore((state) => state.setSelectionState);
  const [selectedTypes, setSelectedTypes] = useState<PanelObjectType[]>(() => FILTERS.map((filter) => filter.key));
  const activeTypes = types ?? selectedTypes;
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<PanelObjectType>>(() => new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [selectionAnchorKey, setSelectionAnchorKey] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!currentNetwork) return;
    loadContexts(currentNetwork.id);
  }, [currentNetwork?.id, loadContexts]);

  const labelForType = (type: PanelObjectType): string => {
    const match = FILTERS.find((filter) => filter.key === type);
    return match ? t(match.labelKey as TranslationKey) : type;
  };

  const instanceRows = useMemo<PanelRow[]>(() => (
    [...instances].sort((a, b) => a.title.localeCompare(b.title)).map((instance) => ({
      key: `object:instance:${instance.id}`,
      depth: 0,
      item: {
        id: instance.id,
        kind: 'object',
        objectType: 'instance',
        title: instance.title,
        subtitle: instance.schema_id
          ? (() => {
            const meaning = meanings.find((item) => item.id === instance.schema_id);
            return meaning ? display.meaningName(meaning) : t('objectPanel.instance' as TranslationKey);
          })()
          : t('objectPanel.instance' as TranslationKey),
        color: instance.color,
        iconName: instance.icon,
      },
    }))
  ), [instances, meanings]);

  const networkRows = useMemo<PanelRow[]>(() => (
    [...networks].sort((a, b) => a.name.localeCompare(b.name)).map((network) => ({
      key: `object:network:${network.id}`,
      depth: 0,
      item: {
        id: network.id,
        kind: 'object',
        objectType: 'network',
        title: network.name,
        subtitle: network.kind === 'root' || network.kind === 'universe' ? t('sidebar.rootNetwork') : 'Network',
        isActive: currentNetwork?.id === network.id,
        networkKind: network.kind,
      },
    }))
  ), [networks, currentNetwork?.id, t]);

  const modelRows = useMemo<PanelRow[]>(() => (
    buildObjectRows(
      'meaning',
      [...meanings].sort((a, b) => display.meaningName(a).localeCompare(display.meaningName(b))),
      (meaning) => ({
        title: display.meaningName(meaning),
        subtitle: display.meaningDescription(meaning)
          ?? (meaning.category_instance_source_ref
            ? display.name({
              kind: 'instance',
              title: meaning.category_instance_title ?? meaning.category_instance_source_ref,
              source_ref: meaning.category_instance_source_ref,
            })
            : meaning.category_instance_title)
          ?? t('meaning.title' as TranslationKey),
        color: meaning.color,
        iconName: meaning.icon,
      }),
    )
  ), [display, meanings, t]);

  const contextRows = useMemo<PanelRow[]>(() => (
    [...contexts].sort((a, b) => a.name.localeCompare(b.name)).map((context) => ({
      key: `object:context:${context.id}`,
      depth: 0,
      item: {
        id: context.id,
        kind: 'object',
        objectType: 'context',
        title: context.name,
        subtitle: currentNetwork ? currentNetwork.name : t('context.title'),
        isActive: activeContextId === context.id,
      },
    }))
  ), [contexts, currentNetwork, activeContextId, t]);

  const sections = useMemo<PanelSection[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const rowsByType: Record<PanelObjectType, PanelRow[]> = {
      instance: instanceRows,
      network: networkRows,
      meaning: modelRows,
      context: contextRows,
    };

    return activeTypes.map((type) => ({
      objectType: type,
      label: labelForType(type),
      totalRows: rowsByType[type].length,
      rows: rowsByType[type].filter((row) => {
        if (!normalizedSearch) return true;
        return row.item.title.toLowerCase().includes(normalizedSearch)
          || row.item.subtitle.toLowerCase().includes(normalizedSearch);
      }),
    }));
  }, [activeTypes, search, instanceRows, networkRows, modelRows, contextRows]);

  const hasSearch = search.trim().length > 0;
  const visibleRows = useMemo(() => sections.flatMap((section) => {
    if (hasSearch || !collapsedSections.has(section.objectType)) return section.rows;
    return [];
  }), [collapsedSections, hasSearch, sections]);
  const rowByKey = useMemo(() => new Map(visibleRows.map((row) => [row.key, row])), [visibleRows]);
  const primaryType = activeTypes.length === 1 ? activeTypes[0] : null;
  const canCreateObject = primaryType !== null && !(primaryType === 'context' && !currentNetwork);
  const canCreateObjectType = (objectType: PanelObjectType): boolean => (
    objectType !== 'context' || currentNetwork !== null
  );

  useEffect(() => {
    if (visibleRows.length === 0) {
      setSelectedKeys(new Set());
      setSelectionAnchorKey(null);
      setFocusedKey(null);
      return;
    }

    const visibleKeySet = new Set(visibleRows.map((row) => row.key));
    setSelectedKeys((prev) => new Set([...prev].filter((key) => visibleKeySet.has(key))));
    if (!focusedKey || !visibleKeySet.has(focusedKey)) {
      setFocusedKey(visibleRows[0].key);
    }
  }, [visibleRows, focusedKey]);

  useEffect(() => {
    if (selectedNetworkObjects.length === 0 && !networkObjectSelection) return;
    const keys = new Set(
      selectedNetworkObjects
        .map((item) => `object:${item.objectType}:${item.id}`)
        .filter((key) => rowByKey.has(key)),
    );
    const focusedSelection = networkObjectSelection
      ? `object:${networkObjectSelection.objectType}:${networkObjectSelection.id}`
      : null;
    if (keys.size === 0 && focusedSelection && rowByKey.has(focusedSelection)) {
      keys.add(focusedSelection);
    }
    if (keys.size === 0) return;
    setSelectedKeys(keys);
    if (focusedSelection && rowByKey.has(focusedSelection)) {
      setSelectionAnchorKey(focusedSelection);
      setFocusedKey(focusedSelection);
      return;
    }
    const firstKey = [...keys][0];
    setSelectionAnchorKey(firstKey);
    setFocusedKey(firstKey);
  }, [networkObjectSelection, rowByKey, selectedNetworkObjects]);

  useEffect(() => {
    const selectedRows = [...selectedKeys]
      .map((key) => rowByKey.get(key))
      .filter((row): row is PanelRow => row?.item.kind === 'object');
    const selectedItems = selectedRows.map((row) => ({
      objectType: row.item.objectType,
      id: row.item.id,
      title: row.item.title,
    }));
    const focusedRow = focusedKey ? rowByKey.get(focusedKey) : undefined;
    const focusedSelection = focusedRow?.item.kind === 'object'
      ? {
          objectType: focusedRow.item.objectType,
          id: focusedRow.item.id,
          title: focusedRow.item.title,
        }
      : selectedItems[0] ?? null;
    setNetworkObjectSelectionState({
      selection: focusedSelection,
      selectedItems,
    });
  }, [focusedKey, rowByKey, selectedKeys, setNetworkObjectSelectionState]);

  useEffect(() => {
    if (!focusedKey) return;
    rowRefs.current.get(focusedKey)?.scrollIntoView({ block: 'nearest' });
  }, [focusedKey]);

  const openItem = async (item: Extract<PanelItem, { kind: 'object' }>) => {
    switch (item.objectType) {
      case 'instance':
        await useEditorStore.getState().openTab({ type: 'instance', targetId: item.id, title: item.title });
        break;
      case 'network':
        await openNetwork(item.id);
        await openNetworkViewerTab({ networkId: item.id, title: item.title, rootNetworkId: currentWorld?.id ?? null });
        break;
      case 'meaning':
        await useEditorStore.getState().openTab({ type: 'meaning', targetId: item.id, title: item.title, rootNetworkId: currentWorld?.id });
        break;
      case 'context':
        await useEditorStore.getState().openTab({ type: 'context', targetId: item.id, title: item.title });
        break;
    }
  };

  const expandSection = (objectType: PanelObjectType) => {
    setCollapsedSections((prev) => {
      if (!prev.has(objectType)) return prev;
      const next = new Set(prev);
      next.delete(objectType);
      return next;
    });
  };

  const toggleSection = (objectType: PanelObjectType) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(objectType)) next.delete(objectType);
      else next.add(objectType);
      return next;
    });
  };

  const handleCreateObject = async (objectType: PanelObjectType | null = primaryType) => {
    if (!currentWorld || !objectType || !canCreateObjectType(objectType)) return;
    expandSection(objectType);
    switch (objectType) {
      case 'instance': {
        const draftId = `draft-${Date.now()}`;
        await useEditorStore.getState().openTab({
          type: 'instance',
          targetId: draftId,
          title: t('instance.defaultTitle'),
          draftData: currentNetwork ? { networkId: currentNetwork.id } : {},
        });
        break;
      }
      case 'network': {
        const created = await createNetwork({
          root_network_id: currentWorld.id,
          name: t('network.defaultName'),
        });
        await loadNetworkTree(currentWorld.id);
        await openNetwork(created.id);
        await openNetworkViewerTab({
          networkId: created.id,
          title: created.name,
          rootNetworkId: currentWorld.id,
          isDirty: true,
        });
        break;
      }
      case 'meaning': {
        const created = await createMeaning({ root_network_id: currentWorld.id, name: t('meaning.newDefault' as never) });
        await useEditorStore.getState().openTab({ type: 'meaning', targetId: created.id, title: created.name, rootNetworkId: currentWorld.id, isDirty: true });
        break;
      }
      case 'context': {
        if (!currentNetwork) return;
        const created = await createContext({ network_id: currentNetwork.id, name: t('context.newDefault') });
        await useEditorStore.getState().openTab({ type: 'context', targetId: created.id, title: created.name, isDirty: true });
        break;
      }
    }
  };
  const handleDeleteItem = async (item: PanelItem) => {
    switch (item.objectType) {
      case 'instance':
        await deleteInstance(item.id);
        break;
      case 'network':
        await deleteNetwork(item.id);
        if (currentWorld) await loadNetworkTree(currentWorld.id);
        break;
      case 'meaning':
        await deleteMeaning(item.id);
        break;
      case 'context':
        await deleteContext(item.id);
        break;
    }
  };

  const selectRow = (event: React.MouseEvent, row: PanelRow) => {
    setNetworkObjectSelection({
      objectType: row.item.objectType,
      id: row.item.id,
      title: row.item.title,
    });
    if (event.shiftKey) {
      setSelectedKeys(new Set(getSelectionRange(visibleRows, selectionAnchorKey ?? focusedKey, row.key)));
      setFocusedKey(row.key);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(row.key)) next.delete(row.key);
        else next.add(row.key);
        return next;
      });
      setFocusedKey(row.key);
      setSelectionAnchorKey(row.key);
      return;
    }
    setSelectedKeys(new Set([row.key]));
    setFocusedKey(row.key);
    setSelectionAnchorKey(row.key);
  };

  const focusRowByKey = useCallback((key: string, extend = false) => {
    const row = rowByKey.get(key);
    if (!row) return;
    setNetworkObjectSelection({
      objectType: row.item.objectType,
      id: row.item.id,
      title: row.item.title,
    });
    setFocusedKey(key);
    if (extend) {
      setSelectedKeys(new Set(getSelectionRange(visibleRows, selectionAnchorKey ?? focusedKey, key)));
      return;
    }
    setSelectedKeys(new Set([key]));
    setSelectionAnchorKey(key);
  }, [focusedKey, rowByKey, selectionAnchorKey, setNetworkObjectSelection, visibleRows]);

  const openRow = useCallback(async (row: PanelRow | undefined) => {
    if (!row) return;
    await openItem(row.item);
  }, [openItem]);

  const deleteRows = useCallback(async (rows: PanelRow[]) => {
    for (const row of rows) {
      await handleDeleteItem(row.item);
    }
    setNetworkObjectSelection(null);
  }, [handleDeleteItem, setNetworkObjectSelection]);

  const activeRow = contextMenu?.row;
  const activeSelection = activeRow && selectedKeys.has(activeRow.key)
    ? [...selectedKeys].map((key) => rowByKey.get(key)).filter((row): row is PanelRow => row !== undefined)
    : activeRow ? [activeRow] : [];

  const contextMenuItems: ContextMenuEntry[] = useMemo(() => {
    if (!contextMenu) return [];
    if (!activeRow) {
      const items: ContextMenuEntry[] = [];
      if (canCreateObject) {
        items.push({ label: t('common.create'), icon: <Plus size={14} />, onClick: () => { void handleCreateObject(); } });
      }
      return items;
    }

    const objectItem = activeRow.item;

    return [
      {
        label: objectItem.objectType === 'network' ? t('common.open') : t('editor.openInEditor'),
        icon: <ExternalLink size={14} />,
        onClick: () => { void openItem(objectItem); },
      },
      ...(objectItem.objectType === 'context'
        ? [{
            label: objectItem.isActive ? tk('context.deactivate') : tk('context.activate'),
            icon: objectItem.isActive ? <EyeOff size={14} /> : <Eye size={14} />,
            onClick: () => setActiveContext(objectItem.isActive ? null : objectItem.id),
          } satisfies ContextMenuEntry]
        : []),
      { type: 'divider' as const },
      {
        label: activeSelection.length > 1 ? `${t('common.delete')} (${activeSelection.length})` : t('common.delete'),
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: async () => {
          await deleteRows(activeSelection);
        },
      },
    ];
  }, [
    contextMenu,
    activeRow,
    activeSelection,
    canCreateObject,
    t,
    tk,
    setActiveContext,
    deleteRows,
  ]);

  const renderLeadingVisual = (row: PanelRow) => {
    if (row.item.objectType === 'instance' && row.item.iconName) {
      return <NodeVisual icon={row.item.iconName} size={14} imageSize={18} className="shrink-0" />;
    }
    if (row.item.objectType === 'meaning' && row.item.iconName) {
      return <NodeVisual icon={row.item.iconName} size={14} imageSize={18} className="shrink-0" />;
    }
    if (row.item.color) {
      return <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.item.color }} />;
    }
    switch (row.item.objectType) {
      case 'instance':
        return <CircleDot size={14} className="shrink-0 text-secondary" />;
      case 'network':
        if (row.item.networkKind === 'root') {
          return <Boxes size={14} className="shrink-0 text-secondary" />;
        }
        return <Waypoints size={14} className="shrink-0 text-secondary" />;
      case 'meaning':
        return <Boxes size={14} className="shrink-0 text-secondary" />;
      case 'context':
        return <Layers3 size={14} className="shrink-0 text-secondary" />;
    }
  };

  return (
    <div
      ref={panelRef}
      className="flex h-full flex-col gap-2 p-2 outline-none"
      onMouseDown={() => panelRef.current?.focus()}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
        if (visibleRows.length === 0) return;

        const currentIndex = focusedKey ? visibleRows.findIndex((row) => row.key === focusedKey) : -1;
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const nextIndex = Math.min(visibleRows.length - 1, safeIndex + 1);
          focusRowByKey(visibleRows[nextIndex].key, event.shiftKey);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const nextIndex = Math.max(0, safeIndex - 1);
          focusRowByKey(visibleRows[nextIndex].key, event.shiftKey);
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          void openRow(focusedKey ? rowByKey.get(focusedKey) : visibleRows[0]);
          return;
        }

        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedKeys.size > 0) {
          event.preventDefault();
          const rows = [...selectedKeys]
            .map((key) => rowByKey.get(key))
            .filter((row): row is PanelRow => row !== undefined);
          void deleteRows(rows);
          return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
          event.preventDefault();
          setSelectedKeys(new Set(visibleRows.map((row) => row.key)));
          const firstObjectRow = visibleRows.find((row) => row.item.kind === 'object');
          if (firstObjectRow) {
            setNetworkObjectSelection({
              objectType: firstObjectRow.item.objectType,
              id: firstObjectRow.item.id,
              title: firstObjectRow.item.title,
            });
            setFocusedKey(firstObjectRow.key);
            setSelectionAnchorKey(firstObjectRow.key);
          }
        }
      }}
      onContextMenu={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, row: null });
      }}
      tabIndex={0}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-xs font-medium text-secondary">
          {primaryType ? labelForType(primaryType) : tk('sidebar.networkObjects')}
        </span>
        {!types && (
          <ObjectTypeFilterSelect
            selectedTypes={selectedTypes}
            onChange={setSelectedTypes}
            labelFor={labelForType}
            allLabel={tk('objectPanel.allTypes')}
          />
        )}
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('sidebar.search')}
        className="w-full rounded border border-input bg-surface-input px-2.5 py-1.5 text-xs text-default outline-none focus:border-accent"
      />

      {activeTypes.length === 1 && activeTypes[0] === 'context' && currentNetwork && (
        <div className="rounded border border-subtle bg-surface-card px-2.5 py-1.5 text-[11px] text-muted">
          {currentNetwork.name}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {sections.map((section) => {
          const isSectionCollapsed = !hasSearch && collapsedSections.has(section.objectType);
          return (
            <div
              key={section.objectType}
              className="rounded border border-transparent"
            >
              <div className="flex items-center gap-1 px-2 py-1">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] font-medium uppercase tracking-wide text-secondary transition-colors hover:bg-state-hover hover:text-default"
                  onClick={() => toggleSection(section.objectType)}
                  aria-expanded={!isSectionCollapsed}
                >
                  {isSectionCollapsed ? <ChevronRight size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
                  <span className="truncate">{section.label}</span>
                </button>
                <div className="flex items-center gap-1">
                  {canCreateObjectType(section.objectType) && (
                    <button
                      type="button"
                      className="rounded p-1 text-muted transition-colors hover:bg-state-hover hover:text-default"
                      onClick={() => { void handleCreateObject(section.objectType); }}
                      title={t('common.create')}
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              </div>
              {!isSectionCollapsed && (
                <>
                  <div className="flex flex-col gap-0.5">
                    {section.rows.map((row) => {
                      const isSelected = selectedKeys.has(row.key);
                      const isFocused = focusedKey === row.key;
                      const rowIsActive = row.item.isActive ?? false;
                      const contextItem = row.item.objectType === 'context' ? row.item : null;
                      return (
                        <React.Fragment key={row.key}>
                          <div
                            ref={(element) => {
                              if (element) rowRefs.current.set(row.key, element);
                              else rowRefs.current.delete(row.key);
                            }}
                            className={`group flex items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                              isSelected
                                ? 'bg-state-selected text-accent'
                                : rowIsActive
                                  ? 'bg-accent-muted/60 text-accent'
                                  : 'hover:bg-state-hover'
                            } ${isFocused && !isSelected ? 'ring-1 ring-border-default' : ''}`}
                            style={{ paddingLeft: `${8 + row.depth * 16}px` }}
                            onClick={(event) => {
                              selectRow(event, row);
                            }}
                            onDoubleClick={() => {
                              void openItem(row.item);
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (!selectedKeys.has(row.key)) {
                                setSelectedKeys(new Set([row.key]));
                                setSelectionAnchorKey(row.key);
                              }
                              setNetworkObjectSelection({
                                objectType: row.item.objectType,
                                id: row.item.id,
                                title: row.item.title,
                              });
                              setFocusedKey(row.key);
                              setContextMenu({ x: event.clientX, y: event.clientY, row });
                            }}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              {renderLeadingVisual(row)}
                              <div className="min-w-0 flex-1">
                                <div className={`truncate text-sm ${rowIsActive || isSelected ? 'text-accent' : 'text-default'}`}>
                                  {row.item.title}
                                </div>
                                <div className="truncate text-[11px] text-muted">{row.item.subtitle}</div>
                              </div>
                            </div>
                            {contextItem && (
                              <button
                                type="button"
                                className={`rounded p-1 transition-colors ${
                                  contextItem.isActive
                                    ? 'text-accent'
                                    : 'text-muted opacity-0 group-hover:opacity-100 hover:text-default'
                                }`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveContext(contextItem.isActive ? null : contextItem.id);
                                }}
                                title={contextItem.isActive ? tk('context.deactivate') : tk('context.activate')}
                              >
                                {contextItem.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {section.rows.length === 0 && (
                      <div className="mx-2 rounded border border-dashed border-subtle px-2.5 py-2 text-[11px] text-muted">
                        {hasSearch && section.totalRows > 0
                          ? tk('objectPanel.noSearchResults')
                          : t('common.none' as TranslationKey)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

    </div>
  );
}
