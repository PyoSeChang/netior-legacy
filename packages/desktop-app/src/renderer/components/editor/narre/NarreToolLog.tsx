import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Circle } from 'lucide-react';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type { NarrePermissionCard, NarreToolCall } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { Spinner } from '../../ui/Spinner';
import { PermissionCard } from './cards/PermissionCard';
import {
  getLocalizedToolCategoryLabel,
  getLocalizedToolDescription,
  getLocalizedToolLabel,
  getLocalizedToolWriteLabel,
  getToolResultSummary,
} from './narre-tool-presenter-localized';

export type NarreToolLogItem =
  | {
    kind: 'tool';
    id: string;
    call: NarreToolCall;
    permission?: {
      card: NarrePermissionCard;
      summary: string;
      submittedResponse?: unknown;
    };
  }
  | { kind: 'permission'; id: string; card: NarrePermissionCard; summary: string };

interface NarreToolLogProps {
  calls?: NarreToolCall[];
  items?: NarreToolLogItem[];
  defaultExpanded?: boolean;
  bordered?: boolean;
  onPermissionRespond?: (toolCallId: string, response: unknown) => Promise<void> | void;
}

function ToolStatusIcon({ status }: { status: NarreToolCall['status'] }): JSX.Element {
  switch (status) {
    case 'pending':
      return <Circle size={12} className="text-muted shrink-0" />;
    case 'running':
      return <Spinner size="sm" className="shrink-0" />;
    case 'success':
      return <Check size={12} className="text-[var(--status-success)] shrink-0" />;
    case 'error':
      return <X size={12} className="text-[var(--status-error)] shrink-0" />;
  }
}

function formatToolLabel(call: NarreToolCall, locale: string): string {
  return getLocalizedToolLabel(
    call.tool,
    locale,
    call.metadata?.displayName ?? getNarreToolMetadata(call.tool).displayName,
  );
}

function getToolMetadata(call: NarreToolCall) {
  return call.metadata ?? getNarreToolMetadata(call.tool);
}

function getSubmittedAction(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const candidate = response as { action?: unknown };
  return typeof candidate.action === 'string' ? candidate.action : null;
}

function getAllowActionKey(card: NarrePermissionCard): string | null {
  const allowAction = card.actions.find((action) => {
    const key = action.key.toLowerCase();
    return key === 'accept_world'
      || key === 'allow_world'
      || key === 'always_allow_world'
      || key === 'approve'
      || key === 'allow'
      || key === 'confirm'
      || key === 'accept';
  });

  return allowAction?.key ?? null;
}

function getEffectivePermissionResponse(
  permission: NonNullable<Extract<NarreToolLogItem, { kind: 'tool' }>['permission']>,
  call?: NarreToolCall,
): { action: string } | null {
  const submittedAction = getSubmittedAction(permission.submittedResponse);
  if (submittedAction) {
    return { action: submittedAction };
  }

  if (typeof permission.card.resolvedActionKey === 'string' && permission.card.resolvedActionKey.length > 0) {
    return { action: permission.card.resolvedActionKey };
  }

  if (!call || call.status === 'pending') {
    return null;
  }

  const allowActionKey = getAllowActionKey(permission.card);
  return allowActionKey ? { action: allowActionKey } : null;
}

function getPermissionDecisionVariant(actionKey: string): 'success' | 'error' | 'default' {
  switch (actionKey.toLowerCase()) {
    case 'accept_world':
    case 'allow_world':
    case 'always_allow_world':
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return 'success';
    case 'decline':
    case 'deny':
    case 'cancel':
      return 'error';
    default:
      return 'default';
  }
}

function getPermissionDecisionLabel(actionKey: string, t: ReturnType<typeof useI18n>['t']): string {
  switch (actionKey.toLowerCase()) {
    case 'accept_world':
    case 'allow_world':
    case 'always_allow_world':
      return t('narre.card.permissionAllowedWorld');
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return t('narre.card.permissionAllowed');
    case 'decline':
    case 'deny':
    case 'cancel':
      return t('narre.card.permissionDeclined');
    default:
      return actionKey;
  }
}

function inferToolNameFromPermission(card: NarrePermissionCard): string | null {
  const match = card.message.match(/tool "([^"]+)"/i);
  return match?.[1] ?? null;
}

function formatPreviewActionLabel(card: NarrePermissionCard, locale: string): string | null {
  const preview = card.preview;
  if (!preview?.title) return null;

  const toolKey = preview.toolKey ?? inferToolNameFromPermission(card);
  if (!toolKey) return preview.title;

  const label = getLocalizedToolLabel(toolKey, locale, preview.title);
  const separatorIndex = preview.title.indexOf(':');
  if (separatorIndex < 0) return label;

  const suffix = preview.title.slice(separatorIndex + 1).trim();
  return suffix ? `${label}: ${suffix}` : label;
}

export function NarreToolLog({
  calls = [],
  items,
  defaultExpanded = false,
  bordered = true,
  onPermissionRespond,
}: NarreToolLogProps): JSX.Element {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedDetailIds, setExpandedDetailIds] = useState<Set<string>>(() => new Set());
  const resolvedItems = items ?? calls.map((call, index) => ({ kind: 'tool' as const, id: `tool-${index}`, call }));
  const toolItems = resolvedItems.filter((item): item is Extract<NarreToolLogItem, { kind: 'tool' }> => item.kind === 'tool');
  const completed = toolItems.filter((item) => item.call.status === 'success' || item.call.status === 'error').length;
  const total = toolItems.length;
  const isSingleAction = resolvedItems.length === 1;
  const toggleDetail = (id: string): void => {
    setExpandedDetailIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderItem = (item: NarreToolLogItem, index: number): JSX.Element => {
    if (item.kind === 'permission') {
      const submittedResponse = getEffectivePermissionResponse(
        { card: item.card, summary: item.summary },
      );
      const detailsExpanded = expandedDetailIds.has(item.id);
      const actionLabel = formatPreviewActionLabel(item.card, locale) ?? item.summary;

      return (
        <div
          key={item.id}
          className={[
            'px-1 py-1.5',
            !isSingleAction && index > 0 ? 'border-t border-subtle' : '',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-secondary">{actionLabel}</span>
              {submittedResponse && (
                <span className="text-[var(--status-success)]">
                  {getPermissionDecisionLabel(submittedResponse.action, t)}
                </span>
              )}
            </div>
            <button
              type="button"
              className="ml-auto inline-flex shrink-0 items-center rounded px-1 py-0.5 text-muted transition-colors hover:bg-surface-hover hover:text-secondary"
              aria-label={detailsExpanded ? 'Collapse' : 'Expand'}
              onClick={() => toggleDetail(item.id)}
            >
              {detailsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
          {detailsExpanded && onPermissionRespond ? (
            <PermissionCard
              card={item.card}
              submittedResponse={submittedResponse ?? undefined}
              compact
              showSubmittedDecision={false}
              hidePreviewHeader
              onAction={(actionKey) => onPermissionRespond(item.card.toolCallId, { action: actionKey })}
            />
          ) : null}
        </div>
      );
    }

    const toolItem: Extract<NarreToolLogItem, { kind: 'tool' }> = item;
    const metadata = getToolMetadata(toolItem.call);
    const summary = getToolResultSummary(toolItem.call, locale);
    const toolDescription = getLocalizedToolDescription(toolItem.call.tool, locale, metadata.description);
    const permissionResponse = toolItem.permission
      ? getEffectivePermissionResponse(toolItem.permission, toolItem.call)
      : null;
    const showPermissionPrompt = Boolean(toolItem.permission) && permissionResponse === null;
    const permissionDecisionLabel = permissionResponse
      ? getPermissionDecisionLabel(permissionResponse.action, t)
      : null;
    const permissionDecisionVariant = permissionResponse
      ? getPermissionDecisionVariant(permissionResponse.action)
      : 'default';
    const permission = toolItem.permission;
    const hasExpandableDetails = Boolean(permission) || Boolean(summary) || Boolean(toolDescription);
    const detailsExpanded = expandedDetailIds.has(item.id);
    const actionLabel = permission
      ? formatPreviewActionLabel(permission.card, locale) ?? formatToolLabel(toolItem.call, locale)
      : formatToolLabel(toolItem.call, locale);

    return (
      <div
        key={item.id}
        className={[
          'px-1 py-1.5',
          !isSingleAction && index > 0 ? 'border-t border-subtle' : '',
        ].join(' ')}
      >
        <div className="flex items-start gap-2">
          <ToolStatusIcon status={toolItem.call.status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className={toolItem.call.status === 'pending' ? 'text-muted' : 'text-secondary'}>
                  {actionLabel}
                </span>
                <Badge>{getLocalizedToolCategoryLabel(metadata.category, locale)}</Badge>
                {permissionDecisionLabel && (
                  <span
                    className={
                      permissionDecisionVariant === 'success'
                        ? 'text-[var(--status-success)]'
                        : permissionDecisionVariant === 'error'
                          ? 'text-[var(--status-error)]'
                          : 'text-muted'
                    }
                  >
                    {permissionDecisionLabel}
                  </span>
                )}
                {showPermissionPrompt && (
                  <span className="text-muted">
                    {t('narre.card.permissionRequired')}
                  </span>
                )}
                {metadata.isMutation && <Badge variant="warning">{getLocalizedToolWriteLabel(locale)}</Badge>}
              </div>
              {hasExpandableDetails && (
                <button
                  type="button"
                  className="ml-auto inline-flex shrink-0 items-center rounded px-1 py-0.5 text-muted transition-colors hover:bg-surface-hover hover:text-secondary"
                  aria-label={detailsExpanded ? 'Collapse' : 'Expand'}
                  onClick={() => toggleDetail(item.id)}
                >
                  {detailsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              )}
            </div>
            {detailsExpanded && permission && (showPermissionPrompt || permissionResponse) && onPermissionRespond ? (
              <div className="mt-1">
                <PermissionCard
                  card={permission.card}
                  submittedResponse={permissionResponse ?? undefined}
                  compact
                  showSubmittedDecision={false}
                  hidePreviewHeader
                  onAction={(actionKey) => onPermissionRespond(permission.card.toolCallId, { action: actionKey })}
                />
              </div>
            ) : null}
            {detailsExpanded && !permission && toolItem.call.status === 'success' && summary ? (
              <div className="mt-0.5 truncate text-muted">
                {summary}
              </div>
            ) : null}
            {detailsExpanded && !permission && toolItem.call.status === 'error' && summary ? (
              <div className="mt-0.5 truncate text-[var(--status-error)]">
                {summary}
              </div>
            ) : null}
            {detailsExpanded && !permission && toolItem.call.status !== 'success' && toolItem.call.status !== 'error' && toolDescription ? (
              <div className="mt-0.5 text-muted">
                {toolDescription}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  if (isSingleAction) {
    return (
      <div className={[
        bordered ? 'mt-1.5 rounded-md border border-subtle bg-surface-editor px-2 py-1' : '',
        'text-xs',
      ].join(' ')}>
        {resolvedItems.map(renderItem)}
      </div>
    );
  }

  return (
    <div className={[
      bordered ? 'mt-1.5 rounded-md border border-subtle bg-surface-editor' : '',
      'text-xs',
    ].join(' ')}>
      <button
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-muted hover:text-secondary transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded
          ? <ChevronDown size={12} className="shrink-0" />
          : <ChevronRight size={12} className="shrink-0" />}
        <span>
          {total > 0 ? `${t('narre.toolExecution')} (${completed}/${total})` : t('narre.toolExecution')}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-subtle px-2 py-1 flex flex-col">
          {resolvedItems.map(renderItem)}
        </div>
      )}
    </div>
  );
}
