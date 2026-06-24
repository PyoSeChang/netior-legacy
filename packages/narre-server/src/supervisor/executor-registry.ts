import { randomUUID } from 'crypto';
import { dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type {
  AgentExecutorCommand,
  AgentExecutorCommandStatus,
  AgentExecutorCommandType,
  AgentExecutorRegistration,
  AgentExecutorStatus,
  AgentProvider,
  AgentRuntimeProvider,
  AgentSurfaceRef,
} from '@netior/shared/types';

export interface ExecutorRegistryOptions {
  storagePath?: string;
}

export interface RegisterExecutorInput {
  id?: string;
  rootNetworkId?: string | null;
  provider: AgentProvider | AgentRuntimeProvider;
  surface: AgentSurfaceRef;
  capabilities?: string[];
  metadata?: Record<string, string>;
}

interface ExecutorRegistryState {
  executors?: AgentExecutorRegistration[];
  commands?: AgentExecutorCommand[];
}

export class ExecutorRegistry {
  private readonly executors = new Map<string, AgentExecutorRegistration>();
  private readonly commands = new Map<string, AgentExecutorCommand>();

  constructor(private readonly options: ExecutorRegistryOptions = {}) {
    this.load();
  }

  register(input: RegisterExecutorInput): AgentExecutorRegistration {
    const now = new Date().toISOString();
    const id = input.id?.trim() || `executor-${randomUUID()}`;
    const executor: AgentExecutorRegistration = {
      id,
      rootNetworkId: input.rootNetworkId ?? null,
      provider: input.provider,
      surface: input.surface,
      status: 'online',
      capabilities: [...new Set(input.capabilities ?? [])],
      currentAssignmentId: this.executors.get(id)?.currentAssignmentId ?? null,
      registeredAt: this.executors.get(id)?.registeredAt ?? now,
      lastHeartbeatAt: now,
      metadata: input.metadata ? { ...input.metadata } : undefined,
    };
    this.executors.set(id, executor);
    this.persist();
    return cloneExecutor(executor);
  }

  heartbeat(executorId: string, input: {
    status?: AgentExecutorStatus;
    currentAssignmentId?: string | null;
    metadata?: Record<string, string>;
  } = {}): AgentExecutorRegistration {
    const current = this.requireExecutor(executorId);
    const next: AgentExecutorRegistration = {
      ...current,
      status: input.status ?? current.status,
      currentAssignmentId: input.currentAssignmentId ?? current.currentAssignmentId ?? null,
      lastHeartbeatAt: new Date().toISOString(),
      metadata: input.metadata ? { ...(current.metadata ?? {}), ...input.metadata } : current.metadata,
    };
    this.executors.set(executorId, next);
    this.persist();
    return cloneExecutor(next);
  }

  list(rootNetworkId?: string | null): AgentExecutorRegistration[] {
    return Array.from(this.executors.values())
      .filter((executor) => !rootNetworkId || executor.rootNetworkId === rootNetworkId)
      .sort((a, b) => Date.parse(b.lastHeartbeatAt) - Date.parse(a.lastHeartbeatAt))
      .map(cloneExecutor);
  }

  queueCommand(input: {
    executorId: string;
    type: AgentExecutorCommandType;
    payload: Record<string, unknown>;
    runId?: string | null;
    taskId?: string | null;
    assignmentId?: string | null;
    agentKey?: string | null;
  }): AgentExecutorCommand {
    this.requireExecutor(input.executorId);
    const now = new Date().toISOString();
    const command: AgentExecutorCommand = {
      id: `command-${randomUUID()}`,
      executorId: input.executorId,
      runId: input.runId ?? null,
      taskId: input.taskId ?? null,
      assignmentId: input.assignmentId ?? null,
      agentKey: input.agentKey ?? null,
      type: input.type,
      status: 'queued',
      payload: { ...input.payload },
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.commands.set(command.id, command);
    this.persist();
    return cloneCommand(command);
  }

  claimCommands(executorId: string): AgentExecutorCommand[] {
    this.heartbeat(executorId, { status: 'online' });
    return Array.from(this.commands.values())
      .filter((command) => command.executorId === executorId && command.status === 'queued')
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((command) => this.updateCommand(command.id, { status: 'running' }));
  }

  completeCommand(commandId: string, input: {
    status: Extract<AgentExecutorCommandStatus, 'completed' | 'failed' | 'cancelled'>;
    result?: Record<string, unknown> | null;
    error?: string | null;
  }): AgentExecutorCommand {
    return this.updateCommand(commandId, {
      status: input.status,
      result: input.result ?? null,
      error: input.error ?? null,
      completedAt: new Date().toISOString(),
    });
  }

  findAvailableExecutor(rootNetworkId: string, provider: AgentProvider | AgentRuntimeProvider): AgentExecutorRegistration | null {
    const candidates = this.list(rootNetworkId)
      .filter((executor) =>
        executor.status === 'online'
        && (executor.provider === provider || executor.capabilities.includes(provider)),
      );
    return candidates[0] ?? null;
  }

  private updateCommand(commandId: string, patch: Partial<AgentExecutorCommand>): AgentExecutorCommand {
    const current = this.commands.get(commandId);
    if (!current) {
      throw new Error(`Executor command not found: ${commandId}`);
    }
    const next: AgentExecutorCommand = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.commands.set(commandId, next);
    this.persist();
    return cloneCommand(next);
  }

  private requireExecutor(executorId: string): AgentExecutorRegistration {
    const executor = this.executors.get(executorId);
    if (!executor) {
      throw new Error(`Executor not found: ${executorId}`);
    }
    return executor;
  }

  private load(): void {
    const storagePath = this.options.storagePath;
    if (!storagePath || !existsSync(storagePath)) {
      return;
    }

    try {
      const state = JSON.parse(readFileSync(storagePath, 'utf8')) as ExecutorRegistryState;
      for (const executor of state.executors ?? []) {
        this.executors.set(executor.id, executor);
      }
      for (const command of state.commands ?? []) {
        this.commands.set(command.id, command);
      }
    } catch (error) {
      console.warn(`[narre:executors] failed to load ${storagePath}: ${(error as Error).message}`);
    }
  }

  private persist(): void {
    const storagePath = this.options.storagePath;
    if (!storagePath) {
      return;
    }

    const state: ExecutorRegistryState = {
      executors: Array.from(this.executors.values()).map(cloneExecutor),
      commands: Array.from(this.commands.values()).map(cloneCommand),
    };
    mkdirSync(dirname(storagePath), { recursive: true });
    writeFileSync(storagePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function cloneExecutor(executor: AgentExecutorRegistration): AgentExecutorRegistration {
  return {
    ...executor,
    capabilities: [...executor.capabilities],
    surface: { ...executor.surface },
    metadata: executor.metadata ? { ...executor.metadata } : undefined,
  };
}

function cloneCommand(command: AgentExecutorCommand): AgentExecutorCommand {
  return {
    ...command,
    payload: { ...command.payload },
    result: command.result ? { ...command.result } : null,
  };
}
