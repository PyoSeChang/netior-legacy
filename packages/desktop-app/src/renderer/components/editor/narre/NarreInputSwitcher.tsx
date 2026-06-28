import React from 'react';
import type {
  AgentRuntimeProfile,
  NarreDraftCard,
  NarreInterviewCard,
  NarreMention,
  NarrePermissionCard,
  SkillDefinition,
} from '@netior/shared/types';
import type { NarrePendingSkillInvocationState } from '../../../lib/narre-ui-state';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { NarreMentionInput, type NarreComposerSubmit } from './NarreMentionInput';
import { DraftCard } from './cards/DraftCard';
import { InterviewCard } from './cards/InterviewCard';
import { PermissionCard } from './cards/PermissionCard';
import { getLocalizedPermissionMessage } from './narre-tool-presenter-localized';

export type NarreInteractivePrompt =
  | { kind: 'permission'; card: NarrePermissionCard }
  | { kind: 'draft'; card: NarreDraftCard }
  | { kind: 'interview'; card: NarreInterviewCard };

interface NarreInputSwitcherProps {
  rootNetworkId: string;
  disabled?: boolean;
  sendDisabled?: boolean;
  isStreaming?: boolean;
  stopDisabled?: boolean;
  placeholder?: string;
  draftHtml?: string;
  availableSkills?: readonly SkillDefinition[];
  pendingSkillInvocation?: NarrePendingSkillInvocationState | null;
  queuedCount?: number;
  scheduledMessages?: readonly string[];
  runtimeProfile?: AgentRuntimeProfile | null;
  onDraftChange?: (draftHtml: string) => void;
  onPendingSkillInvocationChange?: (pendingSkillInvocation: NarrePendingSkillInvocationState | null) => void;
  onRemoveScheduledMessage?: (index: number) => void;
  onSend: (payload: NarreComposerSubmit) => Promise<boolean | void> | boolean | void;
  onStop?: () => Promise<void> | void;
  activePrompt: NarreInteractivePrompt | null;
  onPromptRespond: (toolCallId: string, response: unknown) => Promise<void> | void;
}

function NarrePromptShell({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="w-full rounded-lg border border-subtle bg-surface-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold text-default">{title}</h3>
        <Badge>{badge}</Badge>
      </div>
      {children}
    </div>
  );
}

export function NarreInputSwitcher({
  rootNetworkId,
  disabled = false,
  sendDisabled = false,
  isStreaming = false,
  stopDisabled = false,
  placeholder,
  draftHtml = '',
  availableSkills,
  pendingSkillInvocation = null,
  queuedCount = 0,
  scheduledMessages = [],
  runtimeProfile = null,
  onDraftChange,
  onPendingSkillInvocationChange,
  onRemoveScheduledMessage,
  onSend,
  onStop,
  activePrompt,
  onPromptRespond,
}: NarreInputSwitcherProps): JSX.Element {
  const { t, locale } = useI18n();

  if (activePrompt?.kind === 'permission') {
    return (
      <NarrePromptShell title={t('narre.input.permissionTitle')} badge={t('narre.input.permissionBadge')}>
        <div className="text-sm text-secondary">
          {getLocalizedPermissionMessage(activePrompt.card.message, locale)}
        </div>
        <PermissionCard
          key={activePrompt.card.toolCallId}
          card={activePrompt.card}
          onAction={(actionKey) => onPromptRespond(activePrompt.card.toolCallId, { action: actionKey })}
        />
      </NarrePromptShell>
    );
  }

  if (activePrompt?.kind === 'draft') {
    return (
      <NarrePromptShell title={t('narre.input.draftTitle')} badge={t('narre.input.draftBadge')}>
        <DraftCard
          key={activePrompt.card.toolCallId}
          card={activePrompt.card}
          embedded
          onRespond={(response) => onPromptRespond(activePrompt.card.toolCallId, response)}
        />
      </NarrePromptShell>
    );
  }

  if (activePrompt?.kind === 'interview') {
    return (
      <NarrePromptShell title={t('narre.input.askTitle')} badge={t('narre.input.askBadge')}>
        <InterviewCard
          key={activePrompt.card.toolCallId}
          card={activePrompt.card}
          embedded
          onSelect={(response) => onPromptRespond(activePrompt.card.toolCallId, response)}
        />
      </NarrePromptShell>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <NarreMentionInput
        rootNetworkId={rootNetworkId}
        onSend={onSend}
        disabled={disabled}
        sendDisabled={sendDisabled}
        isStreaming={isStreaming}
        stopDisabled={stopDisabled}
        placeholder={placeholder}
        draftHtml={draftHtml}
        availableSkills={availableSkills}
        pendingSkillInvocation={pendingSkillInvocation}
        queuedCount={queuedCount}
        scheduledMessages={scheduledMessages}
        runtimeProfile={runtimeProfile}
        onDraftChange={onDraftChange}
        onPendingSkillInvocationChange={onPendingSkillInvocationChange}
        onRemoveScheduledMessage={onRemoveScheduledMessage}
        onStop={onStop}
      />
    </div>
  );
}
