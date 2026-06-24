import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, ChevronDown, ChevronRight, MessageSquare, Pencil, Plus, RefreshCw, Users, X } from 'lucide-react';
import type { AgentDefinition, NarreSession, SupervisorAgentSessionSnapshot, UserAgentRecord } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { narreService } from '../../../services/narre-service';
import { agentService } from '../../../services/agent-service';
import { useI18n } from '../../../hooks/useI18n';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Badge } from '../../ui/Badge';
import { Input } from '../../ui/Input';
import { ScrollArea } from '../../ui/ScrollArea';
import { Spinner } from '../../ui/Spinner';
import { ContextMenu, type ContextMenuEntry } from '../../ui/ContextMenu';
import {
  getLocalizedAgentDescription,
  getLocalizedAgentName,
  getLocalizedAgentScope,
} from './agent-display';

interface NarreHomeProps {
  rootNetworkId: string;
  onSelectSession: (sessionId: string, agentKey?: string | null) => void;
  onNewChat: (agentKey: string) => void;
  onStartAgentTeam: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';

  const diffMs = Date.now() - time;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getAgentKey(agent: AgentDefinition): string {
  if (agent.kind === 'terminal') return `terminal:${agent.terminalAgentType}:${agent.id}`;
  if (agent.narreAgentType === 'system') return `narre:system:${agent.systemAgentType}:${agent.id}`;
  if (agent.userAgentType === 'world') return `narre:user:world:${agent.rootNetworkId}:${agent.id}`;
  return `narre:user:global:${agent.id}`;
}

function getAgentRuntime(agent: AgentDefinition, t: (key: TranslationKey) => string): string {
  const profile = agent.runtimeProfile;
  if (!profile) return getLocalizedAgentScope(agent, t);
  return [profile.provider, profile.model].filter(Boolean).join(' / ');
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

  if (record.userAgentType === 'world') {
    return {
      ...base,
      userAgentType: 'world',
      rootNetworkId: record.rootNetworkId ?? '',
    };
  }

  return {
    ...base,
    userAgentType: 'global',
  };
}

export function NarreHome({
  rootNetworkId,
  onSelectSession,
  onNewChat,
  onStartAgentTeam,
}: NarreHomeProps): JSX.Element {
  const { t } = useI18n();
  const tr = (key: string) => t(key as TranslationKey);
  const newChatMenuButtonRef = React.useRef<HTMLButtonElement>(null);
  const [sessions, setSessions] = useState<NarreSession[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [userAgents, setUserAgents] = useState<UserAgentRecord[]>([]);
  const [agentSessions, setAgentSessions] = useState<SupervisorAgentSessionSnapshot[]>([]);
  const [newChatMenu, setNewChatMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSessions, nextAgents, nextAgentSessions] = await Promise.all([
        narreService.listSessions(rootNetworkId),
        narreService.listSupervisorAgents(rootNetworkId),
        narreService.listSupervisorSessions(),
      ]);
      const nextUserAgents = await agentService.listDefinitions(rootNetworkId);
      setSessions(nextSessions);
      setAgents(nextAgents);
      setUserAgents(nextUserAgents);
      setAgentSessions(nextAgentSessions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [rootNetworkId]);

  const activeByAgentKey = useMemo(() => {
    const map = new Map<string, SupervisorAgentSessionSnapshot>();
    for (const session of agentSessions) {
      if (session.rootNetworkId && session.rootNetworkId !== rootNetworkId) continue;
      const current = map.get(session.agentKey);
      if (!current || current.updatedAt < session.updatedAt) {
        map.set(session.agentKey, session);
      }
    }
    return map;
  }, [agentSessions, rootNetworkId]);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at)),
    [sessions],
  );

  const agentByKey = useMemo(() => {
    const map = new Map<string, AgentDefinition>();
    for (const agent of [
      ...agents,
      ...userAgents.map(userAgentRecordToAgentDefinition),
    ]) {
      map.set(getAgentKey(agent), agent);
    }
    return map;
  }, [agents, userAgents]);

  const chatAgents = useMemo(() => {
    const map = new Map<string, AgentDefinition>();
    for (const agent of agents.filter(isSystemNarreAgent)) {
      map.set(getAgentKey(agent), agent);
    }
    for (const agent of userAgents.map(userAgentRecordToAgentDefinition)) {
      map.set(getAgentKey(agent), agent);
    }
    return Array.from(map.values());
  }, [agents, userAgents]);

  const openNewChatMenu = () => {
    if (chatAgents.length === 0) return;
    const rect = newChatMenuButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 180;
    const estimatedHeight = Math.min(260, 8 + chatAgents.length * 28);
    setNewChatMenu({
      x: Math.max(8, rect.right - menuWidth),
      y: Math.max(8, rect.top - estimatedHeight - 4),
    });
  };

  const startRenameSession = (session: NarreSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || t('narre.newChat'));
  };

  const cancelRenameSession = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const saveSessionTitle = async (session: NarreSession) => {
    const title = editingTitle.trim();
    if (!title || renamingSessionId) return;

    setRenamingSessionId(session.id);
    setError(null);
    try {
      const updated = await narreService.updateSessionTitle(rootNetworkId, session.id, title);
      setSessions((current) => current.map((item) => item.id === updated.id ? updated : item));
      cancelRenameSession();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRenamingSessionId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-surface-editor text-default">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-subtle px-5 py-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase text-muted">{tr('narre.agents')}</div>
            <div className="mt-1 text-lg font-semibold text-default">{tr('narre.agentList')}</div>
          </div>
          <IconButton label={tr('common.refresh' as never)} onClick={() => void load()}>
            <RefreshCw size={16} />
          </IconButton>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : chatAgents.length === 0 ? (
            <div className="rounded-md bg-surface-card px-3 py-4 text-sm text-muted">
              {tr('narre.noAgents')}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {chatAgents.map((agent) => {
                const active = activeByAgentKey.get(getAgentKey(agent));
                const status = active?.status ?? 'idle';
                return (
                  <button
                    key={getAgentKey(agent)}
                    type="button"
                    className="group flex w-full items-start gap-3 rounded-md border border-transparent bg-surface-base px-3 py-3 text-left transition-colors hover:border-subtle hover:bg-surface-card"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-subtle bg-surface-panel text-secondary group-hover:text-default">
                      <Bot size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-default">{getLocalizedAgentName(agent, t)}</span>
                        {status !== 'idle' && <Badge variant={status === 'error' ? 'error' : status === 'blocked' ? 'warning' : 'accent'}>{status}</Badge>}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                        {getLocalizedAgentDescription(agent, t) || getAgentRuntime(agent, t)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col px-8 py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase text-muted">{t('narre.title')}</div>
            <h1 className="mt-1 text-2xl font-semibold text-default">{tr('narre.sessions')}</h1>
            <p className="mt-1 text-sm text-secondary">{tr('narre.homeSubtitle')}</p>
          </div>
          {error && (
            <div className="max-w-sm rounded-md bg-status-error/10 px-3 py-2 text-xs text-status-error">
              {error}
            </div>
          )}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : sortedSessions.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-surface-card text-muted">
                <MessageSquare size={22} />
              </div>
              <div className="mt-4 text-sm font-medium text-default">{t('narre.noSessions')}</div>
              <div className="mt-1 text-xs text-muted">{t('narre.startChat')}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 pb-4">
              {sortedSessions.map((session) => {
                const isEditing = editingSessionId === session.id;
                return (
                <div
                  key={session.id}
                  className="group flex w-full items-center gap-3 rounded-md border border-transparent bg-surface-base px-3 py-3 text-left transition-colors hover:border-subtle hover:bg-surface-card"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-subtle bg-surface-panel text-secondary group-hover:text-default">
                    <MessageSquare size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <form
                        className="flex min-w-0 items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveSessionTitle(session);
                        }}
                      >
                        <Input
                          autoFocus
                          inputSize="sm"
                          value={editingTitle}
                          disabled={renamingSessionId === session.id}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelRenameSession();
                            }
                          }}
                        />
                        <IconButton
                          label={t('common.save')}
                          type="submit"
                          disabled={!editingTitle.trim() || renamingSessionId === session.id}
                        >
                          <Check size={15} />
                        </IconButton>
                        <IconButton
                          label={t('common.cancel')}
                          type="button"
                          disabled={renamingSessionId === session.id}
                          onClick={cancelRenameSession}
                        >
                          <X size={15} />
                        </IconButton>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="block w-full min-w-0 text-left"
                        onClick={() => onSelectSession(session.id, session.agentKey ?? null)}
                      >
                        <div className="truncate text-sm font-medium text-default">
                          {session.title || t('narre.newChat')}
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          {session.agentKey && agentByKey.get(session.agentKey)
                            ? `${getLocalizedAgentName(agentByKey.get(session.agentKey), t)} · `
                            : ''}
                          {formatRelativeTime(session.last_message_at)}
                          {' · '}
                          {t('narre.messageCount', { count: session.message_count })}
                        </div>
                      </button>
                    )}
                  </div>
                  {isEditing ? null : (
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton label={t('narre.renameSession')} onClick={() => startRenameSession(session)}>
                        <Pencil size={14} />
                      </IconButton>
                      <ChevronRight size={16} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex shrink-0 items-center justify-end gap-2 pt-4">
          <div className="inline-flex h-9 overflow-hidden rounded-md border border-subtle bg-surface-panel text-secondary">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 px-3 text-sm font-medium transition-colors hover:bg-state-hover hover:text-default disabled:cursor-not-allowed disabled:opacity-50"
              disabled={chatAgents.length === 0}
              onClick={openNewChatMenu}
            >
              <Plus size={15} />
              {t('narre.newChat')}
            </button>
            <div className="my-1 border-l border-subtle" />
            <button
              ref={newChatMenuButtonRef}
              type="button"
              className="flex h-9 w-8 items-center justify-center transition-colors hover:bg-state-hover hover:text-default disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={tr('narre.chooseAgent')}
              disabled={chatAgents.length === 0}
              onClick={openNewChatMenu}
            >
              <ChevronDown size={15} />
            </button>
          </div>
          <Button onClick={onStartAgentTeam}>
            <Users size={15} />
            {tr('narre.agentTeam')}
          </Button>
        </div>
        {newChatMenu && (
          <ContextMenu
            x={newChatMenu.x}
            y={newChatMenu.y}
            onClose={() => setNewChatMenu(null)}
            items={chatAgents.map((agent) => ({
              label: getLocalizedAgentName(agent, t),
              icon: <Bot size={14} />,
              onClick: () => onNewChat(getAgentKey(agent)),
            })) satisfies ContextMenuEntry[]}
          />
        )}
      </main>
    </div>
  );
}
