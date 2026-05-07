import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface NetworkObjectEditorShellProps {
  badge: string;
  title: string;
  subtitle?: string | null;
  description?: React.ReactNode;
  leadingVisual?: React.ReactNode;
  actions?: React.ReactNode;
  showHeader?: boolean;
  fillHeight?: boolean;
  bodySectionCount?: number;
  children: React.ReactNode;
}

interface NetworkObjectEditorSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  viewMode?: 'body' | 'details';
  fullBleed?: boolean;
  children: React.ReactNode;
}

interface NetworkObjectMetadataListProps {
  items: Array<{ label: string; value: React.ReactNode }>;
}

export function NetworkObjectEditorShell({
  badge,
  title,
  subtitle,
  description,
  leadingVisual,
  actions,
  showHeader = true,
  fillHeight = true,
  bodySectionCount = 2,
  children,
}: NetworkObjectEditorShellProps): JSX.Element {
  const [viewMode, setViewMode] = useState<'body' | 'details'>('body');
  const sections = useMemo(() => React.Children.toArray(children), [children]);
  const explicitBodySections = sections.filter((section) => (
    React.isValidElement<NetworkObjectEditorSectionProps>(section) && section.props.viewMode === 'body'
  ));
  const explicitDetailSections = sections.filter((section) => (
    React.isValidElement<NetworkObjectEditorSectionProps>(section) && section.props.viewMode === 'details'
  ));
  const hasExplicitModes = explicitBodySections.length > 0 || explicitDetailSections.length > 0;
  const bodySections = hasExplicitModes ? explicitBodySections : sections.slice(0, bodySectionCount);
  const detailSections = hasExplicitModes ? explicitDetailSections : sections.slice(bodySectionCount);
  const visibleSections = viewMode === 'body' ? bodySections : detailSections;

  return (
    <div className={`${fillHeight ? 'min-h-full' : 'min-h-0'} bg-surface-editor`}>
      <div className="sticky top-0 z-10 flex justify-end bg-surface-editor px-6 py-2">
          <div className="flex items-center rounded-lg border border-default bg-surface-card p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('body')}
              className={[
                'h-8 rounded-md px-3 text-xs font-semibold transition-colors',
                viewMode === 'body'
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'text-secondary hover:bg-state-hover hover:text-default',
              ].join(' ')}
            >
              Body
            </button>
            {detailSections.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode('details')}
                className={[
                  'h-8 rounded-md px-3 text-xs font-semibold transition-colors',
                  viewMode === 'details'
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'text-secondary hover:bg-state-hover hover:text-default',
                ].join(' ')}
              >
                Details
              </button>
            )}
          </div>
      </div>

      <div className="flex w-full flex-col gap-5 py-5">
        {showHeader && viewMode === 'details' && (
          <section className="mx-auto w-full max-w-[760px] border-b border-subtle px-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                {leadingVisual && <div className="shrink-0">{leadingVisual}</div>}
                <div className="min-w-0 flex-1">
                  <Badge variant="accent" className="mb-3">
                    {badge}
                  </Badge>
                  <div className="truncate text-lg font-semibold text-default">{title}</div>
                  {subtitle && <div className="mt-1 text-xs text-secondary">{subtitle}</div>}
                  {description && <div className="mt-3 text-sm text-secondary">{description}</div>}
                </div>
              </div>
              {actions && <div className="shrink-0">{actions}</div>}
            </div>
          </section>
        )}
        {visibleSections.length > 0 ? visibleSections : bodySections}
      </div>
    </div>
  );
}

export function NetworkObjectEditorSection({
  title,
  description,
  defaultOpen = true,
  actions,
  viewMode: _viewMode,
  fullBleed = false,
  children,
}: NetworkObjectEditorSectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const sectionClass = fullBleed ? 'w-full' : 'mx-auto w-full max-w-[760px] px-6';
  const headerClass = fullBleed ? 'mx-auto w-full max-w-[760px] px-6' : '';
  const contentClass = fullBleed ? 'flex flex-col gap-4 py-3' : 'flex flex-col gap-4 py-3';

  return (
    <section className={`${sectionClass} border-b border-subtle pb-5 last:border-b-0`}>
      <div className={`${headerClass} flex items-center gap-3 py-2`}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-secondary" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-secondary" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-default">{title}</div>
            {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
          </div>
        </button>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {open && <div className={contentClass}>{children}</div>}
    </section>
  );
}

export function NetworkObjectMetadataList({ items }: NetworkObjectMetadataListProps): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-subtle bg-surface-editor px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{item.label}</div>
          <div className="mt-1 break-all text-sm text-default">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
