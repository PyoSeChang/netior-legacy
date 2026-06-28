import { spawn, type ChildProcess } from 'child_process';
import { createServer } from 'net';
import { getNarreToolMetadata, normalizeNetiorToolName } from '@netior/shared/constants';
import type { AgentReasoningEffort, AgentRuntimeProfile, NarreCodexSettings, NarreToolCall } from '@netior/shared/types';
import { ApprovalStore } from '../../approval-store.js';
import { buildNarreOperationPreview } from '../../operation-preview.js';
import type { NarreMcpServerConfig } from '../../runtime/provider-adapter.js';
import { CodexThreadStore } from '../codex-thread-store.js';
import { askToolModel, confirmToolModel, draftToolModel } from '../shared/ui-schemas.js';
import type { OpenAIFamilyTransport, OpenAIFamilyTransportRunContext } from './transport.js';

interface JsonRpcResponse {
  id: number | string;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

interface JsonRpcNotification {
  method?: string;
  params?: unknown;
}

interface JsonRpcServerRequest {
  id: number | string;
  method: string;
  params?: unknown;
}

interface DynamicToolCallRequest {
  callId?: unknown;
  turnId?: unknown;
  tool?: unknown;
  arguments?: unknown;
}

interface McpElicitationRequest {
  threadId?: unknown;
  turnId?: unknown;
  serverName?: unknown;
  mode?: unknown;
  message?: unknown;
  requestedModel?: unknown;
  url?: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutHandle: NodeJS.Timeout;
}

interface ActiveTurn {
  turnId: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface McpServerStartupState {
  status: 'starting' | 'ready' | 'failed' | 'cancelled';
  error: string | null;
}

interface RecentToolCall {
  callId: string;
  tool: string;
  input: Record<string, unknown>;
  startedAt: number;
}

interface McpServerStatusListResponse {
  data?: Array<{
    name?: string;
    tools?: Record<string, unknown>;
    resources?: unknown[];
    resourceTemplates?: unknown[];
  }>;
}

export interface CodexTransportOptions {
  dataDir: string;
  model?: string;
  runtimeSettings?: NarreCodexSettings;
}

interface EffectiveCodexRuntimeSettings extends NarreCodexSettings {
  reasoningEffort?: AgentReasoningEffort;
}

export const DEFAULT_CODEX_RUNTIME_SETTINGS: NarreCodexSettings = {
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

export function normalizeCodexRuntimeSettings(value: unknown): NarreCodexSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_CODEX_RUNTIME_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  const model = typeof source.model === 'string' ? source.model.trim() : '';
  const sandboxMode = source.sandboxMode === 'workspace-write' || source.sandboxMode === 'danger-full-access'
    ? source.sandboxMode
    : 'read-only';
  const approvalPolicy = source.approvalPolicy === 'untrusted' || source.approvalPolicy === 'never'
    ? source.approvalPolicy
    : 'on-request';

  return {
    model,
    useWorldRootAsWorkingDirectory: source.useWorldRootAsWorkingDirectory !== false,
    sandboxMode,
    approvalPolicy,
    enableShellTool: source.enableShellTool === true,
    enableMultiAgent: source.enableMultiAgent === true,
    enableWebSearch: source.enableWebSearch === true,
    enableViewImage: source.enableViewImage === true,
    enableApps: source.enableApps === true,
  };
}

function resolveCodexRuntimeSettings(
  value: unknown,
  runtimeProfile?: AgentRuntimeProfile,
): EffectiveCodexRuntimeSettings {
  const settings: EffectiveCodexRuntimeSettings = normalizeCodexRuntimeSettings(value);
  const model = runtimeProfile?.model?.trim();
  if (model) {
    settings.model = model;
  }
  if (runtimeProfile?.reasoningEffort) {
    settings.reasoningEffort = runtimeProfile.reasoningEffort;
  }
  if (runtimeProfile?.metadata?.codexSandboxMode === 'read-only'
    || runtimeProfile?.metadata?.codexSandboxMode === 'workspace-write'
    || runtimeProfile?.metadata?.codexSandboxMode === 'danger-full-access') {
    settings.sandboxMode = runtimeProfile.metadata.codexSandboxMode;
  }
  if (runtimeProfile?.metadata?.codexApprovalPolicy === 'untrusted'
    || runtimeProfile?.metadata?.codexApprovalPolicy === 'on-request'
    || runtimeProfile?.metadata?.codexApprovalPolicy === 'never') {
    settings.approvalPolicy = runtimeProfile.metadata.codexApprovalPolicy;
  }
  return settings;
}

function isNetiorMcpServerName(serverName: string): boolean {
  return serverName === 'netior' || serverName.startsWith('netior-');
}

function idPart(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export class CodexTransport implements OpenAIFamilyTransport {
  readonly name = 'codex';
  private readonly activeClients = new Map<string, CodexAppServerClient>();

  constructor(private readonly options: CodexTransportOptions) {}

  async steer(sessionId: string, message: string): Promise<boolean> {
    const client = this.activeClients.get(sessionId);
    if (!client) {
      return false;
    }

    await client.steerTurn(message);
    return true;
  }

  async run(context: OpenAIFamilyTransportRunContext) {
    const traceId = context.traceId ?? 'no-trace';
    const threadStore = new CodexThreadStore(this.options.dataDir, context.rootNetworkId, context.sessionId);
    const runtimeSettings = resolveCodexRuntimeSettings(this.options.runtimeSettings, context.runtimeProfile);
    const client = new CodexAppServerClient(context, runtimeSettings, new ApprovalStore(this.options.dataDir));
    const trackedToolCalls = new Map<string, NarreToolCall>();
    let assistantText = '';
    const abortHandler = (): void => {
      void client.close();
    };
    context.signal?.addEventListener('abort', abortHandler, { once: true });

    try {
      await client.start();

      const existingThreadId = await threadStore.getThreadId();
      const threadConfig = this.buildThreadConfig(context, runtimeSettings);
      const threadId = existingThreadId
        ? await client.resumeThread(existingThreadId, threadConfig)
        : await client.startThread(threadConfig);

      if (threadId !== existingThreadId) {
        await threadStore.setThreadId(threadId);
      }

      await client.waitForMcpServers();

      console.log(
        `[narre:${this.name}] trace=${traceId} Starting run session=${context.sessionId} world=${context.rootNetworkId} ` +
        `thread=${threadId} resume=${context.isResume ? 'yes' : 'no'} model=${this.resolveModel(runtimeSettings) ?? 'default'} ` +
        `reasoning=${runtimeSettings.reasoningEffort ?? 'default'}`,
      );

      client.onTextDelta = async (delta) => {
        assistantText += delta;
        await context.onText(delta);
      };
      client.onToolStart = async (callId, tool, input) => {
        const metadata = getNarreToolMetadata(tool);
        trackedToolCalls.set(callId, {
          tool,
          input,
          status: 'running',
          metadata,
        });
        await context.onToolStart(tool, input, metadata);
      };
      client.onToolEnd = async (callId, tool, result, error) => {
        const tracked = trackedToolCalls.get(callId) ?? {
          tool,
          input: {},
          status: 'running' as const,
          metadata: getNarreToolMetadata(tool),
        };
        if (error) {
          tracked.status = 'error';
          tracked.error = error;
        } else {
          tracked.status = 'success';
          tracked.result = result;
        }
        trackedToolCalls.set(callId, tracked);
        await context.onToolEnd(tool, error ?? result, tracked.metadata ?? getNarreToolMetadata(tool));
      };

      this.activeClients.set(context.sessionId, client);
      await client.startTurn(threadId, context.userPrompt);

      console.log(
        `[narre:${this.name}] trace=${traceId} Run completed session=${context.sessionId} thread=${threadId} ` +
        `chars=${assistantText.length} tools=${trackedToolCalls.size}`,
      );

      return {
        assistantText,
        toolCalls: Array.from(trackedToolCalls.values()),
      };
    } finally {
      if (this.activeClients.get(context.sessionId) === client) {
        this.activeClients.delete(context.sessionId);
      }
      context.signal?.removeEventListener('abort', abortHandler);
      await client.close();
    }
  }

  private buildThreadConfig(
    context: OpenAIFamilyTransportRunContext,
    runtimeSettings: EffectiveCodexRuntimeSettings,
  ): Record<string, unknown> {
    const workingDirectory = this.resolveWorkingDirectory(context, runtimeSettings);
    const threadConfig: Record<string, unknown> = {
      ...(workingDirectory ? { cwd: workingDirectory } : {}),
      config: {
        mcp_servers: buildMcpServerConfig(context.mcpServerConfigs),
      },
      dynamicTools: buildDynamicToolSpecs(),
      developerInstructions: context.systemPrompt,
      serviceName: 'netior-narre',
      experimentalRawEvents: false,
    };

    const model = this.resolveModel(runtimeSettings);
    if (model) {
      threadConfig.model = model;
    }

    return threadConfig;
  }

  private resolveModel(runtimeSettings: EffectiveCodexRuntimeSettings): string | undefined {
    const runtimeModel = runtimeSettings.model?.trim();
    if (runtimeModel) {
      return runtimeModel;
    }
    return this.options.model;
  }

  private resolveWorkingDirectory(
    context: OpenAIFamilyTransportRunContext,
    runtimeSettings: EffectiveCodexRuntimeSettings,
  ): string | undefined {
    if (runtimeSettings.useWorldRootAsWorkingDirectory === false) {
      return undefined;
    }

    const worldRootDir = context.worldRootDir?.trim();
    return worldRootDir && worldRootDir.length > 0 ? worldRootDir : undefined;
  }
}

class CodexAppServerClient {
  onTextDelta: ((delta: string) => void) | null = null;
  onToolStart: ((callId: string, tool: string, input: Record<string, unknown>) => void) | null = null;
  onToolEnd: ((callId: string, tool: string, result: string, error?: string) => void) | null = null;

  private child: ChildProcess | null = null;
  private socket: WebSocket | null = null;
  private readonly pendingRequests = new Map<number | string, PendingRequest>();
  private nextRequestId = 1;
  private activeTurn: ActiveTurn | null = null;
  private activeThreadId: string | null = null;
  private startupError: Error | null = null;
  private readonly mcpServerStartupStates = new Map<string, McpServerStartupState>();
  private readonly recentToolCalls = new Map<string, RecentToolCall>();

  constructor(
    private readonly context: OpenAIFamilyTransportRunContext,
    private readonly runtimeSettings: EffectiveCodexRuntimeSettings,
    private readonly approvalStore: ApprovalStore,
  ) {}

  private getTracePrefix(): string {
    return `trace=${this.context.traceId ?? 'no-trace'}`;
  }

  async start(): Promise<void> {
    const port = await allocateLoopbackPort();
    const url = `ws://127.0.0.1:${port}`;
    const launch = buildCodexLaunchCommand(
      ['app-server', '--listen', url],
      this.resolveWorkingDirectory(),
      this.runtimeSettings,
    );

    this.child = spawn(launch.command, launch.args, {
      cwd: this.resolveWorkingDirectory() ?? process.cwd(),
      env: {
        ...process.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.child.stdout?.on('data', (chunk: Buffer) => {
      const message = chunk.toString().trim();
      if (message) {
        console.log(`[narre:codex:stdout] ${this.getTracePrefix()} ${message}`);
      }
    });

    this.child.stderr?.on('data', (chunk: Buffer) => {
      const message = chunk.toString().trim();
      if (message) {
        console.error(`[narre:codex:stderr] ${this.getTracePrefix()} ${message}`);
      }
    });

    this.child.on('error', (error) => {
      this.startupError = error;
    });

    this.child.on('exit', (code, signal) => {
      const error = new Error(`Codex app-server exited unexpectedly (code=${code}, signal=${signal})`);
      this.startupError = error;
      if (this.activeTurn) {
        this.activeTurn.reject(error);
        this.activeTurn = null;
      }
    });

    this.socket = await connectWebSocket(url, () => this.startupError);
    this.socket.addEventListener('message', (event) => {
      this.handleSocketMessage(event.data);
    });
    this.socket.addEventListener('close', () => {
      if (this.activeTurn) {
        this.activeTurn.reject(new Error('Codex app-server connection closed during turn'));
        this.activeTurn = null;
      }
    });

    await this.request('initialize', {
      clientInfo: {
        name: 'netior-narre',
        title: 'Netior Narre',
        version: '0.1.0',
      },
      capabilities: {
        experimentalApi: true,
      },
    }, 5_000);

    this.sendNotification('initialized', undefined);
  }

  private resolveWorkingDirectory(): string | undefined {
    const worldRootDir = this.context.worldRootDir?.trim();
    return worldRootDir && worldRootDir.length > 0 ? worldRootDir : undefined;
  }

  async close(): Promise<void> {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error('Codex app-server closed before request completed'));
    }
    this.pendingRequests.clear();

    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore websocket close failures during cleanup.
      }
      this.socket = null;
    }

    if (this.child && this.child.exitCode == null && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
  }

  async waitForMcpServers(timeoutMs = 20_000): Promise<void> {
    const targetServerNames = this.context.mcpServerConfigs.map((config) => config.name);
    if (targetServerNames.length === 0) {
      return;
    }

    const deadline = Date.now() + timeoutMs;
    let lastSummary = '(no MCP status returned)';

    while (Date.now() < deadline) {
      let allStartupReady = true;

      for (const serverName of targetServerNames) {
        const startupState = this.mcpServerStartupStates.get(serverName);
        if (startupState && (startupState.status === 'failed' || startupState.status === 'cancelled')) {
          const detail = startupState.error ? `: ${startupState.error}` : '';
          throw new Error(`Codex MCP server "${serverName}" failed to start${detail}`);
        }
        if (!startupState || startupState.status !== 'ready') {
          allStartupReady = false;
        }
      }

      try {
        const statusList = await this.listMcpServerStatuses();
        const summaries: string[] = [];

        for (const entry of statusList.data ?? []) {
          const serverName = typeof entry.name === 'string' ? entry.name : 'unknown';
          const toolCount = Object.keys(entry.tools ?? {}).length;
          const resourceCount = Array.isArray(entry.resources) ? entry.resources.length : 0;
          const templateCount = Array.isArray(entry.resourceTemplates) ? entry.resourceTemplates.length : 0;
          summaries.push(`${serverName}(tools=${toolCount}, resources=${resourceCount}, templates=${templateCount})`);
        }

        if (summaries.length > 0) {
          lastSummary = summaries.join(', ');
        }
      } catch (error) {
        lastSummary = `status query failed: ${(error as Error).message}`;
      }

      if (allStartupReady) {
        console.log(`[narre:codex] ${this.getTracePrefix()} MCP ready ${lastSummary}`);
        return;
      }

      await sleep(250);
    }

    throw new Error(`Timed out waiting for Codex MCP servers: ${lastSummary}`);
  }

  async startThread(config: Record<string, unknown>): Promise<string> {
    const response = await this.request('thread/start', config, 10_000) as {
      thread?: { id?: string };
    };
    const threadId = response.thread?.id;
    if (!threadId) {
      throw new Error('Codex app-server did not return a thread id');
    }
    return threadId;
  }

  async resumeThread(threadId: string, config: Record<string, unknown>): Promise<string> {
    const response = await this.request('thread/resume', {
      threadId,
      ...config,
    }, 10_000) as {
      thread?: { id?: string };
    };
    const resumedThreadId = response.thread?.id;
    if (!resumedThreadId) {
      throw new Error('Codex app-server did not return a resumed thread id');
    }
    return resumedThreadId;
  }

  async startTurn(threadId: string, prompt: string): Promise<void> {
    const response = await this.request('turn/start', {
      threadId,
      input: [
        {
          type: 'text',
          text: prompt,
          text_elements: [],
        },
      ],
    }, 10_000) as {
      turn?: { id?: string };
    };

    const turnId = response.turn?.id;
    if (!turnId) {
      throw new Error('Codex app-server did not return a turn id');
    }

    this.activeThreadId = threadId;
    try {
      await new Promise<void>((resolve, reject) => {
        this.activeTurn = { turnId, resolve, reject };
      });
    } finally {
      this.activeThreadId = null;
    }
  }

  async steerTurn(prompt: string): Promise<void> {
    const activeTurn = this.activeTurn;
    if (!activeTurn || !this.activeThreadId) {
      throw new Error('No active Codex turn to steer');
    }

    await this.request('turn/steer', {
      threadId: this.activeThreadId,
      expectedTurnId: activeTurn.turnId,
      input: [
        {
          type: 'text',
          text: prompt,
        },
      ],
    }, 10_000);
  }

  private async listMcpServerStatuses(): Promise<McpServerStatusListResponse> {
    return await this.request('mcpServerStatus/list', {}, 5_000) as McpServerStatusListResponse;
  }

  private sendNotification(method: string, params: unknown): void {
    this.sendMessage({ method, params });
  }

  private async request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    const requestId = this.nextRequestId++;

    const result = new Promise<unknown>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutHandle });
    });

    this.sendMessage({
      id: requestId,
      method,
      params,
    });

    return result;
  }

  private sendMessage(payload: unknown): void {
    if (!this.socket) {
      throw new Error('Codex app-server socket is not connected');
    }

    this.socket.send(JSON.stringify(payload));
  }

  private handleSocketMessage(rawData: unknown): void {
    if (typeof rawData !== 'string') {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch (error) {
      console.warn(`[narre:codex] ${this.getTracePrefix()} Invalid JSON-RPC payload: ${(error as Error).message}`);
      return;
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        this.handleJsonRpcMessage(item);
      }
      return;
    }

    this.handleJsonRpcMessage(parsed);
  }

  private handleJsonRpcMessage(message: unknown): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    if ('id' in message && ('result' in message || 'error' in message)) {
      this.handleResponse(message as JsonRpcResponse);
      return;
    }

    if ('id' in message && 'method' in message) {
      void this.handleServerRequest(message as JsonRpcServerRequest);
      return;
    }

    if ('method' in message) {
      this.handleNotification(message as JsonRpcNotification);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(pending.timeoutHandle);

    if (response.error) {
      pending.reject(new Error(response.error.message ?? 'Codex app-server returned an error'));
      return;
    }

    pending.resolve(response.result);
  }

  private async handleServerRequest(request: JsonRpcServerRequest): Promise<void> {
    if (request.method === 'item/tool/call') {
      await this.handleDynamicToolCall(request);
      return;
    }

    if (request.method === 'mcpServer/elicitation/request') {
      await this.handleMcpServerElicitationRequest(request);
      return;
    }

    if (request.method === 'account/chatgptAuthTokens/refresh') {
      this.sendMessage({
        id: request.id,
        error: {
          code: -32000,
          message: 'Codex provider requires a local Codex login. Run `codex login` in a terminal first.',
        },
      });
      return;
    }

    this.sendMessage({
      id: request.id,
      error: {
        code: -32000,
        message: `Unsupported Codex app-server request: ${request.method}`,
      },
    });
  }

  private async handleDynamicToolCall(request: JsonRpcServerRequest): Promise<void> {
    const payload = (request.params ?? {}) as DynamicToolCallRequest;
    const tool = typeof payload.tool === 'string' ? payload.tool : '';
    const toolCallId = typeof payload.callId === 'string' ? payload.callId : undefined;

    try {
      const responseText = await this.runDynamicTool(tool, payload.arguments, toolCallId);
      this.sendMessage({
        id: request.id,
        result: {
          success: true,
          contentItems: [
            {
              type: 'inputText',
              text: responseText,
            },
          ],
        },
      });
    } catch (error) {
      this.sendMessage({
        id: request.id,
        result: {
          success: false,
          contentItems: [
            {
              type: 'inputText',
              text: `Dynamic tool failed: ${(error as Error).message}`,
            },
          ],
        },
      });
    }
  }

  private async handleMcpServerElicitationRequest(request: JsonRpcServerRequest): Promise<void> {
    const payload = (request.params ?? {}) as McpElicitationRequest;
    const serverName = typeof payload.serverName === 'string' ? payload.serverName : 'unknown';
    const mode = payload.mode === 'url' ? 'url' : 'form';
    const message = typeof payload.message === 'string' ? payload.message : 'MCP server requires user input.';
    const requestedModel = payload.requestedModel;
    const toolCallId = [
      'mcp-elicitation',
      idPart(this.context.traceId, 'no-trace'),
      idPart(this.context.sessionId, 'no-session'),
      idPart(payload.turnId ?? this.activeTurn?.turnId, 'no-turn'),
      idPart(request.id, 'no-request'),
    ].join(':');
    const requestedToolName = extractRequestedMcpToolName(message);
    const requestedToolPreview = requestedToolName
      ? await this.buildPreviewForRecentTool(requestedToolName)
      : null;

    console.log(
      `[narre:codex] ${this.getTracePrefix()} MCP elicitation server=${serverName} mode=${mode} ` +
      `payload=${JSON.stringify(payload)}`,
    );

    if (mode === 'url') {
      const url = typeof payload.url === 'string' ? payload.url : '';
      const responseText = await this.context.uiBridge.requestPermission(
        this.context.onCard,
        {
          message: `${message}${url ? `\n${url}` : ''}`,
          ...(requestedToolPreview ? { preview: requestedToolPreview } : {}),
          actions: [
            { key: 'cancel', label: 'Cancel' },
          ],
        },
        toolCallId,
      );
      const response = safeParseJson(responseText);
      const action = isActionResponse(response) && response.action === 'cancel'
        ? 'cancel'
        : 'decline';
      this.sendMessage({
        id: request.id,
        result: {
          action,
          content: null,
          _meta: null,
        },
      });
      return;
    }

    if (isNetiorMcpServerName(serverName) && requestedToolName) {
      const metadata = getNarreToolMetadata(requestedToolName);
      const alwaysAllowed = await this.approvalStore.isToolAllowed(this.context.rootNetworkId, requestedToolName);

      if (metadata.approvalMode === 'auto' || alwaysAllowed) {
        this.sendMessage({
          id: request.id,
          result: {
            action: 'accept',
            content: buildDefaultElicitationContent(requestedModel),
            _meta: null,
          },
        });
        return;
      }
    }

    const responseText = await this.context.uiBridge.requestPermission(
      this.context.onCard,
      {
        message,
        ...(requestedToolPreview ? { preview: requestedToolPreview } : {}),
        actions: [
          { key: 'accept', label: 'Approve' },
          ...(isNetiorMcpServerName(serverName) && requestedToolName
            ? [{ key: 'accept_world', label: 'Always allow in this world' as const }]
            : []),
          { key: 'decline', label: 'Decline', variant: 'danger' },
        ],
      },
      toolCallId,
    );

    const response = safeParseJson(responseText);
    const action = isActionResponse(response) ? response.action : null;
    const approved = action === 'accept' || action === 'accept_world';

    if (approved && action === 'accept_world' && isNetiorMcpServerName(serverName) && requestedToolName) {
      await this.approvalStore.allowTool(this.context.rootNetworkId, requestedToolName);
    }

    this.sendMessage({
      id: request.id,
      result: {
        action: approved ? 'accept' : 'decline',
        content: approved ? buildDefaultElicitationContent(requestedModel) : null,
        _meta: null,
      },
    });
  }

  private async runDynamicTool(tool: string, rawArguments: unknown, toolCallId?: string): Promise<string> {
    switch (tool) {
      case 'propose': {
        const parsed = draftToolModel.parse(rawArguments);
        return this.context.uiBridge.requestDraft(this.context.onCard, parsed, toolCallId);
      }
      case 'ask': {
        const parsed = askToolModel.parse(rawArguments);
        return this.context.uiBridge.requestInterview(this.context.onCard, parsed, toolCallId);
      }
      case 'confirm': {
        const parsed = confirmToolModel.parse(rawArguments);
        return this.context.uiBridge.requestPermission(this.context.onCard, parsed, toolCallId);
      }
      default:
        throw new Error(`Unsupported dynamic tool: ${tool || 'unknown'}`);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    switch (notification.method) {
      case 'item/agentMessage/delta': {
        const delta = (notification.params as { delta?: unknown })?.delta;
        if (typeof delta === 'string' && delta.length > 0) {
          this.onTextDelta?.(delta);
        }
        break;
      }
      case 'item/started':
        this.handleItemStarted(notification.params);
        break;
      case 'item/completed':
        this.handleItemCompleted(notification.params);
        break;
      case 'turn/completed':
        this.handleTurnCompleted(notification.params);
        break;
      case 'mcpServer/startupStatus/updated':
        this.handleMcpServerStartupStatusUpdated(notification.params);
        break;
      case 'error': {
        const errorMessage = (notification.params as { message?: unknown })?.message;
        if (this.activeTurn) {
          this.activeTurn.reject(new Error(typeof errorMessage === 'string' ? errorMessage : 'Codex app-server reported an error'));
          this.activeTurn = null;
        }
        break;
      }
      default:
        break;
    }
  }

  private handleItemStarted(params: unknown): void {
    const item = (params as { item?: unknown })?.item;
    const mapped = mapStartedToolCall(item);
    if (!mapped) {
      return;
    }

    console.log(`[narre:codex] ${this.getTracePrefix()} Tool start ${mapped.tool}`);
    this.rememberToolCall(mapped.callId, mapped.tool, mapped.input);
    this.onToolStart?.(mapped.callId, mapped.tool, mapped.input);
  }

  private handleItemCompleted(params: unknown): void {
    const item = (params as { item?: unknown })?.item;
    const mapped = mapCompletedToolCall(item);
    if (!mapped) {
      return;
    }

    console.log(`[narre:codex] ${this.getTracePrefix()} Tool end ${mapped.tool}`);
    this.onToolEnd?.(mapped.callId, mapped.tool, mapped.result, mapped.error);
  }

  private handleTurnCompleted(params: unknown): void {
    const turn = (params as { turn?: unknown })?.turn as {
      id?: unknown;
      status?: unknown;
      error?: { message?: unknown } | null;
    } | undefined;

    if (!turn || !this.activeTurn || turn.id !== this.activeTurn.turnId) {
      return;
    }

    const activeTurn = this.activeTurn;
    this.activeTurn = null;

    if (turn.status === 'failed') {
      const message = typeof turn.error?.message === 'string'
        ? turn.error.message
        : 'Codex turn failed';
      activeTurn.reject(new Error(message));
      return;
    }

    activeTurn.resolve();
  }

  private handleMcpServerStartupStatusUpdated(params: unknown): void {
    const payload = (params ?? {}) as {
      name?: unknown;
      status?: unknown;
      error?: unknown;
    };
    const name = typeof payload.name === 'string' ? payload.name : '';
    const status = payload.status === 'ready' || payload.status === 'failed' || payload.status === 'cancelled'
      ? payload.status
      : 'starting';
    const error = typeof payload.error === 'string' ? payload.error : null;

    if (!name) {
      return;
    }

    this.mcpServerStartupStates.set(name, { status, error });
    console.log(`[narre:codex] ${this.getTracePrefix()} MCP startup ${name} status=${status}${error ? ` error=${error}` : ''}`);
  }

  private rememberToolCall(callId: string, tool: string, input: Record<string, unknown>): void {
    this.recentToolCalls.set(callId, {
      callId,
      tool,
      input,
      startedAt: Date.now(),
    });

    if (this.recentToolCalls.size <= 30) {
      return;
    }

    const oldest = [...this.recentToolCalls.values()]
      .sort((left, right) => left.startedAt - right.startedAt)[0];
    if (oldest) {
      this.recentToolCalls.delete(oldest.callId);
    }
  }

  private async buildPreviewForRecentTool(toolName: string) {
    const normalizedToolName = normalizeNetiorToolName(toolName);
    const recent = [...this.recentToolCalls.values()]
      .filter((call) => normalizeNetiorToolName(call.tool) === normalizedToolName)
      .sort((left, right) => right.startedAt - left.startedAt)[0];

    return buildNarreOperationPreview(
      { rootNetworkId: this.context.rootNetworkId },
      normalizedToolName,
      recent?.input ?? {},
    );
  }
}

function buildMcpServerConfig(mcpServerConfigs: NarreMcpServerConfig[]): Record<string, unknown> {
  const entries = mcpServerConfigs.map((config) => [
    config.name,
    {
      command: config.command,
      args: config.args ?? [],
      ...(config.cwd ? { cwd: config.cwd } : {}),
      ...(config.env ? { env: config.env } : {}),
      enabled: true,
      required: config.required ?? false,
      startup_timeout_sec: 20,
    },
  ]);

  return Object.fromEntries(entries);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isActionResponse(value: unknown): value is { action?: string } {
  return Boolean(value && typeof value === 'object' && 'action' in value);
}

function extractRequestedMcpToolName(message: string): string | null {
  const match = message.match(/tool ["'`]([^"'`]+)["'`]/i);
  return match?.[1]?.trim() || null;
}

function buildDefaultElicitationContent(meaning: unknown): unknown {
  if (!meaning || typeof meaning !== 'object' || Array.isArray(meaning)) {
    return {};
  }

  const source = meaning as Record<string, unknown>;

  if ('default' in source) {
    return source.default;
  }

  if (typeof source.const === 'string' || typeof source.const === 'number' || typeof source.const === 'boolean') {
    return source.const;
  }

  if (Array.isArray(source.oneOf) && source.oneOf.length > 0) {
    return buildDefaultElicitationContent(source.oneOf[0]);
  }

  if (Array.isArray(source.anyOf) && source.anyOf.length > 0) {
    return buildDefaultElicitationContent(source.anyOf[0]);
  }

  const modelType = source.type;
  if (modelType === 'object' || (!modelType && source.properties && typeof source.properties === 'object')) {
    const properties = source.properties && typeof source.properties === 'object'
      ? source.properties as Record<string, unknown>
      : {};
    const required = Array.isArray(source.required)
      ? source.required.filter((item): item is string => typeof item === 'string')
      : Object.keys(properties);
    const content: Record<string, unknown> = {};
    for (const key of required) {
      content[key] = buildDefaultElicitationContent(properties[key]);
    }
    return content;
  }

  if (modelType === 'array') {
    return [];
  }

  if (modelType === 'boolean') {
    return true;
  }

  if (modelType === 'integer' || modelType === 'number') {
    return typeof source.minimum === 'number' ? source.minimum : 0;
  }

  if (Array.isArray(source.enum) && source.enum.length > 0) {
    return source.enum[0];
  }

  return '';
}

function buildDynamicToolSpecs(): Array<Record<string, unknown>> {
  return [
    {
      name: 'propose',
      description: 'Present an editable draft block to the user. Use this when suggesting meanings, meanings, instances, or any structured plan that benefits from inline revision.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['content'],
        properties: {
          title: { type: 'string', description: 'Optional title for the draft block' },
          content: { type: 'string', description: 'Editable markdown or plain-text draft' },
          format: {
            type: 'string',
            enum: ['markdown'],
            description: 'Draft format. Defaults to markdown.',
          },
          placeholder: { type: 'string', description: 'Optional placeholder when the draft content starts empty' },
          confirmLabel: { type: 'string', description: 'Optional label for the accept button' },
          feedbackLabel: { type: 'string', description: 'Optional label for the feedback button' },
          feedbackPlaceholder: { type: 'string', description: 'Optional placeholder for the feedback input' },
        },
      },
    },
    {
      name: 'ask',
      description: 'Ask the user a structured question with selectable options. Use for gathering preferences or domain information.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'options'],
        properties: {
          question: { type: 'string', description: 'The question to ask' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label'],
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          multiSelect: { type: 'boolean', description: 'Allow multiple selections' },
        },
      },
    },
    {
      name: 'confirm',
      description: 'Request user confirmation before a destructive or significant action.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['message', 'actions'],
        properties: {
          message: { type: 'string', description: 'Description of the action requiring confirmation' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['key', 'label'],
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
                variant: { type: 'string', enum: ['danger', 'default'] },
              },
            },
          },
        },
      },
    },
  ];
}

function mapStartedToolCall(item: unknown): { callId: string; tool: string; input: Record<string, unknown> } | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const payload = item as Record<string, unknown>;
  const id = typeof payload.id === 'string' ? payload.id : null;
  const type = typeof payload.type === 'string' ? payload.type : null;
  if (!id || !type) {
    return null;
  }

  if (type === 'mcpToolCall') {
    return {
      callId: id,
      tool: formatToolName(payload.server, payload.tool),
      input: toRecord(payload.arguments),
    };
  }

  if (type === 'commandExecution') {
    return {
      callId: id,
      tool: 'command',
      input: {
        command: payload.command,
        cwd: payload.cwd,
      },
    };
  }

  if (type === 'dynamicToolCall') {
    return {
      callId: id,
      tool: typeof payload.tool === 'string' ? payload.tool : 'dynamic_tool',
      input: toRecord(payload.arguments),
    };
  }

  return null;
}

function mapCompletedToolCall(item: unknown): {
  callId: string;
  tool: string;
  result: string;
  error?: string;
} | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const payload = item as Record<string, unknown>;
  const id = typeof payload.id === 'string' ? payload.id : null;
  const type = typeof payload.type === 'string' ? payload.type : null;
  if (!id || !type) {
    return null;
  }

  if (type === 'mcpToolCall') {
    const tool = formatToolName(payload.server, payload.tool);
    const errorMessage = extractCodexError(payload.error);
    return {
      callId: id,
      tool,
      result: stringifyValue(payload.result) || (errorMessage ? 'failed' : 'completed'),
      ...(errorMessage ? { error: errorMessage } : {}),
    };
  }

  if (type === 'commandExecution') {
    const aggregatedOutput = typeof payload.aggregatedOutput === 'string' ? payload.aggregatedOutput : '';
    const exitCode = payload.exitCode;
    const result = aggregatedOutput || `exitCode=${typeof exitCode === 'number' ? exitCode : 'unknown'}`;
    return {
      callId: id,
      tool: 'command',
      result,
      ...(typeof exitCode === 'number' && exitCode !== 0 ? { error: `Command failed with exit code ${exitCode}` } : {}),
    };
  }

  if (type === 'dynamicToolCall') {
    const result = stringifyDynamicToolContentItems(payload.contentItems);
    const success = payload.success;
    return {
      callId: id,
      tool: typeof payload.tool === 'string' ? payload.tool : 'dynamic_tool',
      result: result || (success === false ? 'failed' : 'completed'),
      ...(success === false ? { error: result || 'Dynamic tool call failed' } : {}),
    };
  }

  return null;
}

function extractCodexError(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const message = (value as { message?: unknown }).message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

function formatToolName(server: unknown, tool: unknown): string {
  const serverName = typeof server === 'string' ? server : 'mcp';
  const toolName = typeof tool === 'string' ? tool : 'tool';
  return `${serverName}.${toolName}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return '';
  }

  return JSON.stringify(value);
}

function stringifyDynamicToolContentItems(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }

  const parts = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }

      const payload = item as { type?: unknown; text?: unknown; imageUrl?: unknown };
      if (payload.type === 'inputText' && typeof payload.text === 'string') {
        return payload.text;
      }
      if (payload.type === 'inputImage' && typeof payload.imageUrl === 'string') {
        return payload.imageUrl;
      }

      return '';
    })
    .filter((part) => part.length > 0);

  return parts.join('\n');
}

function allocateLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        server.close();
        reject(new Error('Failed to allocate a loopback port for Codex app-server'));
        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

function buildCodexLaunchCommand(
  args: string[],
  workingDirectory: string | undefined,
  runtimeSettings: EffectiveCodexRuntimeSettings,
): { command: string; args: string[] } {
  const prefixArgs = buildCodexInvocationArgs(workingDirectory, runtimeSettings);

  if (process.platform === 'win32') {
    return {
      command: process.env.COMSPEC || 'C:\\WINDOWS\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'codex', ...prefixArgs, ...args],
    };
  }

  return {
    command: 'codex',
    args: [...prefixArgs, ...args],
  };
}

function buildCodexInvocationArgs(
  workingDirectory: string | undefined,
  runtimeSettings: EffectiveCodexRuntimeSettings,
): string[] {
  const args: string[] = [];

  if (workingDirectory) {
    args.push('-C', workingDirectory);
  }

  args.push('-s', runtimeSettings.sandboxMode);
  args.push('-a', runtimeSettings.approvalPolicy);
  args.push('-c', `features.shell_tool=${runtimeSettings.enableShellTool}`);
  args.push('-c', `features.multi_agent=${runtimeSettings.enableMultiAgent}`);
  args.push('-c', `features.apps=${runtimeSettings.enableApps}`);
  args.push('-c', `tools.web_search=${runtimeSettings.enableWebSearch}`);
  args.push('-c', `tools.view_image=${runtimeSettings.enableViewImage}`);

  if (runtimeSettings.model && runtimeSettings.model.length > 0) {
    args.push('-m', runtimeSettings.model);
  }

  if (runtimeSettings.reasoningEffort) {
    args.push('-c', `model_reasoning_effort="${runtimeSettings.reasoningEffort}"`);
  }

  return args;
}

async function connectWebSocket(url: string, getStartupError: () => Error | null): Promise<WebSocket> {
  const deadline = Date.now() + 10_000;
  let lastError: Error | null = null;

  while (Date.now() < deadline) {
    const startupError = getStartupError();
    if (startupError) {
      throw startupError;
    }

    try {
      return await openWebSocket(url, 1_500);
    } catch (error) {
      lastError = error as Error;
      await delay(100);
    }
  }

  throw lastError ?? new Error(`Timed out waiting for Codex app-server at ${url}`);
}

function openWebSocket(url: string, timeoutMs: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        socket.close();
      } catch {
        // Ignore close failures during timeout handling.
      }
      reject(new Error(`Timed out connecting to Codex app-server at ${url}`));
    }, timeoutMs);

    socket.addEventListener('open', () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });

    socket.addEventListener('error', () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to connect to Codex app-server at ${url}`));
    }, { once: true });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
