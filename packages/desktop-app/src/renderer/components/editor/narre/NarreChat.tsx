import React, { useEffect, useState, useRef, useCallback, useSyncExternalStore } from 'react';
import { ArrowLeft, Bot, Check, MoreVertical, X } from 'lucide-react';
import { SLASH_TRIGGER_SKILLS } from '@netior/shared/constants';
import type {
  NarreCard,
  AgentDefinition,
  NarreMention,
  NarreTranscriptBlock,
  SkillDefinition,
  UserAgentRecord,
} from '@netior/shared/types';
import { narreService } from '../../../services/narre-service';
import { agentService } from '../../../services/agent-service';
import { useI18n } from '../../../hooks/useI18n';
import {
  appendNarreAssistantErrorMessage,
  appendNarreUserMessage,
  beginNarreAssistantStream,
  cancelPendingNarreAssistantTurn,
  ensureNarreSessionLoaded,
  getNarreSessionState,
  getNarreSessionStoreVersion,
  initNarreSessionStore,
  prepareNarreAssistantStream,
  primeNarreSession,
  promoteNarreDraftSession,
  setNarreSessionTitle,
  setNarreSessionPendingSkillInvocation,
  setNarreSessionInterrupting,
  setNarreSessionDraft,
  updateNarreCardResponse,
  subscribeNarreSessionStore,
  type NarreDisplayMessage,
} from '../../../lib/narre-session-store';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { ContextMenu, type ContextMenuEntry } from '../../ui/ContextMenu';
import { ScrollArea } from '../../ui/ScrollArea';
import { Spinner } from '../../ui/Spinner';
import { NarreMessageBubble } from './NarreMessageBubble';
import type { NarreComposerSubmit } from './NarreMentionInput';
import { NarreInputSwitcher, type NarreInteractivePrompt } from './NarreInputSwitcher';
import { useProjectStore } from '../../../stores/project-store';
import type { NarrePendingSkillInvocationState } from '../../../lib/narre-ui-state';
import { toAbsolutePath } from '../../../utils/path-utils';
import { buildIndexMessage } from '../../../utils/pdf-toc-utils';
import { getLocalizedAgentName } from './agent-display';

interface NarreChatProps {
  sessionId: string | null;
  projectId: string;
  agentKey?: string | null;
  onBackToList: () => void;
  onSessionCreated?: (sessionId: string) => void;
}

initNarreSessionStore();

function getSlashSkill(skillName: string, skills: readonly SkillDefinition[]): SkillDefinition | null {
  return skills.find((skill) =>
    skill.name === skillName || skill.trigger?.name === skillName,
  ) ?? null;
}

function getSkillDescription(skill: SkillDefinition, translate: (key: any) => string): string {
  return skill.source === 'builtin' ? translate(skill.description as any) : skill.description;
}

function isPdfMention(mention: NarreMention): boolean {
  const candidate = mention.path ?? mention.display;
  return candidate.toLowerCase().endsWith('.pdf');
}

function parseOverviewPagesText(rawText: string): number[] | undefined {
  const values = rawText
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length > 0 ? values : undefined;
}

function buildComposerBlockId(prefix = 'composer'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildUserDisplayBlocks(
  text: string,
  mentions: NarreMention[],
  pendingSkillInvocation: NarrePendingSkillInvocationState | null,
): NarreTranscriptBlock[] {
  if (!pendingSkillInvocation) {
    return [
      {
        id: buildComposerBlockId('user-text'),
        type: 'rich_text',
        text,
        ...(mentions.length > 0 ? { mentions } : {}),
      },
    ];
  }

  const skillBlock: Extract<NarreTranscriptBlock, { type: 'skill' }> = {
    id: buildComposerBlockId('user-skill'),
    type: 'skill',
    skillId: pendingSkillInvocation.name,
    name: pendingSkillInvocation.name,
    label: `/${pendingSkillInvocation.name}`,
    ...(mentions.length > 0 ? { refs: mentions } : {}),
  };

  if (pendingSkillInvocation.name === 'index' && pendingSkillInvocation.indexArgs) {
    skillBlock.args = {
      startPage: String(pendingSkillInvocation.indexArgs.startPage),
      endPage: String(pendingSkillInvocation.indexArgs.endPage),
      ...(pendingSkillInvocation.indexArgs.overviewPagesText
        ? { overviewPages: pendingSkillInvocation.indexArgs.overviewPagesText }
        : {}),
    };
  }

  const blocks: NarreTranscriptBlock[] = [skillBlock];
  if (text.trim()) {
    blocks.push({
      id: buildComposerBlockId('user-text'),
      type: 'rich_text',
      text,
    });
  }

  return blocks;
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
      return true;
  }
}

function toInteractivePrompt(card: NarreCard): NarreInteractivePrompt | null {
  switch (card.type) {
    case 'permission':
      return isResolvedInteractiveCard(card) ? null : { kind: 'permission', card };
    case 'draft':
      return isResolvedInteractiveCard(card) ? null : { kind: 'draft', card };
    case 'interview':
      return isResolvedInteractiveCard(card) ? null : { kind: 'interview', card };
    default:
      return null;
  }
}

function findActiveInteractivePrompt(blocks: NarreTranscriptBlock[]): NarreInteractivePrompt | null {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type !== 'card') {
      continue;
    }

    const prompt = toInteractivePrompt(block.card);
    if (prompt) {
      return prompt;
    }
  }

  return null;
}

function getAgentKey(agent: AgentDefinition): string {
  if (agent.kind === 'terminal') return `terminal:${agent.terminalAgentType}:${agent.id}`;
  if (agent.narreAgentType === 'system') return `narre:system:${agent.systemAgentType}:${agent.id}`;
  if (agent.userAgentType === 'project') return `narre:user:project:${agent.projectId}:${agent.id}`;
  return `narre:user:global:${agent.id}`;
}

function isSystemNarreAgent(agent: AgentDefinition): boolean {
  return agent.kind === 'narre' && agent.narreAgentType === 'system';
}

function userAgentRecordToAgentDefinition(record: UserAgentRecord): AgentDefinition {
  const base = {
    id: record.id,
    name: record.name,
    description: record.description,
    systemPrompt: record.systemPrompt,
    kind: 'narre' as const,
    narreAgentType: 'user' as const,
    skills: record.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      format: 'skill-md-directory' as const,
    })),
    runtimeProfile: {
      provider: 'openai' as const,
      reasoningEffort: 'medium' as const,
      toolProfileIds: ['core'],
      approvalPolicy: 'default' as const,
      contextScope: 'run' as const,
    },
  };

  if (record.userAgentType === 'project') {
    return {
      ...base,
      userAgentType: 'project',
      projectId: record.projectId ?? '',
    };
  }

  return {
    ...base,
    userAgentType: 'global',
  };
}

export function NarreChat({
  sessionId: initialSessionId,
  projectId,
  agentKey = null,
  onBackToList,
  onSessionCreated,
}: NarreChatProps): JSX.Element {
  const { t } = useI18n();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [availableSkills, setAvailableSkills] = useState<readonly SkillDefinition[]>(SLASH_TRIGGER_SKILLS);
  const [activeAgent, setActiveAgent] = useState<AgentDefinition | null>(null);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  useEffect(() => {
    setSessionId(initialSessionId);
  }, [initialSessionId]);

  useSyncExternalStore(subscribeNarreSessionStore, getNarreSessionStoreVersion);
  const sessionState = getNarreSessionState(projectId, sessionId);
  const {
    messages,
    isStreaming,
    streamingBlocks,
    hasReceivedFirstStreamEvent,
    isInterrupting,
    pendingDraftHtml,
    pendingDraftSkillInvocation,
    pendingUserTimestamp,
    title: sessionTitle,
    loading,
    pendingSkillInvocation,
    draftHtml,
  } = sessionState;
  const activePrompt = (() => {
    const streamingPrompt = findActiveInteractivePrompt(streamingBlocks);
    if (streamingPrompt) {
      return streamingPrompt;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== 'assistant') {
        continue;
      }

      const prompt = findActiveInteractivePrompt(message.blocks);
      if (prompt) {
        return prompt;
      }
    }

    return null;
  })();

  useEffect(() => {
    void ensureNarreSessionLoaded(projectId, sessionId).catch(() => {});
  }, [projectId, sessionId]);

  useEffect(() => {
    let cancelled = false;

    if (!agentKey) {
      setActiveAgent(null);
      return () => {
        cancelled = true;
      };
    }

    void Promise.all([
      narreService.listSupervisorAgents(projectId),
      agentService.listDefinitions(projectId),
    ])
      .then(([supervisorAgents, userAgents]) => {
        if (cancelled) return;
        const chatAgents = [
          ...supervisorAgents.filter(isSystemNarreAgent),
          ...userAgents.map(userAgentRecordToAgentDefinition),
        ];
        setActiveAgent(chatAgents.find((agent) => getAgentKey(agent) === agentKey) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setActiveAgent(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agentKey, projectId]);

  useEffect(() => {
    let cancelled = false;
    setAvailableSkills(SLASH_TRIGGER_SKILLS);
    void narreService.listSkills(projectId)
      .then((skills) => {
        if (!cancelled) {
          setAvailableSkills(skills);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableSkills(SLASH_TRIGGER_SKILLS);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingBlocks]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    autoScrollRef.current = atBottom;
  }, []);

  const handleCardRespond = useCallback(async (toolCallId: string, response: unknown) => {
    if (!sessionId) {
      throw new Error('Missing Narre session');
    }

    await narreService.respondToCard(sessionId, toolCallId, response);
    updateNarreCardResponse(projectId, sessionId, toolCallId, response);
  }, [projectId, sessionId]);

  const buildSkillPreview = useCallback((
    skillInvocationState: NarrePendingSkillInvocationState,
    mentions: NarreMention[],
  ): string => {
    const slashSkill = getSlashSkill(skillInvocationState.name, availableSkills);
    const label = slashSkill ? getSkillDescription(slashSkill, t) : `/${skillInvocationState.name}`;

    if (skillInvocationState.name !== 'index') {
      return label;
    }

    const fileMention = mentions.find((mention) => mention.type === 'file');
    const detailParts = [
      fileMention?.display,
      skillInvocationState.indexArgs ? `${skillInvocationState.indexArgs.startPage}-${skillInvocationState.indexArgs.endPage}` : null,
      skillInvocationState.indexArgs?.overviewPagesText
        ? t('pdfToc.overviewPages')
        : null,
    ].filter((part): part is string => Boolean(part));
    return detailParts.length > 0 ? `${label}\n${detailParts.join(' - ')}` : label;
  }, [availableSkills, t]);

  const sendToAgent = useCallback(async ({
    message,
    mentions,
    composerHtml,
    previewContent,
    userBlocks,
    pendingSkillInvocation: skillInvocationState,
  }: {
    message: string;
    mentions: NarreMention[];
    composerHtml: string;
    previewContent?: string;
    userBlocks: NarreTranscriptBlock[];
    pendingSkillInvocation: NarrePendingSkillInvocationState | null;
  }) => {
    let activeSessionId = sessionId;
    const nextTitle = (previewContent ?? message).slice(0, 60);

    if (!activeSessionId) {
      try {
        const session = await narreService.createSession(projectId, { agentKey });
        activeSessionId = session.id;
        promoteNarreDraftSession(projectId, session.id, nextTitle);
        setSessionId(session.id);
        onSessionCreated?.(session.id);
      } catch {
        return false;
      }
    } else {
      primeNarreSession(projectId, activeSessionId, nextTitle);
    }

    const userMsg: NarreDisplayMessage = {
      role: 'user',
      timestamp: new Date().toISOString(),
      blocks: userBlocks,
      source: 'live',
    };
    appendNarreUserMessage(projectId, activeSessionId, userMsg);
    prepareNarreAssistantStream(projectId, activeSessionId, {
      draftHtml: composerHtml,
      pendingSkillInvocation: skillInvocationState,
      userTimestamp: userMsg.timestamp,
    });
    beginNarreAssistantStream(projectId, activeSessionId);
    setNarreSessionDraft(projectId, sessionId, '');
    setNarreSessionDraft(projectId, activeSessionId, '');
    setNarreSessionPendingSkillInvocation(projectId, sessionId, null);
    setNarreSessionPendingSkillInvocation(projectId, activeSessionId, null);
    autoScrollRef.current = true;

    try {
      const runtimeMentions = agentKey && !mentions.some((mention) => mention.type === 'agent' && mention.id === agentKey)
        ? [{ type: 'agent' as const, id: agentKey, display: agentKey }, ...mentions]
        : mentions;
      await narreService.sendMessage({
        sessionId: activeSessionId,
        projectId,
        message,
        mentions: runtimeMentions.length > 0 ? runtimeMentions : undefined,
      });
      return true;
    } catch (error) {
      cancelPendingNarreAssistantTurn(projectId, activeSessionId, {
        draftHtml: composerHtml,
        pendingSkillInvocation: skillInvocationState,
        userTimestamp: userMsg.timestamp,
      });
      appendNarreAssistantErrorMessage(
        projectId,
        activeSessionId,
        error instanceof Error ? error.message : 'Failed to send Narre message',
      );
      return false;
    }
  }, [agentKey, sessionId, projectId, onSessionCreated]);

  const handleSend = useCallback(async ({
    text,
    mentions,
    draftHtml: composerHtml,
    pendingSkillInvocation: skillInvocationState,
  }: NarreComposerSubmit) => {
    if (isStreaming) {
      return false;
    }

    if (!skillInvocationState) {
      if (!text.trim()) {
        return false;
      }

      return sendToAgent({
        message: text,
        mentions,
        composerHtml,
        userBlocks: buildUserDisplayBlocks(text, mentions, null),
        pendingSkillInvocation: null,
      });
    }

    if (skillInvocationState.name === 'index') {
      const fileMention = mentions.find((mention) => mention.type === 'file');
      if (!fileMention || !fileMention.id || !skillInvocationState.indexArgs) {
        return false;
      }

      if (!isPdfMention(fileMention)) {
        return false;
      }

      const absoluteFilePath = toAbsolutePath(
        currentProject?.root_dir ?? '',
        fileMention.path ?? fileMention.display,
      );

      const message = buildIndexMessage(fileMention.display, {
        startPage: skillInvocationState.indexArgs.startPage,
        endPage: skillInvocationState.indexArgs.endPage,
        overviewPages: parseOverviewPagesText(skillInvocationState.indexArgs.overviewPagesText),
        fileId: fileMention.id,
        filePath: absoluteFilePath,
      });

      return sendToAgent({
        message,
        mentions,
        composerHtml,
        previewContent: buildSkillPreview(skillInvocationState, mentions),
        userBlocks: buildUserDisplayBlocks(text, mentions, skillInvocationState),
        pendingSkillInvocation: skillInvocationState,
      });
    }

    const normalizedText = text.trim();
    const preview = buildSkillPreview(skillInvocationState, mentions);

    return sendToAgent({
      message: normalizedText ? `/${skillInvocationState.name}\n${normalizedText}` : `/${skillInvocationState.name}`,
      mentions,
      composerHtml,
      previewContent: normalizedText ? `${preview}\n${normalizedText}` : preview,
      userBlocks: buildUserDisplayBlocks(normalizedText, mentions, skillInvocationState),
      pendingSkillInvocation: skillInvocationState,
    });
  }, [buildSkillPreview, currentProject, isStreaming, projectId, sendToAgent]);

  const title = sessionTitle || t('narre.newChat');
  const agentName = activeAgent ? getLocalizedAgentName(activeAgent, t) : agentKey ?? '';
  const sendLocked = isStreaming;

  const startRenameTitle = useCallback(() => {
    if (!sessionId) return;
    setRenameTitle(title);
    setIsRenamingTitle(true);
    setMoreMenu(null);
  }, [sessionId, title]);

  const cancelRenameTitle = useCallback(() => {
    setIsRenamingTitle(false);
    setRenameTitle('');
  }, []);

  const saveRenameTitle = useCallback(async () => {
    if (!sessionId || isSavingTitle) return;
    const nextTitle = renameTitle.trim();
    if (!nextTitle) return;

    setIsSavingTitle(true);
    try {
      const updated = await narreService.updateSessionTitle(projectId, sessionId, nextTitle);
      setNarreSessionTitle(projectId, sessionId, updated.title || nextTitle);
      cancelRenameTitle();
    } catch (error) {
      appendNarreAssistantErrorMessage(
        projectId,
        sessionId,
        error instanceof Error ? error.message : 'Failed to rename Narre session',
      );
    } finally {
      setIsSavingTitle(false);
    }
  }, [cancelRenameTitle, isSavingTitle, projectId, renameTitle, sessionId]);

  const openMoreMenu = useCallback(() => {
    const rect = moreButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 168;
    setMoreMenu({
      x: Math.max(8, rect.right - menuWidth),
      y: rect.bottom + 4,
    });
  }, []);

  const handleInterrupt = useCallback(async () => {
    if (!sessionId || !isStreaming || isInterrupting) {
      return;
    }

    const shouldRestorePendingTurn = !hasReceivedFirstStreamEvent;

    setNarreSessionInterrupting(projectId, sessionId, true);

    try {
      const interrupted = await narreService.interruptMessage(sessionId);
      if (!interrupted) {
        setNarreSessionInterrupting(projectId, sessionId, false);
        return;
      }

      if (shouldRestorePendingTurn) {
        cancelPendingNarreAssistantTurn(projectId, sessionId, {
          draftHtml: pendingDraftHtml,
          pendingSkillInvocation: pendingDraftSkillInvocation,
          userTimestamp: pendingUserTimestamp,
        });
      }
    } catch (error) {
      setNarreSessionInterrupting(projectId, sessionId, false);
      appendNarreAssistantErrorMessage(
        projectId,
        sessionId,
        error instanceof Error ? error.message : t('narre.interruptFailed'),
      );
    }
  }, [
    hasReceivedFirstStreamEvent,
    isInterrupting,
    isStreaming,
    pendingDraftSkillInvocation,
    pendingDraftHtml,
    pendingUserTimestamp,
    projectId,
    sessionId,
    t,
  ]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleInterrupt();
    };

    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true);
    };
  }, [handleInterrupt, isStreaming]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="group flex items-center gap-3 border-b border-subtle px-3 py-2">
        <IconButton label={t('narre.backToList')} onClick={onBackToList}>
          <ArrowLeft size={16} />
        </IconButton>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isRenamingTitle ? (
            <form
              className="flex min-w-0 max-w-[520px] flex-1 items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void saveRenameTitle();
              }}
            >
              <Input
                autoFocus
                inputSize="sm"
                value={renameTitle}
                disabled={isSavingTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelRenameTitle();
                  }
                }}
              />
              <IconButton
                label={t('common.save')}
                type="submit"
                disabled={!renameTitle.trim() || isSavingTitle}
              >
                <Check size={15} />
              </IconButton>
              <IconButton
                label={t('common.cancel')}
                type="button"
                disabled={isSavingTitle}
                onClick={cancelRenameTitle}
              >
                <X size={15} />
              </IconButton>
            </form>
          ) : (
            <>
              <h2 className="truncate text-sm font-medium text-default">
                {title}
              </h2>
            </>
          )}
          {agentName && (
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-surface-card px-2 py-0.5 text-xs text-secondary">
              <Bot size={12} className="shrink-0" />
              <span className="truncate">{agentName}</span>
            </span>
          )}
        </div>
        {isStreaming && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
            <Spinner size="sm" />
            <span>{isInterrupting ? t('narre.interrupting') : t('narre.streaming')}</span>
          </div>
        )}
        {sessionId && !isRenamingTitle && (
          <IconButton ref={moreButtonRef} label={t('common.more' as never)} onClick={openMoreMenu}>
            <MoreVertical size={16} />
          </IconButton>
        )}
        {moreMenu && (
          <ContextMenu
            x={moreMenu.x}
            y={moreMenu.y}
            onClose={() => setMoreMenu(null)}
            items={[
              {
                label: t('narre.renameSession'),
                onClick: startRenameTitle,
              },
            ] satisfies ContextMenuEntry[]}
          />
        )}
      </div>

      {/* Message area */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <ScrollArea className="flex-1" style={{ overflowY: 'auto' }}>
          <div
            ref={scrollRef}
            className="flex flex-col gap-3 p-4 h-full overflow-y-auto"
            onScroll={handleScroll}
          >
            {messages.length === 0 && !isStreaming && (
              <div className="flex h-full items-center justify-center">
                <p className="text-xs text-muted">{t('narre.startChat')}</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <NarreMessageBubble
                key={idx}
                role={msg.role}
                blocks={msg.blocks}
                onCardRespond={handleCardRespond}
                defaultExpandedInteractiveBlocks={!activePrompt && msg.source === 'live' && msg.role === 'assistant' && idx === messages.length - 1}
              />
            ))}
            {/* Streaming partial message */}
            {isStreaming && streamingBlocks.length > 0 && (
              <NarreMessageBubble
                role="assistant"
                blocks={streamingBlocks}
                onCardRespond={handleCardRespond}
                defaultExpandedInteractiveBlocks={!activePrompt}
                isStreaming
              />
            )}
          </div>
        </ScrollArea>
      )}

      {/* Input area */}
      <div className="px-3 pb-3 pt-2">
        <NarreInputSwitcher
          projectId={projectId}
          onSend={handleSend}
          disabled={isStreaming && !isInterrupting}
          sendDisabled={sendLocked}
          isStreaming={isStreaming}
          stopDisabled={isInterrupting}
          placeholder={t('narre.inputPlaceholder')}
          draftHtml={draftHtml}
          availableSkills={availableSkills}
          pendingSkillInvocation={pendingSkillInvocation}
          activePrompt={activePrompt}
          onPromptRespond={handleCardRespond}
          onStop={handleInterrupt}
          onDraftChange={(nextDraftHtml) => {
            setNarreSessionDraft(projectId, sessionId, nextDraftHtml);
          }}
          onPendingSkillInvocationChange={(nextSkillInvocation) => {
            setNarreSessionPendingSkillInvocation(projectId, sessionId, nextSkillInvocation);
          }}
        />
      </div>
    </div>
  );
}
