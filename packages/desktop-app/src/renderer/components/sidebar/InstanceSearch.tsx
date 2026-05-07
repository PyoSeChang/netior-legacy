import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useInstanceStore } from '../../stores/instance-store';
import { useI18n } from '../../hooks/useI18n';
import { NodeVisual } from '../workspace/node-components/NodeVisual';

export function InstanceSearch(): JSX.Element {
  const { t } = useI18n();
  const { instances } = useInstanceStore();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? instances.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : instances;

  return (
    <div className="flex flex-col gap-1 px-2">
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="w-full rounded border border-subtle bg-surface-input py-1 pl-7 pr-2 text-xs text-default outline-none focus:border-accent"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('instance.searchPlaceholder')}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        {filtered.length === 0 ? (
          <span className="px-1 py-2 text-xs text-muted">{t('common.noResults')}</span>
        ) : (
          filtered.map((instance) => (
            <div
              key={instance.id}
              className="flex items-center gap-2 rounded px-2 py-1 text-xs text-secondary hover:bg-state-hover hover:text-default"
            >
              <NodeVisual icon={instance.icon ?? 'box'} size={14} imageSize={18} className="shrink-0" />
              <span className="truncate">{instance.title}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
