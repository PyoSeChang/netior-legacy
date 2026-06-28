// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { getNarreToolMetadata, normalizeNetiorToolName } from '@netior/shared/constants';
import type { TranslationKey } from '@netior/shared/i18n';
import type { NarreCard, NarreToolCall, NarreTranscriptBlock } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { NarreToolLog, type NarreToolLogItem } from './NarreToolLog';
import { NarreMarkdown } from './NarreMarkdown';
import { getLocalizedToolLabel } from './narre-tool-presenter-localized';
import { NarreCardRenderer } from './cards/NarreCardRenderer';

interface NarreMessageBubbleProps {
  role: 'user' | 'assistant';
  blocks: NarreTranscriptBlock[];
  onCardRespond?: (toolCallId: string, response: unknown) => Promise<void> | void;
  defaultExpandedInteractiveBlocks?: boolean;
  isStreaming?: boolean;
  timestamp?: string;
}

const MENTION_RE = /\[(\w+):(?:id=([^,\]]*)|path="([^"]*)")(?:,\s*(?:title|name)="([^"]*)")?\]/g;
const PERMISSION_TOOL_RE = /tool "([^"]+)"/i;

function isSameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatUserMessageTimestamp(timestamp: string | undefined, locale: string): string | null {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (isSameLocalDate(date, now)) {
    return time;
  }

  const dateOptions: Intl.DateTimeFormatOptions = date.getFullYear() === now.getFullYear()
    ? { month: 'numeric', day: 'numeric' }
    : { year: 'numeric', month: 'numeric', day: 'numeric' };
  const dateLabel = new Intl.DateTimeFormat(locale, dateOptions).format(date);
  return `${dateLabel} ${time}`;
}

function formatCopyTextWithMentions(text: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;

  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(`@${match[4] || match[2] || match[3] || match[1]}`);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.join('');
}

function getUserCopyText(blocks: NarreTranscriptBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'rich_text':
          return formatCopyTextWithMentions(block.text);
        case 'skill':
        case 'command': {
          const lines = [block.label || `/${block.name}`];
          if (block.refs?.length) {
            lines.push(block.refs.map((ref) => `@${ref.display}`).join(' '));
          }
          if (block.args && Object.keys(block.args).length > 0) {
            lines.push(Object.entries(block.args).map(([key, value]) => `${key}: ${value}`).join('\n'));
          }
          return lines.join('\n');
        }
        case 'draft':
          return block.content;
        default:
          return '';
      }
    })
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

async function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function renderContentWithMentions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;

  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const type = match[1];
    const display = match[4] || match[2] || match[3] || type;

    parts.push(
      <span
        key={match.index}
        className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded border border-subtle bg-surface-card px-1.5 py-px text-[11px] font-medium leading-4 text-secondary"
      >
        @{display}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderAssistantContent(content: string): JSX.Element {
  const processed = content.replace(
    MENTION_RE,
    (_match, _type, id, path, title) => {
      const display = title || id || path || '';
      return `**@${display}**`;
    },
  );
  return <NarreMarkdown content={processed} />;
}

function formatPermissionSummary(
  message: string,
  locale: string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const toolMatch = message.match(PERMISSION_TOOL_RE);
  if (!toolMatch) {
    return message;
  }

  const toolLabel = getLocalizedToolLabel(
    toolMatch[1],
    locale,
    getNarreToolMetadata(toolMatch[1]).displayName,
  );
  return t('narre.card.permissionRequest' as never, { tool: toolLabel } as never);
}

function getCardSummary(card: NarreCard, locale: string, t: ReturnType<typeof useI18n>['t']): string {
  switch (card.type) {
    case 'draft':
      return card.title || 'Draft';
    case 'proposal':
      return card.title;
    case 'permission':
      return formatPermissionSummary(card.message, locale, t);
    case 'interview':
      return card.question;
    case 'summary':
      return card.title;
    default:
      return 'Card';
  }
}

function isInteractiveCard(card: NarreCard): boolean {
  return card.type === 'permission' || card.type === 'draft' || card.type === 'interview';
}

function isResolvedInteractiveCard(card: NarreCard): boolean {
  switch (card.type) {
    case 'permission':
      return typeof card.resolvedActionKey === 'string' && card.resolvedActionKey.length > 0;
    case 'draft':
      return Boolean(card.submittedResponse);
    case 'interview':
      return Boolean(card.submittedResponse);
    default:
      return false;
  }
}

type AssistantRenderSegment =
  | { type: 'block'; block: Exclude<NarreTranscriptBlock, { type: 'tool' }> }
  | {
    type: 'tool_cluster';
    id: string;
    items: NarreToolLogItem[];
  };

function toToolCall(block: Extract<NarreTranscriptBlock, { type: 'tool' }>): NarreToolCall {
  return {
    tool: block.toolKey,
    input: block.input,
    status: block.error ? 'error' : block.output ? 'success' : 'running',
    ...(block.metadata ? { metadata: block.metadata } : {}),
    ...(block.output ? { result: block.output } : {}),
    ...(block.error ? { error: block.error } : {}),
  };
}

function extractPermissionToolName(card: Extract<NarreCard, { type: 'permission' }>): string | null {
  const match = card.message.match(PERMISSION_TOOL_RE);
  return match?.[1] ? normalizeNetiorToolName(match[1]) : null;
}

function buildAssistantRenderSegments(
  blocks: NarreTranscriptBlock[],
  locale: string,
  t: ReturnType<typeof useI18n>['t'],
): AssistantRenderSegment[] {
  const segments: AssistantRenderSegment[] = [];
  const clusterStarts = new Map<number, AssistantRenderSegment>();
  const clusterMembers = new Set<number>();
  let clusterIndex = 0;
  let activeCluster:
    | {
      startIndex: number;
      items: NarreToolLogItem[];
      memberIndices: number[];
    }
    | null = null;

  const flushCluster = (): void => {
    if (!activeCluster) {
      return;
    }

    clusterStarts.set(activeCluster.startIndex, {
      type: 'tool_cluster',
      id: `tool-cluster-${clusterIndex += 1}`,
      items: activeCluster.items,
    });
    activeCluster.memberIndices.forEach((index) => clusterMembers.add(index));
    activeCluster = null;
  };

  blocks.forEach((block, index) => {
    if (block.type === 'tool') {
      if (!activeCluster) {
        activeCluster = {
          startIndex: index,
          items: [],
          memberIndices: [],
        };
      }

      activeCluster.items.push({ kind: 'tool', id: block.id, call: toToolCall(block) });
      activeCluster.memberIndices.push(index);
      return;
    }

    if (block.type === 'card' && isInteractiveCard(block.card) && !isResolvedInteractiveCard(block.card)) {
      flushCluster();
      clusterMembers.add(index);
      return;
    }

    if (block.type === 'card' && block.card.type === 'permission') {
      if (!activeCluster) {
        activeCluster = {
          startIndex: index,
          items: [],
          memberIndices: [],
        };
      }

      const summary = getCardSummary(block.card, locale, t);
      const permissionToolName = extractPermissionToolName(block.card);
      const matchingToolItem = permissionToolName
        ? [...activeCluster.items]
          .reverse()
          .find((item): item is Extract<NarreToolLogItem, { kind: 'tool' }> =>
            item.kind === 'tool'
            && normalizeNetiorToolName(item.call.tool) === permissionToolName
            && !item.permission,
          )
        : null;

      if (matchingToolItem) {
        matchingToolItem.permission = {
          card: block.card,
          summary,
        };
      } else {
        activeCluster.items.push({
          kind: 'permission',
          id: block.id,
          card: block.card,
          summary,
        });
      }
      activeCluster.memberIndices.push(index);
      return;
    }

    if (block.type === 'card' || block.type === 'draft') {
      flushCluster();
      return;
    }

    if (activeCluster) {
      flushCluster();
    }
  });

  flushCluster();

  blocks.forEach((block, index) => {
    const cluster = clusterStarts.get(index);
    if (cluster) {
      segments.push(cluster);
    }

    if (clusterMembers.has(index)) {
      return;
    }

    if (block.type === 'tool') {
      return;
    }

    segments.push({ type: 'block', block });
  });

  return segments;
}

function NarreCardBlock({
  card,
  onCardRespond,
  defaultExpanded,
  forceCollapseKey,
  locale,
  t,
}: {
  card: NarreCard;
  onCardRespond?: (toolCallId: string, response: unknown) => Promise<void> | void;
  defaultExpanded: boolean;
  forceCollapseKey: string;
  locale: string;
  t: ReturnType<typeof useI18n>['t'];
}): JSX.Element {
  const cardResolved = isResolvedInteractiveCard(card);
  const [expanded, setExpanded] = useState(defaultExpanded && !cardResolved);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (cardResolved) {
      setExpanded(false);
      setResolved(true);
      return;
    }

    setExpanded(defaultExpanded);
    if (defaultExpanded) {
      setResolved(false);
    }
  }, [cardResolved, defaultExpanded, forceCollapseKey]);

  const handleRespond = useCallback(async (toolCallId: string, response: unknown) => {
    if (!onCardRespond) {
      return;
    }

    await onCardRespond(toolCallId, response);
    setResolved(true);
    setExpanded(false);
  }, [onCardRespond]);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-subtle bg-surface-editor">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-secondary transition-colors hover:bg-state-hover"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
        <span className="truncate">{getCardSummary(card, locale, t)}</span>
        {resolved && card.type !== 'permission' && <Badge variant="success" className="ml-auto">{t('narre.card.submitted')}</Badge>}
      </button>
      {expanded && (
        <div className="border-t border-subtle">
          {!onCardRespond && isInteractiveCard(card) ? (
            <div className="px-3 py-2 text-xs text-muted">
              {t('narre.card.replyInInput')}
            </div>
          ) : (
            <NarreCardRenderer
              card={card}
              onRespond={handleRespond}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function NarreMessageBubble({
  role,
  blocks,
  onCardRespond,
  defaultExpandedInteractiveBlocks = false,
  isStreaming = false,
  timestamp,
}: NarreMessageBubbleProps): JSX.Element {
  const { t, locale } = useI18n();
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const segments = isUser
    ? blocks
      .filter((block): block is Exclude<NarreTranscriptBlock, { type: 'tool' }> => block.type !== 'tool')
      .map((block) => ({ type: 'block', block } as AssistantRenderSegment))
    : buildAssistantRenderSegments(blocks, locale, t);
  const formattedUserTimestamp = isUser ? formatUserMessageTimestamp(timestamp, locale) : null;
  const userCopyText = isUser ? getUserCopyText(blocks) : '';
  const canCopyUserMessage = userCopyText.trim().length > 0;

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleCopyUserMessage = useCallback(async () => {
    if (!canCopyUserMessage) {
      return;
    }

    try {
      await writeTextToClipboard(userCopyText);
      setCopied(true);
    } catch (error) {
      console.error('[narre] Failed to copy user message:', error);
    }
  }, [canCopyUserMessage, userCopyText]);

  return (
    <div className={`group/message flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={[
            'rounded-lg border px-3 py-2 text-sm shadow-sm',
            isUser
              ? 'border-accent bg-accent-muted text-default'
              : 'border-default bg-surface-panel text-default',
          ].join(' ')}
        >
          {blocks.length === 0 && isStreaming && (
            <div className="text-xs text-muted animate-pulse">...</div>
          )}

          {segments.map((segment, index) => {
            if (segment.type === 'tool_cluster') {
              return (
                <div
                  key={`${segment.id}:${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}`}
                  className={index > 0 ? 'mt-2' : ''}
                >
                  <NarreToolLog
                    items={segment.items}
                    defaultExpanded={defaultExpandedInteractiveBlocks || isStreaming}
                    onPermissionRespond={onCardRespond}
                  />
                </div>
              );
            }

            const { block } = segment;

            switch (block.type) {
              case 'rich_text':
                return (
                  <div
                    key={block.id}
                    className={[
                      index > 0 ? 'mt-2' : '',
                      isUser ? 'whitespace-pre-wrap break-words' : 'break-words',
                    ].join(' ')}
                  >
                    {isUser ? renderContentWithMentions(block.text) : renderAssistantContent(block.text)}
                  </div>
                );
              case 'skill':
              case 'command': {
                const detailBadges = [
                  ...(block.refs ?? []).map((ref) => (
                    <Badge key={`${block.id}:${ref.type}:${ref.id ?? ref.path ?? ref.display}`} variant="accent">
                      @{ref.display}
                    </Badge>
                  )),
                  ...(block.args?.startPage && block.args?.endPage
                    ? [<Badge key={`${block.id}:range`}>{`${block.args.startPage}-${block.args.endPage}`}</Badge>]
                    : []),
                  ...(block.args?.overviewPages
                    ? [<Badge key={`${block.id}:overview`}>{`${t('pdfToc.overviewPages')}: ${block.args.overviewPages}`}</Badge>]
                    : []),
                ];

                return (
                  <div key={block.id} className={index > 0 ? 'mt-2' : ''}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-accent-muted px-2 py-0.5 text-xs font-semibold text-accent">
                        {block.label || `/${block.name}`}
                      </span>
                    </div>
                    {detailBadges.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {detailBadges}
                      </div>
                    )}
                  </div>
                );
              }
              case 'draft':
                return (
                  <div key={block.id} className={index > 0 ? 'mt-2' : ''}>
                    <NarreMarkdown content={block.content} />
                  </div>
                );
              case 'card':
                return (
                  <NarreCardBlock
                    key={`${block.id}:${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}`}
                    card={block.card}
                    onCardRespond={onCardRespond}
                    defaultExpanded={defaultExpandedInteractiveBlocks || isStreaming}
                    forceCollapseKey={`${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}:${isStreaming ? 'streaming' : 'restored'}`}
                    locale={locale}
                    t={t}
                  />
                );
              default:
                return null;
            }
          })}
        </div>
        {isUser && (formattedUserTimestamp || canCopyUserMessage) && (
          <div className="mt-1 flex h-5 items-center gap-1.5 pr-1 text-[11px] text-muted opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100">
            {formattedUserTimestamp && <span>{formattedUserTimestamp}</span>}
            {canCopyUserMessage && (
              <button
                type="button"
                aria-label={t('fileTree.copy' as TranslationKey)}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted transition-colors hover:bg-state-hover hover:text-default"
                onClick={() => { void handleCopyUserMessage(); }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
