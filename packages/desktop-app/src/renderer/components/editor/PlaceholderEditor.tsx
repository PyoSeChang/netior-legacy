import React from 'react';
import type { EditorTab } from '../../types/editor';
import { ScrollArea } from '../ui/ScrollArea';

interface PlaceholderEditorProps {
  tab: EditorTab;
  label: string;
}

function getTabTarget(tab: EditorTab): string {
  const record = tab as unknown as Record<string, unknown>;
  return String(record.targetId ?? record.entityId ?? record.path ?? tab.id);
}

export function PlaceholderEditor({ tab, label }: PlaceholderEditorProps): JSX.Element {
  return (
    <ScrollArea>
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="w-full max-w-[520px] rounded-lg border border-subtle bg-surface-panel p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
          <h2 className="mt-2 truncate text-lg font-semibold text-default">{tab.title}</h2>
          <div className="mt-3 break-all rounded-md border border-subtle bg-surface-editor px-3 py-2 text-xs text-secondary">
            {getTabTarget(tab)}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
