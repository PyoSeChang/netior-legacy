import { ipcMain, BrowserWindow } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import http from 'http';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type {
  AgentDefinition,
  IpcResult,
  NarreMessage,
  NarreSessionDetail,
  NarreSessionFileV1,
  NarreSessionFileV2,
  NarreSession,
  NarreStreamEvent,
  NarreToolCall,
  NarreTranscript,
  SkillDefinition,
  SupervisorAgentSessionSnapshot,
  SupervisorEvent,
} from '@netior/shared/types';
import { BUILT_IN_SKILLS, IPC_CHANNELS } from '@netior/shared/constants';
import {
  listRemoteInstancesByWorld,
  listRemoteFilesByWorld,
  listRemoteSchemas,
  listRemoteNetworks,
  listRemoteModels,
  searchRemoteInstances,
} from '../netior-service/netior-service-client';
import {
  getNarreServerBaseUrl,
  isNarreServerRunning,
} from '../process/narre-server-manager';
import {
  getApiKeySettingKey,
  getConfiguredNarreApiKey,
  getConfiguredNarreProvider,
  syncNarreServerWithSettings,
  writeNarreSetting,
} from '../narre/narre-config';
import { getRuntimeLogsDir, getRuntimeNarreDir } from '../runtime/runtime-paths';

const NARRE_TRACE_HEADER = 'x-netior-trace-id';

interface ActiveNarreChatRequest {
  request: http.ClientRequest;
  rootNetworkId: string;
  sessionId: string;
  mainWindow: BrowserWindow;
  cancelled: boolean;
}

const activeNarreChatRequests = new Map<string, ActiveNarreChatRequest>();
const cancelledNarreChatRequests = new WeakSet<http.ClientRequest>();

function getNarreDir(rootNetworkId: string): string {
  const dir = getRuntimeNarreDir(rootNetworkId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSessionsIndex(rootNetworkId: string): { sessions: NarreSession[] } {
  const dir = getNarreDir(rootNetworkId);
  const indexPath = join(dir, 'sessions.json');
  if (!existsSync(indexPath)) {
    return { sessions: [] };
  }
  return JSON.parse(readFileSync(indexPath, 'utf-8'));
}

function saveSessionsIndex(rootNetworkId: string, data: { sessions: NarreSession[] }): void {
  const dir = getNarreDir(rootNetworkId);
  const indexPath = join(dir, 'sessions.json');
  writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8');
}

function cleanupActiveNarreChatRequest(sessionId: string, request: http.ClientRequest): void {
  const activeRequest = activeNarreChatRequests.get(sessionId);
  if (activeRequest?.request === request) {
    activeNarreChatRequests.delete(sessionId);
  }
}

function createEmptyTranscript(): NarreTranscript {
  return { turns: [] };
}

function createEmptySessionFile(): NarreSessionFileV2 {
  return {
    version: 2,
    transcript: createEmptyTranscript(),
  };
}

function isSessionFileV2(value: unknown): value is NarreSessionFileV2 {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NarreSessionFileV2>;
  return candidate.version === 2 && Array.isArray(candidate.transcript?.turns);
}

function toolBlockToLegacyToolCall(block: {
  toolKey: string;
  metadata?: NarreToolCall['metadata'];
  input: Record<string, unknown>;
  output?: string;
  error?: string;
}): NarreToolCall {
  return {
    tool: block.toolKey,
    input: block.input,
    status: block.error ? 'error' : 'success',
    ...(block.metadata ? { metadata: block.metadata } : {}),
    ...(block.output ? { result: block.output } : {}),
    ...(block.error ? { error: block.error } : {}),
  };
}

function transcriptToMessages(transcript: NarreTranscript): NarreMessage[] {
  return transcript.turns.map((turn) => {
    const textBlocks = turn.blocks.filter((block) => block.type === 'rich_text');
    const content = textBlocks.map((block) => block.text).join('\n\n');
    const mentions = textBlocks.flatMap((block) => block.mentions ?? []);
    const toolCalls = turn.blocks
      .filter((block) => block.type === 'tool')
      .map((block) => toolBlockToLegacyToolCall(block));

    return {
      role: turn.role,
      content,
      ...(mentions.length > 0 ? { mentions } : {}),
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      timestamp: turn.createdAt,
    };
  });
}

function normalizeSessionFile(value: unknown): NarreSessionFileV2 {
  if (isSessionFileV2(value)) {
    return value;
  }

  const legacy = value as Partial<NarreSessionFileV1> | null;
  const messages = Array.isArray(legacy?.messages) ? legacy.messages : [];

  return {
    version: 2,
    transcript: {
      turns: messages.map((message) => ({
        id: `turn-${randomUUID()}`,
        role: message.role,
        createdAt: message.timestamp,
        blocks: [
          ...(message.content ? [{
            id: `block-${randomUUID()}`,
            type: 'rich_text' as const,
            text: message.content,
            ...(message.mentions && message.mentions.length > 0 ? { mentions: message.mentions } : {}),
          }] : []),
          ...((message.tool_calls ?? []).map((toolCall) => ({
            id: `block-${randomUUID()}`,
            type: 'tool' as const,
            toolKey: toolCall.tool,
            ...(toolCall.metadata ? { metadata: toolCall.metadata } : {}),
            input: toolCall.input,
            ...(toolCall.result ? { output: toolCall.result } : {}),
            ...(toolCall.error ? { error: toolCall.error } : {}),
          }))),
        ],
      })),
    },
  };
}

function buildSessionDetail(
  session: NarreSession | undefined,
  rootNetworkId: string,
  file: NarreSessionFileV2,
): NarreSessionDetail {
  return {
    ...(session ?? {
      id: '',
      title: '',
      created_at: new Date(0).toISOString(),
      last_message_at: new Date(0).toISOString(),
      message_count: file.transcript.turns.length,
    }),
    rootNetworkId,
    transcript: file.transcript,
    messages: transcriptToMessages(file.transcript),
  };
}

function getNarreServerUrl(path: string): URL {
  const baseUrl = getNarreServerBaseUrl();
  if (!baseUrl) {
    throw new Error('Narre server is not running');
  }

  return new URL(path, baseUrl);
}

async function ensureNarreServerBaseUrl(): Promise<string> {
  const existingBaseUrl = getNarreServerBaseUrl();
  if (existingBaseUrl) {
    return existingBaseUrl;
  }

  try {
    const started = await syncNarreServerWithSettings();
    if (!started) {
      throw new Error('Narre server start was skipped. Check the selected provider and API key.');
    }
  } catch (error) {
    const logPath = join(getRuntimeLogsDir(), 'narre-server.log');
    throw new Error(`${(error as Error).message} See ${logPath}`);
  }

  const restartedBaseUrl = getNarreServerBaseUrl();
  if (!restartedBaseUrl) {
    const logPath = join(getRuntimeLogsDir(), 'narre-server.log');
    throw new Error(`Narre server failed to start. See ${logPath}`);
  }

  return restartedBaseUrl;
}

async function requestNarreServer<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = await ensureNarreServerBaseUrl();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Narre server request failed: ${response.status}`;
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore parse failures and keep the HTTP status message.
    }
    throw new Error(message);
  }

  return await response.json() as T;
}

function summarizeNarreStreamEvent(event: NarreStreamEvent): string {
  switch (event.type) {
    case 'text':
      return `type=text chars=${event.content?.length ?? 0}`;
    case 'tool_start':
      return `type=tool_start tool=${event.tool ?? 'unknown'}`;
    case 'tool_end':
      return `type=tool_end tool=${event.tool ?? 'unknown'}`;
    case 'card':
      return `type=card card=${event.card?.type ?? 'unknown'}`;
    case 'error':
      return `type=error error=${JSON.stringify(event.error ?? '')}`;
    case 'done':
      return `type=done session=${event.sessionId ?? 'unknown'}`;
    default:
      return `type=${(event as { type?: string }).type ?? 'unknown'}`;
  }
}

async function listRemoteNarreSessions(rootNetworkId: string): Promise<NarreSession[]> {
  return requestNarreServer<NarreSession[]>(`/sessions?rootNetworkId=${encodeURIComponent(rootNetworkId)}`);
}

async function listRemoteNarreSkills(rootNetworkId: string): Promise<SkillDefinition[]> {
  return requestNarreServer<SkillDefinition[]>(`/skills?rootNetworkId=${encodeURIComponent(rootNetworkId)}`);
}

async function listRemoteSupervisorAgents(rootNetworkId?: string | null): Promise<AgentDefinition[]> {
  const query = rootNetworkId ? `?rootNetworkId=${encodeURIComponent(rootNetworkId)}` : '';
  return requestNarreServer<AgentDefinition[]>(`/supervisor/agents${query}`);
}

async function listRemoteSupervisorSkills(rootNetworkId: string): Promise<SkillDefinition[]> {
  return requestNarreServer<SkillDefinition[]>(`/supervisor/skills?rootNetworkId=${encodeURIComponent(rootNetworkId)}`);
}

async function listRemoteSupervisorSessions(): Promise<SupervisorAgentSessionSnapshot[]> {
  return requestNarreServer<SupervisorAgentSessionSnapshot[]>('/supervisor/sessions');
}

async function listRemoteSupervisorEvents(afterSeq?: number | null): Promise<SupervisorEvent[]> {
  const query = typeof afterSeq === 'number' ? `?afterSeq=${encodeURIComponent(String(afterSeq))}` : '';
  return requestNarreServer<SupervisorEvent[]>(`/supervisor/events${query}`);
}

async function listRemoteSupervisorRuns(rootNetworkId?: string | null): Promise<unknown[]> {
  const query = rootNetworkId ? `?rootNetworkId=${encodeURIComponent(rootNetworkId)}` : '';
  return requestNarreServer<unknown[]>(`/supervisor/runs${query}`);
}

async function createRemoteSupervisorRun(input: Record<string, unknown>): Promise<unknown> {
  return requestNarreServer<unknown>('/supervisor/runs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function getRemoteSupervisorRun(runId: string): Promise<unknown> {
  return requestNarreServer<unknown>(`/supervisor/runs/${encodeURIComponent(runId)}`);
}

async function planRemoteSupervisorRun(runId: string): Promise<unknown> {
  return requestNarreServer<unknown>(`/supervisor/runs/${encodeURIComponent(runId)}/plan`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

async function runRemoteSupervisorRun(runId: string): Promise<unknown> {
  return requestNarreServer<unknown>(`/supervisor/runs/${encodeURIComponent(runId)}/run`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

async function cancelRemoteSupervisorRun(runId: string): Promise<unknown> {
  return requestNarreServer<unknown>(`/supervisor/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

async function listRemoteSupervisorApprovals(runId: string): Promise<unknown[]> {
  return requestNarreServer<unknown[]>(`/supervisor/runs/${encodeURIComponent(runId)}/approvals`);
}

async function resolveRemoteSupervisorApproval(input: Record<string, unknown>): Promise<unknown> {
  const approvalId = typeof input.approvalId === 'string' ? input.approvalId : '';
  return requestNarreServer<unknown>(`/supervisor/approvals/${encodeURIComponent(approvalId)}/resolve`, {
    method: 'POST',
    body: JSON.stringify({
      status: input.status,
      response: input.response,
    }),
  });
}

async function createRemoteNarreSession(rootNetworkId: string, agentKey?: string | null): Promise<NarreSession> {
  return requestNarreServer<NarreSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ rootNetworkId, agentKey: agentKey ?? null }),
  });
}

async function getRemoteNarreSession(sessionId: string): Promise<NarreSessionDetail> {
  return requestNarreServer<NarreSessionDetail>(`/sessions/${encodeURIComponent(sessionId)}`);
}

async function deleteRemoteNarreSession(sessionId: string): Promise<boolean> {
  const payload = await requestNarreServer<{ success: boolean }>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  return payload.success;
}

async function updateRemoteNarreSessionTitle(rootNetworkId: string, sessionId: string, title: string): Promise<NarreSession> {
  return requestNarreServer<NarreSession>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ rootNetworkId, title }),
  });
}

function emitNarreStreamEvent(
  mainWindow: BrowserWindow,
  event: NarreStreamEvent,
  context: { rootNetworkId?: string; sessionId?: string },
): void {
  if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return;
  }

  try {
    mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, {
      ...event,
      rootNetworkId: event.rootNetworkId ?? context.rootNetworkId,
      sessionId: event.sessionId ?? context.sessionId,
    } satisfies NarreStreamEvent);
  } catch (error) {
    if ((error as Error).message?.includes('Object has been destroyed')) {
      return;
    }
    throw error;
  }
}

export function registerNarreIpc(): void {
  ipcMain.handle(IPC_CHANNELS.NARRE_LIST_SESSIONS, async (_e, rootNetworkId: string): Promise<IpcResult<NarreSession[]>> => {
    try {
      if (isNarreServerRunning()) {
        return { success: true, data: await listRemoteNarreSessions(rootNetworkId) };
      }

      const index = getSessionsIndex(rootNetworkId);
      index.sessions.sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      );
      return { success: true, data: index.sessions };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_LIST_SKILLS, async (_e, rootNetworkId: string): Promise<IpcResult<SkillDefinition[]>> => {
    try {
      return { success: true, data: await listRemoteNarreSkills(rootNetworkId) };
    } catch (err) {
      console.warn(`[narre:bridge] failed to list skills, using built-ins: ${(err as Error).message}`);
      return { success: true, data: [...BUILT_IN_SKILLS] };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_AGENTS,
    async (_e, rootNetworkId?: string | null): Promise<IpcResult<AgentDefinition[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorAgents(rootNetworkId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_SKILLS,
    async (_e, rootNetworkId: string): Promise<IpcResult<SkillDefinition[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorSkills(rootNetworkId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_SESSIONS,
    async (): Promise<IpcResult<SupervisorAgentSessionSnapshot[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorSessions() };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_EVENTS,
    async (_e, afterSeq?: number | null): Promise<IpcResult<SupervisorEvent[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorEvents(afterSeq) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_RUNS,
    async (_e, rootNetworkId?: string | null): Promise<IpcResult<unknown[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorRuns(rootNetworkId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_CREATE_RUN,
    async (_e, input: Record<string, unknown>): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await createRemoteSupervisorRun(input) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_GET_RUN,
    async (_e, runId: string): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await getRemoteSupervisorRun(runId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_PLAN_RUN,
    async (_e, runId: string): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await planRemoteSupervisorRun(runId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_RUN_RUN,
    async (_e, runId: string): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await runRemoteSupervisorRun(runId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_CANCEL_RUN,
    async (_e, runId: string): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await cancelRemoteSupervisorRun(runId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_APPROVALS,
    async (_e, runId: string): Promise<IpcResult<unknown[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorApprovals(runId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_RESOLVE_APPROVAL,
    async (_e, input: Record<string, unknown>): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await resolveRemoteSupervisorApproval(input) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.NARRE_CREATE_SESSION, async (_e, input: string | { rootNetworkId?: unknown; agentKey?: unknown }): Promise<IpcResult<NarreSession>> => {
    try {
      const rootNetworkId = typeof input === 'string' ? input : typeof input.rootNetworkId === 'string' ? input.rootNetworkId : '';
      const agentKey = typeof input === 'object' && typeof input.agentKey === 'string' ? input.agentKey : null;
      if (!rootNetworkId) {
        return { success: false, error: 'rootNetworkId required' };
      }
      if (isNarreServerRunning()) {
        return { success: true, data: await createRemoteNarreSession(rootNetworkId, agentKey) };
      }

      const now = new Date().toISOString();
      const session: NarreSession = {
        id: randomUUID(),
        title: '',
        created_at: now,
        last_message_at: now,
        message_count: 0,
        agentKey,
      };

      const index = getSessionsIndex(rootNetworkId);
      index.sessions.push(session);
      saveSessionsIndex(rootNetworkId, index);

      // Create empty session file
      const dir = getNarreDir(rootNetworkId);
      const sessionPath = join(dir, `session_${session.id}.json`);
      writeFileSync(sessionPath, JSON.stringify(createEmptySessionFile(), null, 2), 'utf-8');

      return { success: true, data: session };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_GET_SESSION, async (_e, sessionId: string): Promise<IpcResult<unknown>> => {
    try {
      if (isNarreServerRunning()) {
        return { success: true, data: await getRemoteNarreSession(sessionId) };
      }

      // We need to search across all world dirs to find the session
      // For now, the sessionId is globally unique, so we scan
      const baseDir = getRuntimeNarreDir();
      if (!existsSync(baseDir)) {
        return { success: false, error: 'Session not found' };
      }

      const { readdirSync } = require('fs');
      const worldDirs = readdirSync(baseDir, { withFileTypes: true })
        .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
        .map((d: { name: string }) => d.name);

      for (const rootNetworkId of worldDirs) {
        const sessionPath = join(baseDir, rootNetworkId, `session_${sessionId}.json`);
        if (existsSync(sessionPath)) {
          const parsed = JSON.parse(readFileSync(sessionPath, 'utf-8')) as unknown;
          const data = normalizeSessionFile(parsed);
          if (!isSessionFileV2(parsed)) {
            writeFileSync(sessionPath, JSON.stringify(data, null, 2), 'utf-8');
          }
          const index = getSessionsIndex(rootNetworkId);
          const sessionMeta = index.sessions.find((s) => s.id === sessionId);
          return { success: true, data: buildSessionDetail(sessionMeta, rootNetworkId, data) };
        }
      }

      return { success: false, error: 'Session not found' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.NARRE_UPDATE_SESSION_TITLE,
    async (_e, input: { rootNetworkId?: unknown; sessionId?: unknown; title?: unknown }): Promise<IpcResult<NarreSession>> => {
      try {
        const rootNetworkId = typeof input.rootNetworkId === 'string' ? input.rootNetworkId : '';
        const sessionId = typeof input.sessionId === 'string' ? input.sessionId : '';
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (!rootNetworkId) {
          return { success: false, error: 'rootNetworkId required' };
        }
        if (!sessionId) {
          return { success: false, error: 'sessionId required' };
        }
        if (!title) {
          return { success: false, error: 'title required' };
        }
        if (isNarreServerRunning()) {
          return { success: true, data: await updateRemoteNarreSessionTitle(rootNetworkId, sessionId, title) };
        }

        const index = getSessionsIndex(rootNetworkId);
        const session = index.sessions.find((s) => s.id === sessionId);
        if (!session) {
          return { success: false, error: 'Session not found' };
        }
        session.title = title;
        saveSessionsIndex(rootNetworkId, index);
        return { success: true, data: session };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.NARRE_DELETE_SESSION, async (_e, sessionId: string): Promise<IpcResult<boolean>> => {
    try {
      if (isNarreServerRunning()) {
        return { success: true, data: await deleteRemoteNarreSession(sessionId) };
      }

      const baseDir = getRuntimeNarreDir();
      if (!existsSync(baseDir)) {
        return { success: false, error: 'Session not found' };
      }

      const { readdirSync } = require('fs');
      const worldDirs = readdirSync(baseDir, { withFileTypes: true })
        .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
        .map((d: { name: string }) => d.name);

      for (const rootNetworkId of worldDirs) {
        const index = getSessionsIndex(rootNetworkId);
        const sessionIdx = index.sessions.findIndex((s) => s.id === sessionId);
        if (sessionIdx >= 0) {
          index.sessions.splice(sessionIdx, 1);
          saveSessionsIndex(rootNetworkId, index);

          const sessionPath = join(baseDir, rootNetworkId, `session_${sessionId}.json`);
          if (existsSync(sessionPath)) {
            unlinkSync(sessionPath);
          }
          return { success: true, data: true };
        }
      }

      return { success: false, error: 'Session not found' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_GET_API_KEY_STATUS, async (): Promise<IpcResult<boolean>> => {
    try {
      const provider = await getConfiguredNarreProvider();
      if (provider === 'codex') {
        return { success: true, data: true };
      }

      const key = await getConfiguredNarreApiKey(provider);
      return { success: true, data: typeof key === 'string' && key.length > 0 };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_SET_API_KEY, async (_e, key: string): Promise<IpcResult<boolean>> => {
    try {
      const provider = await getConfiguredNarreProvider();
      const keySetting = getApiKeySettingKey(provider);
      if (!keySetting) {
        return { success: false, error: 'Selected Narre provider uses local Codex login instead of an API key.' };
      }
      await writeNarreSetting(keySetting, key);
      await syncNarreServerWithSettings();
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_SEARCH_MENTIONS, async (_e, rootNetworkId: string, query: string): Promise<IpcResult<unknown>> => {
    try {
      const results: Array<{
        type: string; id: string; display: string;
        color?: string | null; icon?: string | null;
        description?: string | null; meta?: Record<string, unknown>;
      }> = [];
      const maxResults = 80;
      const categoryLimit = 16;
      const lowerQuery = query.toLowerCase();
      const matches = (parts: Array<string | null | undefined>): boolean => (
        lowerQuery.length === 0
        || parts.some((part) => part?.toLowerCase().includes(lowerQuery))
      );
      const take = <T>(items: T[]): T[] => items.slice(0, categoryLimit);

      const meanings = await listRemoteModels(rootNetworkId);
      const meaningMap = new Map(meanings.map((a) => [a.id, a]));
      const schemas = await listRemoteSchemas(rootNetworkId);
      const schemaMap = new Map(schemas.map((schema) => [schema.id, schema]));
      const instances = lowerQuery.length === 0
        ? await listRemoteInstancesByWorld(rootNetworkId)
        : await searchRemoteInstances(rootNetworkId, query);

      for (const c of take(instances)) {
        const schema = c.schema_id ? schemaMap.get(c.schema_id) : null;
        results.push({
          type: 'instance', id: c.id, display: c.title, color: c.color, icon: c.icon,
          meta: schema
            ? {
              schema: schema.name,
              schemaId: schema.id,
              meaningRefs: schema.meanings,
              meaningDescription: schema.description,
            }
            : { schema: null },
        });
      }

      // Search networks
      const networks = await listRemoteNetworks(rootNetworkId);
      for (const nw of take(networks.filter((nw) => matches([nw.name, nw.kind, nw.scope])))) {
        results.push({
          type: 'network', id: nw.id, display: nw.name,
          description: nw.kind,
          meta: { kind: nw.kind, scope: nw.scope },
        });
      }

      // Search schemas
      for (const schema of take(schemas.filter((schema) => matches([schema.name, schema.description])))) {
        results.push({
          type: 'schema',
          id: schema.id,
          display: schema.name,
          color: schema.color,
          icon: schema.icon,
          description: schema.description,
          meta: { meaningRefs: schema.meanings },
        });
      }

      // Search meanings
      for (const a of take(Array.from(meaningMap.values()).filter((a) => matches([a.name, a.description, a.key])))) {
        results.push({
          type: 'meaning', id: a.id, display: a.name, color: a.color, icon: a.icon,
          description: a.description,
          meta: {
            key: a.key,
            name: a.name,
            sourceKind: a.source_kind,
            sourceRef: a.source_ref,
            lineStyle: a.line_style,
            directed: a.directed,
          },
        });
      }

      // Search file entities
      const files = await listRemoteFilesByWorld(rootNetworkId);
      for (const fe of files) {
        const fileName = fe.path.split('/').pop() ?? fe.path;
        if (results.filter((result) => result.type === 'file').length >= categoryLimit) break;
        if (fileName.toLowerCase().includes(lowerQuery) || fe.path.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'file', id: fe.id, display: fileName,
            meta: { path: fe.path, fileType: fe.type },
          });
        }
      }

      return { success: true, data: results.slice(0, maxResults) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_SEND_MESSAGE, async (_e, data: Record<string, unknown>): Promise<IpcResult<null>> => {
    const traceId = randomUUID();
    const requestStartedAt = Date.now();

    try {
      const { sessionId, rootNetworkId, message, mentions } = data as {
        sessionId?: string;
        rootNetworkId: string;
        message: string;
        mentions?: unknown[];
        skillIds?: unknown[];
      };

      console.log(
        `[narre:bridge] trace=${traceId} stage=request.start session=${sessionId ?? 'new'} ` +
        `world=${rootNetworkId} chars=${message.length} mentions=${mentions?.length ?? 0}`,
      );

      if (!sessionId || typeof sessionId !== 'string') {
        console.error(`[narre:bridge] trace=${traceId} stage=request.error reason=missing-session-id`);
        return { success: false, error: 'sessionId is required for Narre streaming' };
      }

      const mainWindow = BrowserWindow.getAllWindows()[0] ?? null;
      if (!mainWindow) {
        console.error(`[narre:bridge] trace=${traceId} stage=request.error reason=no-main-window`);
        return { success: false, error: 'No main window available' };
      }

      const skillIds = Array.isArray(data.skillIds)
        ? data.skillIds.filter((value): value is string => typeof value === 'string')
        : undefined;
      const body = JSON.stringify({ sessionId, rootNetworkId, message, mentions, skillIds });
      const chatUrl = new URL('/chat', await ensureNarreServerBaseUrl());

      const req = http.request(
        chatUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            [NARRE_TRACE_HEADER]: traceId,
          },
        },
        (res) => {
          let eventCount = 0;
          let streamEnded = false;
          let buffer = '';
          console.log(
            `[narre:bridge] trace=${traceId} stage=response.headers status=${res.statusCode ?? 'unknown'} ` +
            `session=${sessionId}`,
          );

          const forwardEvent = (parsed: NarreStreamEvent, source: 'chunk' | 'buffer'): void => {
            eventCount += 1;
            console.log(
              `[narre:bridge] trace=${traceId} stage=sse.recv source=${source} seq=${eventCount} ` +
              `${summarizeNarreStreamEvent(parsed)}`,
            );
            emitNarreStreamEvent(mainWindow, parsed, { rootNetworkId, sessionId });
          };
          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const eventStr of events) {
              const trimmed = eventStr.trim();
              if (trimmed.startsWith('data: ')) {
                try {
                  const parsed: NarreStreamEvent = JSON.parse(trimmed.slice(6));
                  forwardEvent(parsed, 'chunk');
                } catch (error) {
                  console.error(
                    `[narre:bridge] trace=${traceId} stage=sse.parse_error source=chunk ` +
                    `message=${(error as Error).message}`,
                  );
                }
              }
            }
          });
          res.on('end', () => {
            streamEnded = true;
            cleanupActiveNarreChatRequest(sessionId, req);
            // Process any remaining buffer
            if (buffer.trim().startsWith('data: ')) {
              try {
                const parsed: NarreStreamEvent = JSON.parse(buffer.trim().slice(6));
                forwardEvent(parsed, 'buffer');
              } catch (error) {
                console.error(
                  `[narre:bridge] trace=${traceId} stage=sse.parse_error source=buffer ` +
                  `message=${(error as Error).message}`,
                );
              }
            }
            // Don't send a duplicate done event ??narre-server already sends one via the stream
            console.log(
              `[narre:bridge] trace=${traceId} stage=stream.end events=${eventCount} ` +
              `elapsedMs=${Date.now() - requestStartedAt}`,
            );
          });
          res.on('close', () => {
            if (streamEnded) {
              return;
            }

            console.warn(
              `[narre:bridge] trace=${traceId} stage=stream.close events=${eventCount} ` +
              `elapsedMs=${Date.now() - requestStartedAt}`,
            );
          });
          res.on('error', (err) => {
            if (cancelledNarreChatRequests.has(req)) {
              cleanupActiveNarreChatRequest(sessionId, req);
              return;
            }

            const activeRequest = activeNarreChatRequests.get(sessionId);
            if (activeRequest?.request === req && activeRequest.cancelled) {
              cleanupActiveNarreChatRequest(sessionId, req);
              return;
            }

            cleanupActiveNarreChatRequest(sessionId, req);
            console.error(
              `[narre:bridge] trace=${traceId} stage=stream.error message=${err.message} ` +
              `elapsedMs=${Date.now() - requestStartedAt}`,
            );
            emitNarreStreamEvent(mainWindow, {
              type: 'error',
              error: err.message,
            }, { rootNetworkId, sessionId });
            emitNarreStreamEvent(mainWindow, {
              type: 'done',
            }, { rootNetworkId, sessionId });
          });
        },
      );

      req.on('error', (err) => {
        if (cancelledNarreChatRequests.has(req)) {
          cleanupActiveNarreChatRequest(sessionId, req);
          return;
        }

        const activeRequest = activeNarreChatRequests.get(sessionId);
        if (activeRequest?.request === req && activeRequest.cancelled) {
          cleanupActiveNarreChatRequest(sessionId, req);
          return;
        }

        cleanupActiveNarreChatRequest(sessionId, req);
        console.error(
          `[narre:bridge] trace=${traceId} stage=request.error message=${err.message} ` +
          `elapsedMs=${Date.now() - requestStartedAt}`,
        );
        emitNarreStreamEvent(mainWindow, {
          type: 'error',
          error: `Narre server connection failed: ${err.message}. Check the selected provider auth settings.`,
        }, { rootNetworkId, sessionId });
        // Send done so the UI exits streaming state
        emitNarreStreamEvent(mainWindow, {
          type: 'done',
        }, { rootNetworkId, sessionId });
      });

      const previousRequest = activeNarreChatRequests.get(sessionId);
      if (previousRequest && previousRequest.request !== req) {
        previousRequest.cancelled = true;
        cancelledNarreChatRequests.add(previousRequest.request);
        previousRequest.request.destroy();
      }

      activeNarreChatRequests.set(sessionId, {
        request: req,
        rootNetworkId,
        sessionId,
        mainWindow,
        cancelled: false,
      });

      req.write(body);
      req.end();
      console.log(
        `[narre:bridge] trace=${traceId} stage=request.sent bytes=${Buffer.byteLength(body)} ` +
        `session=${sessionId}`,
      );

      // Return immediately; streaming happens via events
      return { success: true, data: null };
    } catch (err) {
      console.error(
        `[narre:bridge] trace=${traceId} stage=request.setup.error message=${(err as Error).message} ` +
        `elapsedMs=${Date.now() - requestStartedAt}`,
      );
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_INTERRUPT_MESSAGE, async (_e, data: Record<string, unknown>): Promise<IpcResult<boolean>> => {
    try {
      const { sessionId } = data as { sessionId?: string };
      if (!sessionId || typeof sessionId !== 'string') {
        return { success: false, error: 'sessionId is required' };
      }

      const activeRequest = activeNarreChatRequests.get(sessionId);
      if (!activeRequest) {
        return { success: true, data: false };
      }

      activeRequest.cancelled = true;
      cancelledNarreChatRequests.add(activeRequest.request);
      cleanupActiveNarreChatRequest(sessionId, activeRequest.request);
      activeRequest.request.destroy();
      emitNarreStreamEvent(activeRequest.mainWindow, { type: 'done' }, {
        rootNetworkId: activeRequest.rootNetworkId,
        sessionId: activeRequest.sessionId,
      });

      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_STEER_MESSAGE, async (_e, data: Record<string, unknown>): Promise<IpcResult<boolean>> => {
    try {
      const { sessionId, message } = data as { sessionId?: string; message?: string };
      if (!sessionId || typeof sessionId !== 'string') {
        return { success: false, error: 'sessionId is required' };
      }
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return { success: false, error: 'message is required' };
      }

      const body = JSON.stringify({ sessionId, message });
      const steerUrl = new URL('/chat/steer', await ensureNarreServerBaseUrl());

      return new Promise((resolve) => {
        const req = http.request(
          steerUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let responseBody = '';
            res.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
            res.on('end', () => {
              if ((res.statusCode ?? 500) >= 400) {
                try {
                  const parsed = JSON.parse(responseBody) as { error?: string };
                  resolve({ success: false, error: parsed.error ?? 'Failed to steer Narre message' });
                } catch {
                  resolve({ success: false, error: responseBody || 'Failed to steer Narre message' });
                }
                return;
              }
              resolve({ success: true, data: true });
            });
          },
        );
        req.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
        req.write(body);
        req.end();
      });
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_RESPOND_CARD, async (_e, data: Record<string, unknown>): Promise<IpcResult<null>> => {
    try {
      const { sessionId, toolCallId, response } = data as {
        sessionId?: string;
        toolCallId: string;
        response: unknown;
      };

      const body = JSON.stringify({ sessionId, toolCallId, response });
      const respondUrl = new URL('/chat/respond', await ensureNarreServerBaseUrl());

      return new Promise((resolve) => {
        const req = http.request(
          respondUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let responseBody = '';
            res.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
            res.on('end', () => {
              resolve({ success: true, data: null });
            });
          },
        );
        req.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
        req.write(body);
        req.end();
      });
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
