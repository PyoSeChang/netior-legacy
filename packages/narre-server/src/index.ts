import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { basename, dirname, join } from 'path';
import { existsSync } from 'fs';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import type {
  AgentRuntimeProfile,
  AgentExecutorCommandStatus,
  AgentExecutorStatus,
  CreateAgentAssignmentInput,
  CreateConversationInput,
  CreateOrchestrationRunInput,
  CreateOrchestrationTaskInput,
  AgentEventType,
  OrchestrationRunStatus,
  OrchestrationTaskStatus,
  NarreBehaviorSettings,
  NarreCodexSettings,
  NarreMention,
  NarreStreamEvent,
  SupervisorSessionReport,
} from '@netior/shared/types';
import { normalizeNarreBehaviorSettings } from './system-prompt.js';
import { SessionStore } from './session-store.js';
import { initSSE, sendSSEEvent, endSSE } from './streaming.js';
import { NarreRuntime } from './runtime/narre-runtime.js';
import type { NarreProviderAdapter } from './runtime/provider-adapter.js';
import { ClaudeProviderAdapter } from './providers/claude.js';
import { initNarreLogging } from './logging.js';
import { buildWorldPromptMetadata } from './world-prompt-metadata.js';
import { getWorldById } from './netior-service-client.js';
import { SupervisorRegistry } from './supervisor/supervisor-registry.js';
import { getSupervisorAgentKey } from './supervisor/agent-registry.js';
import { OrchestrationRegistry } from './supervisor/orchestration-registry.js';
import { AgentRuntimeDispatcher } from './supervisor/agent-runtime-dispatcher.js';
import { AgentOperator } from './supervisor/agent-operator.js';
import { ExecutorRegistry } from './supervisor/executor-registry.js';

const currentFilePath = typeof __filename === 'string'
  ? __filename
  : fileURLToPath(import.meta.url);
const currentDir = typeof __dirname === 'string'
  ? __dirname
  : dirname(currentFilePath);
const require = createRequire(currentFilePath);
const electronResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const MOC_DATA_DIR = process.env.MOC_DATA_DIR;
const NETIOR_SHARED_USER_DATA_ROOT = process.env.NETIOR_SHARED_USER_DATA_ROOT;
const NARRE_GLOBAL_USER_AGENT_ID = process.env.NARRE_GLOBAL_USER_AGENT_ID;
const NARRE_WORLD_USER_AGENT_ID = process.env.NARRE_WORLD_USER_AGENT_ID;
const NARRE_TRACE_HEADER = 'x-netior-trace-id';

if (!MOC_DATA_DIR) {
  console.error('Error: MOC_DATA_DIR environment variable is required');
  process.exit(1);
}

const narreLogFilePath = initNarreLogging(MOC_DATA_DIR);
console.log(`[narre] Log file: ${narreLogFilePath}`);

function summarizeStreamEvent(event: NarreStreamEvent): string {
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

// UI tools may block waiting for user interaction, so extend stream close timeout.
process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT = process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT || '300000';

const sessionStore = new SessionStore(MOC_DATA_DIR);
const sharedUserDataRootDir = NETIOR_SHARED_USER_DATA_ROOT ?? inferSharedUserDataRoot(MOC_DATA_DIR);
const supervisor = new SupervisorRegistry({
  globalUserAgentId: NARRE_GLOBAL_USER_AGENT_ID,
  worldUserAgentId: NARRE_WORLD_USER_AGENT_ID,
});
const orchestration = new OrchestrationRegistry({
  storagePath: join(MOC_DATA_DIR, 'narre', 'supervisor', 'orchestration.json'),
});
const executors = new ExecutorRegistry({
  storagePath: join(MOC_DATA_DIR, 'narre', 'supervisor', 'executors.json'),
});
const behaviorSettings = parseBehaviorSettings();
const codexSettings = parseCodexSettings();
const providerAdapterCache = new Map<string, Promise<NarreProviderAdapter>>();
let provider!: NarreProviderAdapter;
let runtime!: NarreRuntime;
let dispatcher!: AgentRuntimeDispatcher;
let agentOperator!: AgentOperator;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/sessions', async (req, res) => {
  const rootNetworkId = req.query.rootNetworkId as string;
  if (!rootNetworkId) {
    res.status(400).json({ error: 'rootNetworkId required' });
    return;
  }
  try {
    res.json(await sessionStore.listSessions(rootNetworkId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/skills', async (req, res) => {
  const rootNetworkId = req.query.rootNetworkId as string;
  if (!rootNetworkId) {
    res.status(400).json({ error: 'rootNetworkId required' });
    return;
  }
  try {
    res.json(await runtime.listSkills(rootNetworkId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/agents', (req, res) => {
  const rootNetworkId = typeof req.query.rootNetworkId === 'string' ? req.query.rootNetworkId : null;
  res.json(supervisor.listAgents(rootNetworkId));
});

app.get('/supervisor/skills', async (req, res) => {
  const rootNetworkId = req.query.rootNetworkId as string;
  if (!rootNetworkId) {
    res.status(400).json({ error: 'rootNetworkId required' });
    return;
  }
  try {
    res.json(await runtime.listSkills(rootNetworkId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/sessions', (_req, res) => {
  res.json(supervisor.listSessions());
});

app.get('/supervisor/events', (req, res) => {
  const afterSeq = typeof req.query.afterSeq === 'string'
    ? Number.parseInt(req.query.afterSeq, 10)
    : null;
  res.json(supervisor.listEvents(Number.isFinite(afterSeq) ? afterSeq : null));
});

app.post('/supervisor/sessions/report', (req, res) => {
  const report = req.body as Partial<SupervisorSessionReport>;
  if (!isSupervisorSessionReport(report)) {
    res.status(400).json({ error: 'invalid supervisor session report' });
    return;
  }

  res.json(supervisor.reportSession(report));
});

app.get('/supervisor/conversations', (req, res) => {
  const rootNetworkId = typeof req.query.rootNetworkId === 'string' ? req.query.rootNetworkId : null;
  res.json(orchestration.listConversations(rootNetworkId));
});

app.post('/supervisor/conversations', (req, res) => {
  const input = req.body as Partial<CreateConversationInput>;
  if (!isCreateConversationInput(input)) {
    res.status(400).json({ error: 'invalid conversation input' });
    return;
  }

  try {
    res.json(orchestration.createConversation(input));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/runs', (req, res) => {
  const rootNetworkId = typeof req.query.rootNetworkId === 'string' ? req.query.rootNetworkId : null;
  res.json(orchestration.listRuns(rootNetworkId));
});

app.post('/supervisor/runs', (req, res) => {
  const input = req.body as Partial<CreateOrchestrationRunInput>;
  if (!isCreateRunInput(input)) {
    res.status(400).json({ error: 'invalid orchestration run input' });
    return;
  }

  try {
    res.json(orchestration.createRun(input));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/runs/:id/plan', async (req, res) => {
  try {
    res.json(await agentOperator.planRun(req.params.id));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/runs/:id/run', async (req, res) => {
  try {
    res.json(await agentOperator.runPlannedRun(req.params.id));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/runs/:id/cancel', (req, res) => {
  try {
    res.json(orchestration.cancelRun(req.params.id, 'Run cancelled by user'));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/runs/:id', (req, res) => {
  const snapshot = orchestration.getRunSnapshot(req.params.id);
  if (!snapshot) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(snapshot);
});

app.get('/supervisor/runs/:id/events', (req, res) => {
  const afterSeq = typeof req.query.afterSeq === 'string'
    ? Number.parseInt(req.query.afterSeq, 10)
    : null;
  res.json(orchestration.listEvents(req.params.id, Number.isFinite(afterSeq) ? afterSeq : null));
});

app.post('/supervisor/tasks', (req, res) => {
  const input = req.body as Partial<CreateOrchestrationTaskInput>;
  if (!isCreateTaskInput(input)) {
    res.status(400).json({ error: 'invalid orchestration task input' });
    return;
  }

  try {
    res.json(orchestration.createTask(input));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/tasks/:id/status', (req, res) => {
  const { status, result } = req.body as { status?: unknown; result?: unknown };
  if (!isTaskStatus(status)) {
    res.status(400).json({ error: 'invalid task status' });
    return;
  }

  try {
    res.json(orchestration.updateTaskStatus(
      req.params.id,
      status,
      typeof result === 'string' ? result : null,
    ));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/assignments', (req, res) => {
  const input = req.body as Partial<CreateAgentAssignmentInput>;
  if (!isCreateAssignmentInput(input)) {
    res.status(400).json({ error: 'invalid agent assignment input' });
    return;
  }

  try {
    res.json(orchestration.assignTask(input));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/assignments/:id/run', async (req, res) => {
  try {
    res.json(await dispatcher.runAssignment(req.params.id));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/runs/:id/approvals', (req, res) => {
  res.json(orchestration.listApprovals(req.params.id));
});

app.post('/supervisor/approvals/:id/resolve', (req, res) => {
  const { status, response } = req.body as { status?: unknown; response?: unknown };
  if (status !== 'approved' && status !== 'rejected' && status !== 'cancelled') {
    res.status(400).json({ error: 'invalid approval status' });
    return;
  }

  try {
    res.json(orchestration.resolveApproval({
      approvalId: req.params.id,
      status,
      response: typeof response === 'string' ? response : null,
    }));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/executors', (req, res) => {
  const rootNetworkId = typeof req.query.rootNetworkId === 'string' ? req.query.rootNetworkId : null;
  res.json(executors.list(rootNetworkId));
});

app.post('/supervisor/executors/register', (req, res) => {
  const body = req.body as {
    id?: unknown;
    rootNetworkId?: unknown;
    provider?: unknown;
    surface?: unknown;
    capabilities?: unknown;
    metadata?: unknown;
  };
  if (
    typeof body.provider !== 'string'
    || !isAgentSurfaceRef(body.surface)
  ) {
    res.status(400).json({ error: 'invalid executor registration input' });
    return;
  }

  const executor = executors.register({
    id: typeof body.id === 'string' ? body.id : undefined,
    rootNetworkId: typeof body.rootNetworkId === 'string' ? body.rootNetworkId : null,
    provider: body.provider as never,
    surface: body.surface,
    capabilities: Array.isArray(body.capabilities)
      ? body.capabilities.filter((value): value is string => typeof value === 'string')
      : [],
    metadata: isStringRecord(body.metadata) ? body.metadata : undefined,
  });
  if (typeof req.query.runId === 'string') {
    orchestration.recordEvent({
      runId: req.query.runId,
      type: 'executor_registered',
      message: `Executor ${executor.id} registered`,
      payload: { executor },
    });
  }
  res.json(executor);
});

app.post('/supervisor/executors/:id/heartbeat', (req, res) => {
  const body = req.body as {
    status?: unknown;
    currentAssignmentId?: unknown;
    metadata?: unknown;
  };
  if (body.status !== undefined && !isExecutorStatus(body.status)) {
    res.status(400).json({ error: 'invalid executor status' });
    return;
  }

  try {
    res.json(executors.heartbeat(req.params.id, {
      status: body.status,
      currentAssignmentId: typeof body.currentAssignmentId === 'string' ? body.currentAssignmentId : null,
      metadata: isStringRecord(body.metadata) ? body.metadata : undefined,
    }));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/executors/:id/commands', (req, res) => {
  const body = req.body as {
    type?: unknown;
    payload?: unknown;
    runId?: unknown;
    taskId?: unknown;
    assignmentId?: unknown;
    agentKey?: unknown;
  };
  if (!isExecutorCommandType(body.type)) {
    res.status(400).json({ error: 'invalid executor command type' });
    return;
  }

  try {
    const command = executors.queueCommand({
      executorId: req.params.id,
      type: body.type,
      payload: isPlainObject(body.payload) ? body.payload : {},
      runId: typeof body.runId === 'string' ? body.runId : null,
      taskId: typeof body.taskId === 'string' ? body.taskId : null,
      assignmentId: typeof body.assignmentId === 'string' ? body.assignmentId : null,
      agentKey: typeof body.agentKey === 'string' ? body.agentKey : null,
    });
    if (command.runId) {
      orchestration.recordEvent({
        runId: command.runId,
        taskId: command.taskId ?? null,
        assignmentId: command.assignmentId ?? null,
        agentKey: command.agentKey ?? null,
        sessionId: `executor:${req.params.id}`,
        type: 'terminal_command',
        message: `Queued ${command.type} on ${req.params.id}`,
        payload: { command },
      });
    }
    res.json(command);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/executors/:id/commands', (req, res) => {
  try {
    res.json(executors.claimCommands(req.params.id));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/executors/:executorId/commands/:commandId/result', (req, res) => {
  const body = req.body as { status?: unknown; result?: unknown; error?: unknown };
  if (!isTerminalCommandResultStatus(body.status)) {
    res.status(400).json({ error: 'invalid command status' });
    return;
  }

  try {
    const command = executors.completeCommand(req.params.commandId, {
      status: body.status,
      result: isPlainObject(body.result) ? body.result : null,
      error: typeof body.error === 'string' ? body.error : null,
    });
    if (command.assignmentId) {
      orchestration.updateAssignment({
        assignmentId: command.assignmentId,
        status: command.status === 'completed' ? 'completed' : command.status === 'cancelled' ? 'cancelled' : 'failed',
        result: typeof body.error === 'string' ? body.error : JSON.stringify(command.result ?? {}),
      });
    }
    if (command.runId) {
      orchestration.recordEvent({
        runId: command.runId,
        taskId: command.taskId ?? null,
        assignmentId: command.assignmentId,
        agentKey: command.agentKey ?? null,
        sessionId: `executor:${req.params.executorId}`,
        type: command.status === 'completed' ? 'agent_message' : 'error',
        message: command.status === 'completed' ? 'Terminal command completed' : command.error,
        payload: { command },
      });
    }
    res.json(command);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/runs/:id/events', (req, res) => {
  const body = req.body as {
    type?: unknown;
    message?: unknown;
    taskId?: unknown;
    assignmentId?: unknown;
    sessionId?: unknown;
    agentKey?: unknown;
    payload?: unknown;
  };
  if (!isAgentEventType(body.type)) {
    res.status(400).json({ error: 'invalid agent event type' });
    return;
  }

  try {
    res.json(orchestration.recordEvent({
      runId: req.params.id,
      type: body.type,
      message: typeof body.message === 'string' ? body.message : null,
      taskId: typeof body.taskId === 'string' ? body.taskId : null,
      assignmentId: typeof body.assignmentId === 'string' ? body.assignmentId : null,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
      agentKey: typeof body.agentKey === 'string' ? body.agentKey : null,
      payload: isPlainObject(body.payload) ? body.payload as Record<string, unknown> : undefined,
    }));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/supervisor/runs/:id/status', (req, res) => {
  const { status, result } = req.body as { status?: unknown; result?: unknown };
  if (!isRunStatus(status)) {
    res.status(400).json({ error: 'invalid run status' });
    return;
  }

  try {
    res.json(orchestration.updateRunStatus(
      req.params.id,
      status,
      typeof result === 'string' ? result : null,
    ));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/sessions', async (req, res) => {
  const { rootNetworkId, agentKey } = req.body as { rootNetworkId?: string; agentKey?: unknown };
  if (!rootNetworkId) {
    res.status(400).json({ error: 'rootNetworkId required' });
    return;
  }
  try {
    res.json(await sessionStore.createSession(rootNetworkId, undefined, typeof agentKey === 'string' ? agentKey : null));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/sessions/:id', async (req, res) => {
  try {
    const rootNetworkId = req.query.rootNetworkId as string | undefined;
    const result = rootNetworkId
      ? await sessionStore.getSession(req.params.id, rootNetworkId)
      : await sessionStore.getSessionById(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.patch('/sessions/:id', async (req, res) => {
  const rootNetworkId = typeof req.body?.rootNetworkId === 'string'
    ? req.body.rootNetworkId
    : req.query.rootNetworkId as string | undefined;
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';

  if (!rootNetworkId) {
    res.status(400).json({ error: 'rootNetworkId required' });
    return;
  }
  if (!title) {
    res.status(400).json({ error: 'title required' });
    return;
  }

  try {
    const session = await sessionStore.updateSessionTitle(req.params.id, rootNetworkId, title);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/sessions/:id', async (req, res) => {
  try {
    const rootNetworkId = req.query.rootNetworkId as string | undefined;
    const deleted = rootNetworkId
      ? await sessionStore.deleteSession(req.params.id, rootNetworkId)
      : await sessionStore.deleteSessionById(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/chat/respond', async (req, res) => {
  const { sessionId, toolCallId, response } = req.body;
  if (!toolCallId) {
    res.status(400).json({ error: 'toolCallId required' });
    return;
  }
  const resolved = runtime.resolveUiCall(toolCallId, response);
  if (!resolved) {
    res.status(404).json({ error: 'No pending UI call' });
    return;
  }

  if (typeof sessionId === 'string') {
    await sessionStore.updateCardResponseById(sessionId, toolCallId, response);
  }

  res.json({ ok: true });
});

app.post('/chat/steer', async (req, res) => {
  const { sessionId, message } = req.body as {
    sessionId?: unknown;
    message?: unknown;
  };

  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    res.status(400).json({ error: 'sessionId required' });
    return;
  }

  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  try {
    const steered = await runtime.steer(sessionId, message);
    if (!steered) {
      res.status(409).json({ error: 'No active steerable Narre run' });
      return;
    }

    const session = await sessionStore.getSessionById(sessionId);
    if (session?.rootNetworkId) {
      await sessionStore.appendMessage(sessionId, session.rootNetworkId, {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/chat', async (req, res) => {
  const { sessionId, rootNetworkId, message, mentions, agentKey, skillIds } = req.body as {
    sessionId?: string;
    rootNetworkId: string;
    message: string;
    mentions?: NarreMention[];
    agentKey?: string | null;
    skillIds?: unknown[];
  };
  const traceId = req.get(NARRE_TRACE_HEADER) || randomUUID();
  const requestStartedAt = Date.now();
  let streamEventCount = 0;
  let responseCompleted = false;

  const emitEvent = (event: NarreStreamEvent): void => {
    streamEventCount += 1;
    console.log(
      `[narre:server] trace=${traceId} stage=sse.send seq=${streamEventCount} ${summarizeStreamEvent(event)}`,
    );
    sendSSEEvent(res, event);
  };

  if (!rootNetworkId || !message) {
    res.status(400).json({ error: 'rootNetworkId and message are required' });
    return;
  }

  const abortController = new AbortController();
  const abortRun = (): void => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };
  req.on('aborted', abortRun);
  res.on('close', abortRun);
  res.setHeader('X-Netior-Trace-Id', traceId);
  initSSE(res);
  res.on('close', () => {
    if (responseCompleted) {
      return;
    }

    console.warn(
      `[narre:server] trace=${traceId} stage=client.closed events=${streamEventCount} ` +
      `elapsedMs=${Date.now() - requestStartedAt}`,
    );
  });

  try {
    console.log(
      `[narre:server] trace=${traceId} stage=request.accept provider=${provider.name} ` +
      `world=${rootNetworkId} session=${sessionId ?? 'new'} ` +
      `chars=${message.length} mentions=${mentions?.length ?? 0}`,
    );

    const session = sessionId ? await sessionStore.getSession(sessionId, rootNetworkId) : null;
    const effectiveAgentKey = agentKey ?? session?.agentKey ?? mentions?.find((mention) => mention.type === 'agent')?.id ?? null;
    const activeAgent = effectiveAgentKey
      ? supervisor.listAgents(rootNetworkId).find((agent) => getSupervisorAgentKey(agent) === effectiveAgentKey)
      : undefined;

    const result = await runtime.runChat(
      {
        sessionId,
        rootNetworkId,
        message,
        mentions,
        traceId,
        activeAgent,
        skillIds: Array.isArray(skillIds)
          ? skillIds.filter((value): value is string => typeof value === 'string')
          : undefined,
      },
      {
        onText: (content) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'text', content });
          }
        },
        onToolStart: (tool, toolInput, toolMetadata) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'tool_start', tool, toolInput, toolMetadata });
          }
        },
        onToolEnd: (tool, toolResult, toolMetadata) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'tool_end', tool, toolResult, toolMetadata });
          }
        },
        onCard: (card) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'card', card });
          }
        },
        onError: (error) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'error', error });
          }
        },
      },
      abortController.signal,
    );
    if (abortController.signal.aborted || res.writableEnded) {
      return;
    }
    console.log(
      `[narre:server] trace=${traceId} stage=request.completed provider=${provider.name} ` +
      `session=${result.sessionId} events=${streamEventCount} elapsedMs=${Date.now() - requestStartedAt}`,
    );
    emitEvent({ type: 'done', sessionId: result.sessionId });
  } catch (error) {
    if (abortController.signal.aborted || res.writableEnded) {
      return;
    }
    console.error(
      `[narre:server] trace=${traceId} stage=request.error ` +
      `message=${(error as Error).stack ?? (error as Error).message}`,
    );
    emitEvent({ type: 'error', error: (error as Error).message });
    emitEvent({ type: 'done', sessionId });
  } finally {
    responseCompleted = true;
    console.log(
      `[narre:server] trace=${traceId} stage=response.end events=${streamEventCount} ` +
      `elapsedMs=${Date.now() - requestStartedAt}`,
    );
    if (!res.writableEnded) {
      endSSE(res);
    }
  }
});

async function initializeRuntime(): Promise<{ provider: NarreProviderAdapter; runtime: NarreRuntime }> {
  const provider = await createProviderAdapter(process.env.NARRE_PROVIDER ?? 'claude');
  const runtime = new NarreRuntime({
    ...createRuntimeConfig(provider),
  });
  return { provider, runtime };
}

function createRuntimeConfig(provider: NarreProviderAdapter): ConstructorParameters<typeof NarreRuntime>[0] {
  return {
    behaviorSettings,
    provider,
    resolveMcpServerPath,
    resolvePromptMetadata: buildWorldPromptMetadata,
    resolveWorldRootDir,
    sharedUserDataRootDir,
    globalUserAgentId: NARRE_GLOBAL_USER_AGENT_ID,
    worldUserAgentId: NARRE_WORLD_USER_AGENT_ID,
    supervisor,
    sessionStore,
  };
}

async function createRuntimeForProfile(runtimeProfile: AgentRuntimeProfile): Promise<NarreRuntime> {
  const provider = await getCachedProviderAdapter(runtimeProfile.provider, runtimeProfile.model);
  return new NarreRuntime(createRuntimeConfig(provider));
}

function getProviderCacheKey(providerName: string, modelOverride?: string): string {
  return `${providerName}:${modelOverride ?? ''}`;
}

async function getCachedProviderAdapter(providerName: string, modelOverride?: string): Promise<NarreProviderAdapter> {
  const cacheKey = getProviderCacheKey(providerName, modelOverride);
  let cached = providerAdapterCache.get(cacheKey);
  if (!cached) {
    cached = createProviderAdapter(providerName, modelOverride);
    providerAdapterCache.set(cacheKey, cached);
  }
  return cached;
}

function inferSharedUserDataRoot(dataDir: string): string {
  return basename(dataDir) === 'data'
    ? dirname(dataDir)
    : dataDir;
}

async function resolveWorldRootDir(rootNetworkId: string): Promise<string | null> {
  const world = await getWorldById(rootNetworkId);
  if (!world) {
    throw new Error(`World not found: ${rootNetworkId}`);
  }
  return world.root_dir;
}

function isSupervisorSessionReport(value: unknown): value is SupervisorSessionReport {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const report = value as Partial<SupervisorSessionReport>;
  if (typeof report.sessionId !== 'string' || report.sessionId.length === 0) {
    return false;
  }
  if (!report.agent || typeof report.agent !== 'object' || typeof report.agent.id !== 'string') {
    return false;
  }
  if (
    !report.surface
    || typeof report.surface !== 'object'
    || (report.surface.kind !== 'terminal' && report.surface.kind !== 'editor')
    || typeof report.surface.id !== 'string'
  ) {
    return false;
  }

  return true;
}

function isCreateConversationInput(value: unknown): value is CreateConversationInput {
  if (!isPlainObject(value)) {
    return false;
  }
  return typeof value.rootNetworkId === 'string' && value.rootNetworkId.length > 0;
}

function isCreateRunInput(value: unknown): value is CreateOrchestrationRunInput {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.rootNetworkId === 'string'
    && value.rootNetworkId.length > 0
    && typeof value.userRequest === 'string'
    && value.userRequest.trim().length > 0
  );
}

function isCreateTaskInput(value: unknown): value is CreateOrchestrationTaskInput {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.runId === 'string'
    && value.runId.length > 0
    && typeof value.title === 'string'
    && value.title.trim().length > 0
    && typeof value.input === 'string'
  );
}

function isCreateAssignmentInput(value: unknown): value is CreateAgentAssignmentInput {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.runId === 'string'
    && value.runId.length > 0
    && typeof value.taskId === 'string'
    && value.taskId.length > 0
    && typeof value.agentKey === 'string'
    && value.agentKey.length > 0
  );
}

function isRunStatus(value: unknown): value is OrchestrationRunStatus {
  return value === 'planning'
    || value === 'running'
    || value === 'blocked'
    || value === 'completed'
    || value === 'failed'
    || value === 'cancelled';
}

function isTaskStatus(value: unknown): value is OrchestrationTaskStatus {
  return value === 'pending'
    || value === 'assigned'
    || value === 'running'
    || value === 'blocked'
    || value === 'completed'
    || value === 'failed'
    || value === 'cancelled';
}

function isAgentEventType(value: unknown): value is AgentEventType {
  return value === 'user_message'
    || value === 'agent_message'
    || value === 'task_created'
    || value === 'task_assigned'
    || value === 'task_started'
    || value === 'task_completed'
    || value === 'handoff'
    || value === 'tool_call'
    || value === 'executor_registered'
    || value === 'executor_heartbeat'
    || value === 'terminal_command'
    || value === 'approval_requested'
    || value === 'approval_resolved'
    || value === 'error'
    || value === 'run_completed';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isPlainObject(value)
    && Object.values(value).every((entry) => typeof entry === 'string');
}

function isAgentSurfaceRef(value: unknown): value is { kind: 'terminal' | 'editor'; id: string } {
  return isPlainObject(value)
    && (value.kind === 'terminal' || value.kind === 'editor')
    && typeof value.id === 'string'
    && value.id.length > 0;
}

function isExecutorStatus(value: unknown): value is AgentExecutorStatus {
  return value === 'online' || value === 'offline' || value === 'busy';
}

function isExecutorCommandType(value: unknown): value is 'launch_agent' | 'send_input' | 'interrupt' | 'attach_session' {
  return value === 'launch_agent'
    || value === 'send_input'
    || value === 'interrupt'
    || value === 'attach_session';
}

function isTerminalCommandResultStatus(
  value: unknown,
): value is Extract<AgentExecutorCommandStatus, 'completed' | 'failed' | 'cancelled'> {
  return value === 'completed' || value === 'failed' || value === 'cancelled';
}

function resolveMcpServerPath(): string | null {
  const candidates = [
    join(electronResourcesPath ?? '', 'sidecars', 'netior-mcp', 'dist', 'index.cjs'),
    join(electronResourcesPath ?? '', 'sidecars', 'netior-mcp', 'dist', 'index.js'),
    join(currentDir, '../../mcp/dist/index.cjs'),
    join(currentDir, '../../mcp/dist/index.js'),
    join(currentDir, '../../netior-mcp/dist/index.cjs'),
    join(currentDir, '../../netior-mcp/dist/index.js'),
    join(currentDir, '../../../netior-mcp/dist/index.cjs'),
    join(currentDir, '../../../netior-mcp/dist/index.js'),
    join(currentDir, '../../mcp/dist-trace/index.cjs'),
    join(currentDir, '../../mcp/dist-trace/index.js'),
    join(currentDir, '../../netior-mcp/dist-trace/index.cjs'),
    join(currentDir, '../../netior-mcp/dist-trace/index.js'),
    join(currentDir, '../../../netior-mcp/dist-trace/index.cjs'),
    join(currentDir, '../../../netior-mcp/dist-trace/index.js'),
    join(process.cwd(), 'packages/netior-mcp/dist/index.cjs'),
    join(process.cwd(), 'packages/netior-mcp/dist/index.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  try {
    const resolved = require.resolve('@netior/mcp');
    const unpacked = toUnpackedAsarPath(resolved);
    if (unpacked && existsSync(unpacked)) {
      return unpacked;
    }
    if (existsSync(resolved)) {
      return resolved;
    }
  } catch {
    // Ignore and fall through to null.
  }

  return null;
}

function toUnpackedAsarPath(resolvedPath: string): string | null {
  const marker = `${process.platform === 'win32' ? '\\' : '/'}app.asar${process.platform === 'win32' ? '\\' : '/'}`;
  if (!resolvedPath.includes(marker)) {
    return null;
  }

  return resolvedPath.replace(marker, marker.replace('app.asar', 'app.asar.unpacked'));
}

async function createProviderAdapter(providerName: string, modelOverride?: string): Promise<NarreProviderAdapter> {
  switch (providerName) {
    case 'claude':
      return new ClaudeProviderAdapter();
    case 'openai': {
      const { OpenAIProviderAdapter } = await import('./providers/openai.js');
      return new OpenAIProviderAdapter({
        dataDir: MOC_DATA_DIR!,
        model: modelOverride ?? process.env.NARRE_OPENAI_MODEL,
      });
    }
    case 'codex': {
      const { CodexProviderAdapter } = await import('./providers/codex.js');
      return new CodexProviderAdapter({
        dataDir: MOC_DATA_DIR!,
        model: modelOverride ?? process.env.NARRE_CODEX_MODEL,
        runtimeSettings: codexSettings,
      });
    }
    default:
      throw new Error(`Unsupported Narre provider: ${providerName}`);
  }
}

function parseBehaviorSettings(): NarreBehaviorSettings {
  const raw = process.env.NARRE_BEHAVIOR_SETTINGS_JSON;
  if (!raw) {
    return normalizeNarreBehaviorSettings(undefined);
  }

  try {
    return normalizeNarreBehaviorSettings(JSON.parse(raw));
  } catch (error) {
    console.warn(`[narre] Failed to parse NARRE_BEHAVIOR_SETTINGS_JSON: ${(error as Error).message}`);
    return normalizeNarreBehaviorSettings(undefined);
  }
}

function parseCodexSettings(): NarreCodexSettings {
  const raw = process.env.NARRE_CODEX_SETTINGS_JSON;
  if (!raw) {
    return getDefaultCodexSettings();
  }

  try {
    return normalizeCodexSettings(JSON.parse(raw));
  } catch (error) {
    console.warn(`[narre] Failed to parse NARRE_CODEX_SETTINGS_JSON: ${(error as Error).message}`);
    return getDefaultCodexSettings();
  }
}

function normalizeCodexSettings(value: unknown): NarreCodexSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return getDefaultCodexSettings();
  }

  const source = value as Record<string, unknown>;
  return {
    model: typeof source.model === 'string' ? source.model.trim() : '',
    useWorldRootAsWorkingDirectory: source.useWorldRootAsWorkingDirectory !== false,
    sandboxMode: source.sandboxMode === 'workspace-write' || source.sandboxMode === 'danger-full-access'
      ? source.sandboxMode
      : 'read-only',
    approvalPolicy: source.approvalPolicy === 'untrusted' || source.approvalPolicy === 'never'
      ? source.approvalPolicy
      : 'on-request',
    enableShellTool: source.enableShellTool === true,
    enableMultiAgent: source.enableMultiAgent === true,
    enableWebSearch: source.enableWebSearch === true,
    enableViewImage: source.enableViewImage === true,
    enableApps: source.enableApps === true,
  };
}

function getDefaultCodexSettings(): NarreCodexSettings {
  return {
    model: '',
    useWorldRootAsWorkingDirectory: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'on-request',
    enableShellTool: false,
    enableMultiAgent: false,
    enableWebSearch: false,
    enableViewImage: false,
    enableApps: false,
  };
}

async function main(): Promise<void> {
  ({ provider, runtime } = await initializeRuntime());
  dispatcher = new AgentRuntimeDispatcher({
    supervisor,
    orchestration,
    executors,
    createRuntime: createRuntimeForProfile,
  });
  agentOperator = new AgentOperator({
    supervisor,
    orchestration,
    dispatcher,
    createRuntime: createRuntimeForProfile,
  });

  app.listen(PORT, () => {
    console.log(`Narre server listening on port ${PORT}`);
    console.log(`Provider: ${provider.name}`);
    console.log(`Data directory: ${MOC_DATA_DIR}`);
  });
}

void main().catch((error) => {
  console.error('[narre] Startup failed:', error);
  process.exit(1);
});

export type { };
