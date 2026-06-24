import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Circle,
  Home,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  RefreshCw,
  User,
} from 'lucide-react';
import type {
  AgentApprovalRequest,
  AgentDefinition,
  AgentEvent,
  OrchestrationRun,
  OrchestrationTask,
} from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { narreService, type MentionResult, type OrchestrationSnapshot } from '../../../services/narre-service';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ScrollArea } from '../../ui/ScrollArea';
import { NarreMentionInput, type NarreComposerSubmit } from './NarreMentionInput';
import {
  getLocalizedAgentName,
  getLocalizedAgentRole,
} from './agent-display';

interface AgentTeamProps {
  rootNetworkId: string;
  onBackHome: () => void;
}

type TeamMessageKind = 'user' | 'agent' | 'operator' | 'system' | 'approval' | 'result' | 'error';

interface TeamParticipant {
  key: string;
  name: string;
  role: string;
  taskTitle: string;
  status: string;
}

interface TeamMessage {
  id: string;
  kind: TeamMessageKind;
  speaker: string;
  time: string;
  body: string;
  approval?: AgentApprovalRequest;
}

function tk(key: string): TranslationKey {
  return key as TranslationKey;
}

export function AgentTeam({ rootNetworkId, onBackHome }: AgentTeamProps): JSX.Element {
  const { t } = useI18n();
  const [runs, setRuns] = useState<OrchestrationRun[]>([]);
  const [snapshot, setSnapshot] = useState<OrchestrationSnapshot | null>(null);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [agentSidebarOpen, setAgentSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRunId = snapshot?.run.id ?? runs[0]?.id ?? null;
  const activeRunIdRef = useRef<string | null>(activeRunId);

  useEffect(() => {
    activeRunIdRef.current = activeRunId;
  }, [activeRunId]);

  const refresh = useCallback(async (runId?: string | null) => {
    setError(null);
    try {
      const [nextRuns, nextAgents] = await Promise.all([
        narreService.listSupervisorRuns(rootNetworkId),
        narreService.listSupervisorAgents(rootNetworkId),
      ]);
      setRuns(nextRuns);
      setAgents(nextAgents);
      const targetRunId = runId ?? activeRunIdRef.current ?? nextRuns[0]?.id ?? null;
      setSnapshot(targetRunId ? await narreService.getSupervisorRun(targetRunId) : null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [rootNetworkId]);

  useEffect(() => {
    void refresh(null);
  }, [refresh]);

  const sendTeamRequest = useCallback(async (payload: NarreComposerSubmit) => {
    const request = payload.text.trim();
    if (!request) return false;

    setLoading(true);
    setError(null);
    try {
      const created = await narreService.createSupervisorRun({
        rootNetworkId,
        userRequest: request,
        mode: 'orchestration',
      });
      setSnapshot(created);

      const planned = await narreService.planSupervisorRun(created.run.id);
      setSnapshot(planned);

      const running = await narreService.runSupervisorRun(created.run.id);
      setSnapshot(running);
      await refresh(created.run.id);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [rootNetworkId, refresh]);

  const stopTeamRun = useCallback(async () => {
    const runId = activeRunIdRef.current;
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await narreService.cancelSupervisorRun(runId));
      await refresh(runId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const resolveApproval = useCallback(async (approval: AgentApprovalRequest, status: 'approved' | 'rejected' | 'cancelled') => {
    setLoading(true);
    setError(null);
    try {
      await narreService.resolveSupervisorApproval({
        approvalId: approval.id,
        status,
        response: status,
      });
      await refresh(approval.runId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const agentByKey = useMemo(() => {
    const map = new Map<string, AgentDefinition>();
    for (const agent of agents) {
      map.set(getAgentKey(agent), agent);
    }
    return map;
  }, [agents]);

  const participants = useMemo(
    () => buildParticipants(agents, snapshot?.tasks ?? [], agentByKey, t),
    [agents, agentByKey, snapshot?.tasks, t],
  );

  const participantAgentMentions = useMemo(
    () => buildParticipantAgentMentions(snapshot, agentByKey, t),
    [agentByKey, snapshot, t],
  );

  const messages = useMemo(
    () => buildMessages(snapshot?.events ?? [], snapshot?.approvals ?? [], agentByKey, t),
    [agentByKey, snapshot?.approvals, snapshot?.events, t],
  );

  const sessionTitle = snapshot?.run.userRequest || t(tk('narre.agentTeam'));
  const isRunning = snapshot?.run.status === 'planning' || snapshot?.run.status === 'running' || loading;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-editor text-default">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-subtle px-4">
        <IconButton
          label={agentSidebarOpen ? t(tk('narre.agentTeamUi.hideAgentList')) : t(tk('narre.agentTeamUi.showAgentList'))}
          onClick={() => setAgentSidebarOpen((open) => !open)}
        >
          {agentSidebarOpen ? <PanelLeftClose size={17} /> : <Menu size={17} />}
        </IconButton>
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-secondary transition-colors hover:bg-state-hover hover:text-default"
        >
          <Home size={15} />
          <span>{t(tk('narre.agentTeamUi.home'))}</span>
        </button>
        <div className="ml-2 flex min-w-0 items-center gap-2">
          <MessageSquare size={16} className="shrink-0 text-muted" />
          <span className="truncate text-sm font-semibold text-default">{sessionTitle}</span>
          {snapshot ? <StatusBadge status={snapshot.run.status} /> : <Badge>ready</Badge>}
        </div>
        <IconButton className="ml-auto" label={t('common.refresh' as never)} onClick={() => void refresh()}>
          <RefreshCw size={16} />
        </IconButton>
      </header>

      {error && (
        <div className="border-b border-subtle bg-status-error/10 px-4 py-2 text-xs text-status-error">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {agentSidebarOpen && (
          <aside className="flex w-[316px] shrink-0 flex-col border-r border-subtle px-4 pb-5 pt-2">
            <div className="mb-3 px-1">
              <div className="text-[11px] font-medium uppercase text-muted">{t(tk('narre.agentTeamUi.agentList'))}</div>
              <div className="mt-1 text-sm text-secondary">{t(tk('narre.agentTeamUi.agentListHint'))}</div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-2">
                {participants.map((agent) => (
                  <div key={agent.key} className="rounded-md bg-surface-card px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-hover text-secondary">
                          {agent.key.includes(':operator:') ? <MoreHorizontal size={16} /> : <Bot size={16} />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-default">{agent.name}</div>
                          <div className="mt-0.5 truncate text-xs text-muted">{agent.role}</div>
                        </div>
                      </div>
                      <AgentStatusBadge status={agent.status} />
                    </div>
                    <div className="mt-3 rounded-md bg-surface-hover px-2 py-2">
                      <div className="text-[11px] font-medium uppercase text-muted">{t(tk('narre.agentTeamUi.assignedTask'))}</div>
                      <div className="mt-1 text-xs leading-relaxed text-secondary">{agent.taskTitle || '-'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col px-6 pb-5 pt-2">
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3 pb-4">
              {messages.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  {t(tk('narre.startChat'))}
                </div>
              ) : (
                messages.map((message) => (
                  <ChatBubble key={message.id} message={message} onResolveApproval={resolveApproval} />
                ))
              )}
            </div>
          </ScrollArea>

          <div className="mx-auto w-full max-w-[860px] shrink-0 pt-3">
            <NarreMentionInput
              rootNetworkId={rootNetworkId}
              onSend={sendTeamRequest}
              isStreaming={isRunning}
              stopDisabled={!snapshot || snapshot.run.status === 'completed' || snapshot.run.status === 'failed' || snapshot.run.status === 'cancelled'}
              placeholder={t(tk('narre.agentTeamUi.inputPlaceholder'))}
              allowMentions
              allowSlashSkills={false}
              agentMentions={participantAgentMentions}
              footerLabel={t(tk('narre.agentTeamUi.teamComposerHint'))}
              onStop={stopTeamRun}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onResolveApproval,
}: {
  message: TeamMessage;
  onResolveApproval: (approval: AgentApprovalRequest, status: 'approved' | 'rejected' | 'cancelled') => void;
}): JSX.Element {
  const isUser = message.kind === 'user';
  const isSystem = message.kind === 'system' || message.kind === 'result';
  const isApproval = message.kind === 'approval';
  const isError = message.kind === 'error';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-md bg-surface-card px-3 py-1.5 text-xs text-muted">{message.body}</div>
      </div>
    );
  }

  return (
    <div className={['flex gap-3', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-card text-secondary">
          {isApproval || isError ? <AlertTriangle size={16} /> : message.kind === 'operator' ? <MoreHorizontal size={16} /> : <Bot size={16} />}
        </div>
      )}
      <div className={['max-w-[72%]', isUser ? 'items-end' : 'items-start'].join(' ')}>
        <div className={['mb-1 flex items-center gap-2 text-xs', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
          <span className="font-medium text-secondary">{message.speaker}</span>
          <span className="text-muted">{message.time}</span>
        </div>
        <div
          className={[
            'rounded-md px-3 py-2 text-sm leading-relaxed',
            isUser
              ? 'bg-accent text-on-accent'
              : isApproval
                ? 'bg-status-warning/10 text-default'
                : isError
                  ? 'bg-status-error/10 text-default'
                  : 'bg-surface-card text-default',
          ].join(' ')}
        >
          {message.body}
          {message.approval && message.approval.status === 'pending' && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => onResolveApproval(message.approval as AgentApprovalRequest, 'approved')}>Approve</Button>
              <Button size="sm" variant="secondary" onClick={() => onResolveApproval(message.approval as AgentApprovalRequest, 'rejected')}>Reject</Button>
              <Button size="sm" variant="ghost" onClick={() => onResolveApproval(message.approval as AgentApprovalRequest, 'cancelled')}>Cancel</Button>
            </div>
          )}
        </div>
      </div>
      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-muted text-accent">
          <User size={16} />
        </div>
      )}
    </div>
  );
}

function buildParticipants(
  agents: AgentDefinition[],
  tasks: OrchestrationTask[],
  agentByKey: Map<string, AgentDefinition>,
  t: (key: TranslationKey) => string,
): TeamParticipant[] {
  const taskByAgent = new Map<string, OrchestrationTask>();
  for (const task of tasks) {
    if (task.assignedAgentKey && !taskByAgent.has(task.assignedAgentKey)) {
      taskByAgent.set(task.assignedAgentKey, task);
    }
  }
  const keys = taskByAgent.size > 0 ? Array.from(taskByAgent.keys()) : agents.map(getAgentKey);
  return keys.map((key) => {
    const agent = agentByKey.get(key);
    const task = taskByAgent.get(key);
    return {
      key,
      name: getLocalizedAgentName(agent, t, key),
      role: getLocalizedAgentRole(agent, t),
      taskTitle: task?.title ?? '',
      status: task?.status ?? 'ready',
    };
  }).slice(0, taskByAgent.size > 0 ? undefined : 8);
}

function buildParticipantAgentMentions(
  snapshot: OrchestrationSnapshot | null,
  agentByKey: Map<string, AgentDefinition>,
  t: (key: TranslationKey) => string,
): MentionResult[] {
  if (!snapshot) return [];

  const keys = new Set<string>();
  for (const task of snapshot.tasks) {
    if (task.assignedAgentKey) keys.add(task.assignedAgentKey);
  }
  for (const event of snapshot.events) {
    if (event.agentKey) keys.add(event.agentKey);
  }
  for (const approval of snapshot.approvals) {
    if (approval.agentKey) keys.add(approval.agentKey);
  }

  return Array.from(keys).map((key) => {
    const agent = agentByKey.get(key);
    return {
      type: 'agent',
      id: key,
      display: getLocalizedAgentName(agent, t, key),
      icon: 'bot',
      description: getLocalizedAgentRole(agent, t),
      meta: {
        kind: agent?.kind ?? null,
        provider: agent?.runtimeProfile?.provider ?? null,
        model: agent?.runtimeProfile?.model ?? null,
      },
    };
  });
}

function buildMessages(
  events: AgentEvent[],
  approvals: AgentApprovalRequest[],
  agentByKey: Map<string, AgentDefinition>,
  t: (key: TranslationKey) => string,
): TeamMessage[] {
  const approvalById = new Map(approvals.map((approval) => [approval.id, approval]));
  return events.map((event) => {
    const approvalId = typeof event.payload?.approvalId === 'string' ? event.payload.approvalId : null;
    const approval = approvalId ? approvalById.get(approvalId) : undefined;
    return {
      id: event.id,
      kind: eventToMessageKind(event),
      speaker: event.agentKey ? getLocalizedAgentName(agentByKey.get(event.agentKey), t, event.agentKey) : event.type === 'user_message' ? 'You' : 'Narre',
      time: formatTime(event.createdAt),
      body: event.message || event.type,
      approval,
    };
  });
}

function eventToMessageKind(event: AgentEvent): TeamMessageKind {
  if (event.type === 'user_message') return 'user';
  if (event.type === 'agent_message') return 'agent';
  if (event.type === 'approval_requested' || event.type === 'approval_resolved') return 'approval';
  if (event.type === 'run_completed') return 'result';
  if (event.type === 'error') return 'error';
  if (event.agentKey) return 'agent';
  return 'system';
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const variant = status === 'completed'
    ? 'success'
    : status === 'failed' || status === 'cancelled'
      ? 'error'
      : status === 'blocked'
        ? 'warning'
        : status === 'running'
          ? 'accent'
          : 'default';
  return <Badge variant={variant}>{status}</Badge>;
}

function AgentStatusBadge({ status }: { status: string }): JSX.Element {
  const variant = status === 'completed' || status === 'done'
    ? 'success'
    : status === 'blocked' || status === 'failed'
      ? 'warning'
      : status === 'running' || status === 'assigned'
        ? 'accent'
        : 'default';
  const Icon = status === 'completed' || status === 'done'
    ? CheckCircle2
    : status === 'blocked' || status === 'failed'
      ? AlertTriangle
      : Circle;
  return (
    <Badge variant={variant}>
      <Icon size={11} />
      {status}
    </Badge>
  );
}

function getAgentKey(agent: AgentDefinition): string {
  if (agent.kind === 'terminal') return `terminal:${agent.terminalAgentType}:${agent.id}`;
  if (agent.narreAgentType === 'system') return `narre:system:${agent.systemAgentType}:${agent.id}`;
  if (agent.userAgentType === 'world') return `narre:user:world:${agent.rootNetworkId}:${agent.id}`;
  return `narre:user:global:${agent.id}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
