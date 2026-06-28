// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Boxes,
  FileText,
  Link as LinkIcon,
  Lightbulb,
  Minus,
  Network,
  Paperclip,
  Search,
  Shapes,
  Stamp,
} from 'lucide-react';
import { narreService, type MentionResult } from '../../../services/narre-service';
import { useI18n } from '../../../hooks/useI18n';
import { Spinner } from '../../ui/Spinner';
import type { TranslationKey } from '@netior/shared/i18n';
import type { Meaning, MeaningRefKey } from '@netior/shared/types';
import { logShortcut } from '../../../shortcuts/shortcut-utils';
import { createOntologyDisplayResolver } from '@netior/shared';

interface NarreMentionPickerProps {
  query: string;
  rootNetworkId: string;
  position: { bottom: number; left: number };
  initialCategory?: string;
  agentMentions?: MentionResult[];
  onSelect: (mention: MentionResult) => void;
  onClose: () => void;
}

const MENTION_CATEGORIES = [
  { key: 'all', i18nKey: 'narre.mentionAll' },
  { key: 'instance', i18nKey: 'narre.mentionInstance' },
  { key: 'network', i18nKey: 'narre.mentionNetwork' },
  { key: 'schema', i18nKey: 'narre.mentionSchema' },
  { key: 'meaning', i18nKey: 'narre.mentionMeaning' },
  { key: 'file', i18nKey: 'narre.mentionFile' },
  { key: 'agent', i18nKey: 'narre.mentionAgent' },
] as const;

const PICKER_MIN_HEIGHT = 280;

const ICONS = {
  bot: Bot,
  stamp: Stamp,
  'badge-check': BadgeCheck,
  paperclip: Paperclip,
  link: LinkIcon,
  instance: Lightbulb,
  meaning: Boxes,
  schema: Shapes,
  network: Network,
  file: FileText,
} as const;

type LucideIconComponent = React.ElementType<{ size?: number | string; className?: string }>;

function toLucideExportName(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => (
      part === 'az' || part === 'za'
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1)
    ))
    .join('');
}

function resolveIcon(icon: string | null | undefined, type: string): LucideIconComponent | null {
  const explicit = icon ? ICONS[icon as keyof typeof ICONS] : null;
  if (explicit) return explicit;

  const fallback = ICONS[type as keyof typeof ICONS] ?? null;
  if (!icon) return fallback;

  const candidate = (LucideIcons as Record<string, unknown>)[toLucideExportName(icon)];
  return typeof candidate === 'function' ? candidate as LucideIconComponent : fallback;
}

function isImageSource(value: string): boolean {
  return /^(https?:|file:|data:image\/)/i.test(value);
}

function MentionIcon({ icon, type }: { icon?: string | null; type: string }): JSX.Element | null {
  if (icon && isImageSource(icon)) {
    return <img src={icon} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />;
  }

  const Icon = resolveIcon(icon, type);
  if (Icon) return <Icon size={14} className="shrink-0 text-muted" />;
  return icon ? <span className="shrink-0 text-sm">{icon}</span> : null;
}

function stringMeta(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  return typeof value === 'string' ? value : null;
}

function toMeaningDisplaySource(item: MentionResult): Pick<Meaning, 'key' | 'name' | 'description' | 'source_kind' | 'source_ref'> | null {
  const name = stringMeta(item.meta, 'name') ?? item.display;
  const key = stringMeta(item.meta, 'key') ?? name;
  return {
    key: key as MeaningRefKey,
    name,
    description: item.description ?? null,
    source_kind: stringMeta(item.meta, 'sourceKind') as Meaning['source_kind'] ?? 'world',
    source_ref: stringMeta(item.meta, 'sourceRef'),
  };
}

function localizeMentionResult(
  item: MentionResult,
  display: ReturnType<typeof createOntologyDisplayResolver>,
): MentionResult {
  if (item.type === 'meaning') {
    const meaning = toMeaningDisplaySource(item);
    if (!meaning) return item;
    return {
      ...item,
      display: display.meaningName(meaning),
      description: display.meaningDescription(meaning),
    };
  }

  if (item.type === 'instance' && stringMeta(item.meta, 'schema')) {
    const schemaName = stringMeta(item.meta, 'schema') ?? '';
    return {
      ...item,
      meta: {
        ...item.meta,
        schema: schemaName,
      },
    };
  }

  if (item.type === 'instance' && stringMeta(item.meta, 'meaning')) {
    const meaning = {
      key: (stringMeta(item.meta, 'meaningKey') ?? stringMeta(item.meta, 'meaning') ?? '') as MeaningRefKey,
      name: stringMeta(item.meta, 'meaning') ?? '',
      description: stringMeta(item.meta, 'meaningDescription'),
      source_kind: stringMeta(item.meta, 'meaningSourceKind') as Meaning['source_kind'] ?? 'world',
      source_ref: stringMeta(item.meta, 'meaningSourceRef'),
    };
    return {
      ...item,
      meta: {
        ...item.meta,
        meaning: display.meaningName(meaning),
      },
    };
  }

  return item;
}

function PreviewPanel({ item, t }: { item: MentionResult; t: (key: TranslationKey) => string }): JSX.Element {
  const catLabel = MENTION_CATEGORIES.find((c) => c.key === item.type)?.i18nKey;
  const instanceSchema = item.type === 'instance' && typeof item.meta?.schema === 'string' ? item.meta.schema : null;
  const instanceMeaning = item.type === 'instance' && typeof item.meta?.meaning === 'string' ? item.meta.meaning : null;
  const meaningDirected = item.type === 'meaning' && typeof item.meta?.directed === 'boolean' ? item.meta.directed : null;
  const meaningLineStyle = item.type === 'meaning' && typeof item.meta?.lineStyle === 'string' ? item.meta.lineStyle : null;
  const filePath = item.type === 'file' && typeof item.meta?.path === 'string' ? item.meta.path : null;

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MentionIcon icon={item.icon} type={item.type} />
        {item.color && (
          <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        )}
        <span className="text-xs font-medium text-default truncate">{item.display}</span>
      </div>

      {/* Type badge */}
      <span className="inline-flex self-start rounded px-1.5 py-0.5 text-[10px] font-medium bg-state-selected text-accent">
        {catLabel ? t(catLabel as TranslationKey) : item.type}
      </span>

      {/* Description */}
      {item.description && (
        <p className="text-[11px] text-secondary leading-relaxed">{item.description}</p>
      )}

      {/* Type-specific meta */}
      {item.meta && (
        <div className="flex flex-col gap-1 text-[10px] text-muted">
          {instanceSchema && (
            <div className="flex items-center gap-1">
              <span className="text-secondary">Schema:</span>
              <span className="text-default">{instanceSchema}</span>
            </div>
          )}
          {instanceMeaning && (
            <div className="flex items-center gap-1">
              <span className="text-secondary">Meaning:</span>
              <span className="text-default">{instanceMeaning}</span>
            </div>
          )}
          {item.type === 'meaning' && (
            <>
              {meaningDirected !== null && (
                <div className="flex items-center gap-1.5">
                  {meaningDirected ? <ArrowRight size={10} /> : <Minus size={10} />}
                  <span>{meaningDirected ? 'Directed' : 'Undirected'}</span>
                </div>
              )}
              {meaningLineStyle && (
                <div className="flex items-center gap-1">
                  <span className="text-secondary">Style:</span>
                  <span className="text-default">{meaningLineStyle}</span>
                </div>
              )}
            </>
          )}
          {filePath && (
            <div className="flex items-center gap-1">
              <span className="text-secondary">Path:</span>
              <span className="text-default truncate">{filePath}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NarreMentionPicker({
  query,
  rootNetworkId,
  position,
  initialCategory = 'all',
  agentMentions = [],
  onSelect,
  onClose,
}: NarreMentionPickerProps): JSX.Element {
  const { t } = useI18n();
  const display = useMemo(() => createOntologyDisplayResolver(t), [t]);
  const [results, setResults] = useState<MentionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [search, setSearch] = useState(query);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const activeCategoryRef = useRef(activeCategory);
  activeCategoryRef.current = activeCategory;

  // Sync external query to internal search
  useEffect(() => { setSearch(query); }, [query]);
  useEffect(() => { setActiveCategory(initialCategory); }, [initialCategory]);
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = search ? 150 : 0;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await narreService.searchMentions(rootNetworkId, search);
        setResults(data.map((item) => localizeMentionResult(item, display)));
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [display, search, rootNetworkId]);

  const allResults = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filteredAgents = agentMentions
      .filter((item) => (
        lowerSearch.length === 0
        || item.display.toLowerCase().includes(lowerSearch)
        || (item.description ?? '').toLowerCase().includes(lowerSearch)
      ));
    return [...filteredAgents, ...results];
  }, [agentMentions, results, search]);

  // Filter by active category
  const displayResults = useMemo(() => {
    if (activeCategory === 'all') return allResults;
    return allResults.filter((r) => r.type === activeCategory);
  }, [allResults, activeCategory]);

  const hasAgentMentions = agentMentions.length > 0;
  const visibleCategories = useMemo(() => (
    hasAgentMentions
      ? MENTION_CATEGORIES
      : MENTION_CATEGORIES.filter((c) => c.key !== 'agent')
  ), [hasAgentMentions]);

  useEffect(() => {
    if (!hasAgentMentions && activeCategory === 'agent') {
      setActiveCategory('all');
      setSelectedIndex(0);
    }
  }, [activeCategory, hasAgentMentions]);

  // Preview item
  const previewItem = displayResults[selectedIndex] ?? null;

  // Keyboard navigation: arrows, enter, escape, tab
  // stopImmediatePropagation prevents the event from reaching contentEditable's handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isSearchInput = Boolean(target?.closest('[data-mention-search]'));
    if (isSearchInput) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        logShortcut('shortcut.narreMentionPicker.close');
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (displayResults[selectedIndex]) {
          logShortcut('shortcut.narreMentionPicker.confirmSelection');
          onSelect(displayResults[selectedIndex]);
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopImmediatePropagation();
      logShortcut('shortcut.narreMentionPicker.selectNext');
      setSelectedIndex((prev) => Math.min(prev + 1, displayResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      logShortcut('shortcut.narreMentionPicker.selectPrevious');
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const cats = visibleCategories;
      const curIdx = cats.findIndex((c) => c.key === activeCategoryRef.current);
      const next = e.shiftKey
        ? (curIdx - 1 + cats.length) % cats.length
        : (curIdx + 1) % cats.length;
      setActiveCategory(cats[next].key);
      setSelectedIndex(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (displayResults[selectedIndex]) {
        logShortcut('shortcut.narreMentionPicker.confirmSelection');
        onSelect(displayResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      logShortcut('shortcut.narreMentionPicker.close');
      onClose();
    }
  }, [displayResults, selectedIndex, visibleCategories, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Keep contentEditable focused so chip insertion still works.
  // Search syncs from the external query (text after @).

  const showPreview = previewItem && (previewItem.description || previewItem.meta);

  return createPortal(
    <div
      ref={containerRef}
      className="fixed bg-surface-panel border border-default rounded-lg overflow-hidden flex"
      style={{
        bottom: position.bottom,
        left: position.left,
        width: showPreview ? 500 : 360,
        minHeight: PICKER_MIN_HEIGHT,
        zIndex: 10001,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-allow-focus]')) return;
        e.preventDefault();
      }}
    >
      {/* Left: categories */}
      <div className="w-[90px] shrink-0 border-r border-subtle bg-surface-editor flex flex-col py-1">
        {visibleCategories.map((cat) => (
          <button
            key={cat.key}
            className={`px-2.5 py-1.5 text-xs text-left transition-colors ${
              activeCategory === cat.key
                ? 'bg-state-selected text-accent'
                : 'text-secondary hover:bg-state-hover hover:text-default'
            }`}
            onClick={() => { setActiveCategory(cat.key); setSelectedIndex(0); }}
          >
            {t(cat.i18nKey as TranslationKey)}
          </button>
        ))}
        {/* Tab hint */}
        <div className="mt-auto px-2 py-1.5 text-[9px] text-muted">
          {t('narre.mentionTabHint' as TranslationKey)}
        </div>
      </div>

      {/* Middle: search + list */}
      <div className="flex-1 flex min-h-[280px] max-h-[280px] flex-col min-w-0">
        <div
          data-allow-focus
          className="flex items-center gap-1.5 px-2.5 py-2 border-b border-subtle"
          onMouseDown={(e) => {
            e.stopPropagation();
            searchRef.current?.focus();
          }}
        >
          <Search size={12} className="shrink-0 text-muted" />
          <input
            ref={searchRef}
            data-allow-focus
            data-mention-search
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveCategory('all'); }}
            placeholder={t('narre.mentionSearch' as TranslationKey)}
            className="w-full bg-transparent text-xs text-default outline-none placeholder:text-muted"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {loading && (
            <div className="flex items-center justify-center py-3"><Spinner size="sm" /></div>
          )}
          {!loading && displayResults.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted text-center">{t('common.noResults')}</div>
          )}
          {!loading && displayResults.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const categoryLabel = MENTION_CATEGORIES.find((c) => c.key === item.type)?.i18nKey;
            return (
              <div
                key={`${item.type}-${item.id}`}
                className={[
                  'flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors',
                  isSelected ? 'bg-state-hover text-default' : 'text-secondary hover:bg-state-hover',
                ].join(' ')}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <MentionIcon icon={item.icon} type={item.type} />
                {item.color && !item.icon && (
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                )}
                <span className="truncate">{item.display}</span>
                {activeCategory === 'all' && (
                  <span className="ml-auto shrink-0 text-[10px] text-muted">
                    {categoryLabel ? t(categoryLabel as TranslationKey) : item.type}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: preview panel */}
      {showPreview && (
        <div className="w-[140px] shrink-0 border-l border-subtle overflow-y-auto">
          <PreviewPanel item={previewItem} t={t} />
        </div>
      )}
    </div>,
    document.body,
  );
}
