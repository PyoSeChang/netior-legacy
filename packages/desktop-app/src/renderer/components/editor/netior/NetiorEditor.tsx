import React, { useMemo } from 'react';
import { Link2, PanelTop } from 'lucide-react';
import { parseSemanticEditorTokens } from '@netior/shared';
import { MarkdownEditor } from '../markdown/MarkdownEditor';
import { createNetiorSemanticPreviewPlugin } from './semantic-preview';

interface NetiorEditorProps {
  tabId: string;
  content: string;
  projectId?: string | null;
  instanceId?: string | null;
  onChange: (content: string) => void;
}

export function NetiorEditor({
  tabId,
  content,
  projectId: _projectId,
  instanceId: _instanceId,
  onChange,
}: NetiorEditorProps): JSX.Element {
  const semanticExtensions = useMemo(() => createNetiorSemanticPreviewPlugin(), []);
  const tokenSummary = useMemo(() => {
    const tokens = parseSemanticEditorTokens(content);
    return {
      mentions: tokens.filter((token) => token.occurrenceType === 'mention').length,
      embeds: tokens.filter((token) => token.occurrenceType === 'embed').length,
    };
  }, [content]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-editor">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-subtle bg-surface-card px-3">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-secondary">
          <Link2 size={14} className="shrink-0 text-accent" />
          <span>Netior Editor</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Link2 size={12} />
            {tokenSummary.mentions}
          </span>
          <span className="inline-flex items-center gap-1">
            <PanelTop size={12} />
            {tokenSummary.embeds}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <MarkdownEditor
          tabId={tabId}
          content={content}
          extensions={semanticExtensions}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
