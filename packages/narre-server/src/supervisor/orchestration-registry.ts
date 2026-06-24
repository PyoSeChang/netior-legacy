import { randomUUID } from 'crypto';
import { dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type {
  AgentAssignment,
  AgentApprovalRequest,
  AgentApprovalStatus,
  AgentEvent,
  AgentEventType,
  AgentRuntimeOverride,
  AgentRuntimeProfile,
  Conversation,
  ConversationMode,
  CreateAgentAssignmentInput,
  CreateConversationInput,
  CreateOrchestrationRunInput,
  CreateOrchestrationTaskInput,
  OrchestrationRun,
  OrchestrationRunStatus,
  OrchestrationTask,
  OrchestrationTaskStatus,
  NarreCard,
} from '@netior/shared/types';

const MAX_EVENTS = 2_000;

export interface OrchestrationSnapshot {
  run: OrchestrationRun;
  conversation: Conversation | null;
  tasks: OrchestrationTask[];
  assignments: AgentAssignment[];
  approvals: AgentApprovalRequest[];
  events: AgentEvent[];
}

export interface OrchestrationRegistryOptions {
  storagePath?: string;
}

interface OrchestrationRegistryState {
  conversations?: Conversation[];
  runs?: OrchestrationRun[];
  tasks?: OrchestrationTask[];
  assignments?: AgentAssignment[];
  approvals?: AgentApprovalRequest[];
  events?: AgentEvent[];
  nextEventSeq?: number;
}

export class OrchestrationRegistry {
  private readonly conversations = new Map<string, Conversation>();
  private readonly runs = new Map<string, OrchestrationRun>();
  private readonly tasks = new Map<string, OrchestrationTask>();
  private readonly assignments = new Map<string, AgentAssignment>();
  private readonly approvals = new Map<string, AgentApprovalRequest>();
  private readonly events: AgentEvent[] = [];
  private nextEventSeq = 1;

  constructor(private readonly options: OrchestrationRegistryOptions = {}) {
    this.load();
  }

  createConversation(input: CreateConversationInput): Conversation {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: `conv-${randomUUID()}`,
      rootNetworkId: input.rootNetworkId,
      mode: input.mode ?? 'direct',
      title: input.title?.trim() || 'New conversation',
      participantAgentKeys: [...new Set(input.participantAgentKeys ?? [])],
      activeRunId: null,
      createdAt: now,
      updatedAt: now,
      metadata: cloneStringRecord(input.metadata),
    };

    this.conversations.set(conversation.id, conversation);
    this.persist();
    return cloneConversation(conversation);
  }

  listConversations(rootNetworkId?: string | null): Conversation[] {
    return Array.from(this.conversations.values())
      .filter((conversation) => !rootNetworkId || conversation.rootNetworkId === rootNetworkId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map(cloneConversation);
  }

  getConversation(conversationId: string): Conversation | null {
    const conversation = this.conversations.get(conversationId);
    return conversation ? cloneConversation(conversation) : null;
  }

  createRun(input: CreateOrchestrationRunInput): OrchestrationSnapshot {
    const now = new Date().toISOString();
    const conversation = input.conversationId
      ? this.requireConversation(input.conversationId)
      : this.createConversation({
        rootNetworkId: input.rootNetworkId,
        mode: input.mode ?? 'orchestration',
        title: input.userRequest.slice(0, 80) || 'Orchestration run',
        participantAgentKeys: input.participantAgentKeys ?? [],
      });
    const conversationId = conversation?.id ?? input.conversationId ?? null;
    const run: OrchestrationRun = {
      id: `run-${randomUUID()}`,
      conversationId,
      rootNetworkId: input.rootNetworkId,
      mode: input.mode ?? conversation?.mode ?? 'orchestration',
      userRequest: input.userRequest,
      status: 'planning',
      rootTaskId: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      result: null,
      metadata: cloneStringRecord(input.metadata),
    };

    this.runs.set(run.id, run);
    if (conversationId) {
      this.updateConversation(conversationId, {
        activeRunId: run.id,
        participantAgentKeys: [
          ...(conversation?.participantAgentKeys ?? []),
          ...(input.participantAgentKeys ?? []),
        ],
      });
    }
    this.pushEvent({
      runId: run.id,
      conversationId,
      type: 'user_message',
      message: input.userRequest,
      payload: { status: run.status },
    });

    return this.getRunSnapshot(run.id) as OrchestrationSnapshot;
  }

  listRuns(rootNetworkId?: string | null): OrchestrationRun[] {
    return Array.from(this.runs.values())
      .filter((run) => !rootNetworkId || run.rootNetworkId === rootNetworkId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map(cloneRun);
  }

  getRunSnapshot(runId: string): OrchestrationSnapshot | null {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    return {
      run: cloneRun(run),
      conversation: run.conversationId ? this.getConversation(run.conversationId) : null,
      tasks: this.listTasks(run.id),
      assignments: this.listAssignments(run.id),
      approvals: this.listApprovals(run.id),
      events: this.listEvents(run.id),
    };
  }

  createTask(input: CreateOrchestrationTaskInput): OrchestrationTask {
    const run = this.requireRun(input.runId);
    const now = new Date().toISOString();
    const task: OrchestrationTask = {
      id: `task-${randomUUID()}`,
      runId: input.runId,
      parentTaskId: input.parentTaskId ?? null,
      dependsOnTaskIds: [...new Set(input.dependsOnTaskIds ?? [])],
      title: input.title,
      input: input.input,
      status: input.assignedAgentKey ? 'assigned' : 'pending',
      assignedAgentKey: input.assignedAgentKey ?? null,
      assignedSessionId: null,
      runtimeOverride: cloneRuntimePartial(input.runtimeOverride),
      result: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      metadata: cloneStringRecord(input.metadata),
    };

    this.tasks.set(task.id, task);
    if (!run.rootTaskId) {
      this.updateRun(run.id, { rootTaskId: task.id });
    } else {
      this.touchRun(run.id);
    }
    this.pushEvent({
      runId: task.runId,
      conversationId: run.conversationId ?? null,
      taskId: task.id,
      agentKey: task.assignedAgentKey ?? null,
      type: 'task_created',
      message: task.title,
      payload: {
        status: task.status,
        dependsOnTaskIds: task.dependsOnTaskIds,
      },
    });

    return cloneTask(task);
  }

  listTasks(runId: string): OrchestrationTask[] {
    return Array.from(this.tasks.values())
      .filter((task) => task.runId === runId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map(cloneTask);
  }

  assignTask(input: CreateAgentAssignmentInput): AgentAssignment {
    const run = this.requireRun(input.runId);
    const task = this.requireTask(input.taskId);
    if (task.runId !== run.id) {
      throw new Error(`Task ${task.id} does not belong to run ${run.id}`);
    }

    const now = new Date().toISOString();
    const assignment: AgentAssignment = {
      id: `assign-${randomUUID()}`,
      runId: input.runId,
      taskId: input.taskId,
      agentKey: input.agentKey,
      sessionId: input.sessionId ?? null,
      status: 'pending',
      runtimeSnapshot: input.runtimeSnapshot ? cloneRuntime(input.runtimeSnapshot) : null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      result: null,
      metadata: cloneStringRecord(input.metadata),
    };

    this.assignments.set(assignment.id, assignment);
    this.updateTask(task.id, {
      status: 'assigned',
      assignedAgentKey: input.agentKey,
      assignedSessionId: input.sessionId ?? null,
    });
    this.pushEvent({
      runId: run.id,
      conversationId: run.conversationId ?? null,
      taskId: task.id,
      assignmentId: assignment.id,
      sessionId: assignment.sessionId ?? null,
      agentKey: assignment.agentKey,
      type: 'task_assigned',
      message: `${task.title} -> ${assignment.agentKey}`,
      payload: {
        status: assignment.status,
        runtimeSnapshot: assignment.runtimeSnapshot ?? null,
      },
    });

    return cloneAssignment(assignment);
  }

  listAssignments(runId: string): AgentAssignment[] {
    return Array.from(this.assignments.values())
      .filter((assignment) => assignment.runId === runId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map(cloneAssignment);
  }

  getTask(taskId: string): OrchestrationTask | null {
    const task = this.tasks.get(taskId);
    return task ? cloneTask(task) : null;
  }

  getAssignment(assignmentId: string): AgentAssignment | null {
    const assignment = this.assignments.get(assignmentId);
    return assignment ? cloneAssignment(assignment) : null;
  }

  updateAssignment(input: {
    assignmentId: string;
    status?: AgentAssignment['status'];
    sessionId?: string | null;
    result?: string | null;
    runtimeSnapshot?: AgentRuntimeProfile | null;
  }): AgentAssignment {
    const current = this.requireAssignment(input.assignmentId);
    const completedAt = input.status === 'completed' || input.status === 'failed' || input.status === 'cancelled'
      ? new Date().toISOString()
      : null;
    const next: AgentAssignment = {
      ...current,
      status: input.status ?? current.status,
      sessionId: input.sessionId ?? current.sessionId ?? null,
      result: input.result ?? current.result ?? null,
      runtimeSnapshot: input.runtimeSnapshot !== undefined
        ? input.runtimeSnapshot ? cloneRuntime(input.runtimeSnapshot) : null
        : current.runtimeSnapshot,
      completedAt,
      updatedAt: new Date().toISOString(),
    };

    this.assignments.set(next.id, next);
    this.updateTask(current.taskId, {
      assignedSessionId: next.sessionId ?? null,
      status: assignmentStatusToTaskStatus(next.status),
      ...(next.result ? { result: next.result } : {}),
      completedAt,
    });
    this.persist();
    return cloneAssignment(next);
  }

  createApprovalRequest(input: {
    runId: string;
    taskId?: string | null;
    assignmentId?: string | null;
    agentKey?: string | null;
    sessionId?: string | null;
    card?: NarreCard;
    prompt?: string | null;
    metadata?: Record<string, string>;
  }): AgentApprovalRequest {
    const run = this.requireRun(input.runId);
    const now = new Date().toISOString();
    const approval: AgentApprovalRequest = {
      id: `approval-${randomUUID()}`,
      runId: input.runId,
      taskId: input.taskId ?? null,
      assignmentId: input.assignmentId ?? null,
      agentKey: input.agentKey ?? null,
      sessionId: input.sessionId ?? null,
      status: 'pending',
      card: input.card ? { ...input.card } : undefined,
      prompt: input.prompt ?? null,
      response: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      resolvedAt: null,
      metadata: cloneStringRecord(input.metadata),
    };

    this.approvals.set(approval.id, approval);
    this.pushEvent({
      runId: approval.runId,
      conversationId: run.conversationId ?? null,
      taskId: approval.taskId ?? null,
      assignmentId: approval.assignmentId ?? null,
      sessionId: approval.sessionId ?? null,
      agentKey: approval.agentKey ?? null,
      type: 'approval_requested',
      message: approval.prompt ?? 'Approval requested',
      payload: {
        approvalId: approval.id,
        card: approval.card ?? null,
      },
    });
    this.persist();
    return cloneApproval(approval);
  }

  listApprovals(runId?: string | null): AgentApprovalRequest[] {
    return Array.from(this.approvals.values())
      .filter((approval) => !runId || approval.runId === runId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map(cloneApproval);
  }

  resolveApproval(input: {
    approvalId: string;
    status: Exclude<AgentApprovalStatus, 'pending'>;
    response?: string | null;
  }): AgentApprovalRequest {
    const current = this.approvals.get(input.approvalId);
    if (!current) {
      throw new Error(`Approval request not found: ${input.approvalId}`);
    }
    const run = this.requireRun(current.runId);
    const next: AgentApprovalRequest = {
      ...current,
      status: input.status,
      response: input.response ?? null,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
    };
    this.approvals.set(next.id, next);
    this.pushEvent({
      runId: next.runId,
      conversationId: run.conversationId ?? null,
      taskId: next.taskId ?? null,
      assignmentId: next.assignmentId ?? null,
      sessionId: next.sessionId ?? null,
      agentKey: next.agentKey ?? null,
      type: 'approval_resolved',
      message: input.response ?? input.status,
      payload: {
        approvalId: next.id,
        status: next.status,
      },
    });
    this.persist();
    return cloneApproval(next);
  }

  recordEvent(input: {
    runId: string;
    conversationId?: string | null;
    taskId?: string | null;
    assignmentId?: string | null;
    sessionId?: string | null;
    agentKey?: string | null;
    type: AgentEventType;
    message?: string | null;
    payload?: Record<string, unknown>;
  }): AgentEvent {
    this.requireRun(input.runId);
    return this.pushEvent(input);
  }

  listEvents(runId?: string | null, afterSeq?: number | null): AgentEvent[] {
    return this.events
      .filter((event) => !runId || event.runId === runId)
      .filter((event) => typeof afterSeq !== 'number' || event.seq > afterSeq)
      .map(cloneEvent);
  }

  updateRunStatus(runId: string, status: OrchestrationRunStatus, result?: string | null): OrchestrationRun {
    const completedAt = status === 'completed' || status === 'failed' || status === 'cancelled'
      ? new Date().toISOString()
      : null;
    const run = this.updateRun(runId, { status, completedAt, result });
    if (status === 'completed') {
      this.pushEvent({
        runId: run.id,
        conversationId: run.conversationId ?? null,
        type: 'run_completed',
        message: result ?? null,
        payload: { status },
      });
    } else if (status === 'cancelled') {
      this.pushEvent({
        runId: run.id,
        conversationId: run.conversationId ?? null,
        type: 'run_completed',
        message: result ?? 'Run cancelled',
        payload: { status },
      });
    }
    return run;
  }

  cancelRun(runId: string, result = 'Run cancelled by user'): OrchestrationSnapshot {
    this.requireRun(runId);
    for (const assignment of this.listAssignments(runId)) {
      if (!isTerminalStatus(assignment.status)) {
        this.updateAssignment({
          assignmentId: assignment.id,
          status: 'cancelled',
          result,
        });
      }
    }
    for (const task of this.listTasks(runId)) {
      if (!isTerminalStatus(task.status)) {
        this.updateTaskStatus(task.id, 'cancelled', result);
      }
    }
    this.updateRunStatus(runId, 'cancelled', result);
    return this.getRunSnapshot(runId) as OrchestrationSnapshot;
  }

  updateTaskStatus(
    taskId: string,
    status: OrchestrationTaskStatus,
    result?: string | null,
  ): OrchestrationTask {
    const completedAt = status === 'completed' || status === 'failed' || status === 'cancelled'
      ? new Date().toISOString()
      : null;
    const task = this.updateTask(taskId, { status, completedAt, result });
    const run = this.requireRun(task.runId);
    if (status === 'completed') {
      this.pushEvent({
        runId: task.runId,
        conversationId: run.conversationId ?? null,
        taskId: task.id,
        agentKey: task.assignedAgentKey ?? null,
        type: 'task_completed',
        message: result ?? task.title,
        payload: { status },
      });
    }
    return task;
  }

  private updateConversation(
    conversationId: string,
    patch: Partial<Pick<Conversation, 'activeRunId' | 'participantAgentKeys' | 'title'>>,
  ): Conversation {
    const current = this.conversations.get(conversationId);
    if (!current) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const next: Conversation = {
      ...current,
      ...patch,
      participantAgentKeys: patch.participantAgentKeys
        ? [...new Set(patch.participantAgentKeys)]
        : current.participantAgentKeys,
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(conversationId, next);
    this.persist();
    return cloneConversation(next);
  }

  private updateRun(
    runId: string,
    patch: Partial<Pick<OrchestrationRun, 'status' | 'rootTaskId' | 'completedAt' | 'result'>>,
  ): OrchestrationRun {
    const current = this.requireRun(runId);
    const next: OrchestrationRun = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.runs.set(runId, next);
    this.persist();
    return cloneRun(next);
  }

  private updateTask(
    taskId: string,
    patch: Partial<Pick<OrchestrationTask, 'status' | 'assignedAgentKey' | 'assignedSessionId' | 'completedAt' | 'result'>>,
  ): OrchestrationTask {
    const current = this.requireTask(taskId);
    const next: OrchestrationTask = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, next);
    this.touchRun(next.runId);
    this.persist();
    return cloneTask(next);
  }

  private touchRun(runId: string): void {
    const current = this.requireRun(runId);
    this.runs.set(runId, {
      ...current,
      updatedAt: new Date().toISOString(),
    });
    this.persist();
  }

  private requireRun(runId: string): OrchestrationRun {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    return run;
  }

  private requireConversation(conversationId: string): Conversation {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    return conversation;
  }

  private requireTask(taskId: string): OrchestrationTask {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }

  private requireAssignment(assignmentId: string): AgentAssignment {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }
    return assignment;
  }

  private pushEvent(input: {
    runId: string;
    conversationId?: string | null;
    taskId?: string | null;
    assignmentId?: string | null;
    sessionId?: string | null;
    agentKey?: string | null;
    type: AgentEventType;
    message?: string | null;
    payload?: Record<string, unknown>;
  }): AgentEvent {
    const event: AgentEvent = {
      id: `evt-${randomUUID()}`,
      seq: this.nextEventSeq,
      runId: input.runId,
      conversationId: input.conversationId ?? null,
      taskId: input.taskId ?? null,
      assignmentId: input.assignmentId ?? null,
      sessionId: input.sessionId ?? null,
      agentKey: input.agentKey ?? null,
      type: input.type,
      message: input.message ?? null,
      payload: clonePayload(input.payload),
      createdAt: new Date().toISOString(),
    };

    this.nextEventSeq += 1;
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
    this.persist();
    return cloneEvent(event);
  }

  private load(): void {
    const storagePath = this.options.storagePath;
    if (!storagePath || !existsSync(storagePath)) {
      return;
    }

    try {
      const state = JSON.parse(readFileSync(storagePath, 'utf8')) as OrchestrationRegistryState;
      for (const conversation of state.conversations ?? []) {
        this.conversations.set(conversation.id, conversation);
      }
      for (const run of state.runs ?? []) {
        this.runs.set(run.id, run);
      }
      for (const task of state.tasks ?? []) {
        this.tasks.set(task.id, task);
      }
      for (const assignment of state.assignments ?? []) {
        this.assignments.set(assignment.id, assignment);
      }
      for (const approval of state.approvals ?? []) {
        this.approvals.set(approval.id, approval);
      }
      this.events.splice(0, this.events.length, ...(state.events ?? []).slice(-MAX_EVENTS));
      this.nextEventSeq = state.nextEventSeq ?? ((this.events.at(-1)?.seq ?? 0) + 1);
    } catch (error) {
      console.warn(`[narre:orchestration] failed to load ${storagePath}: ${(error as Error).message}`);
    }
  }

  private persist(): void {
    const storagePath = this.options.storagePath;
    if (!storagePath) {
      return;
    }

    const state: OrchestrationRegistryState = {
      conversations: Array.from(this.conversations.values()).map(cloneConversation),
      runs: Array.from(this.runs.values()).map(cloneRun),
      tasks: Array.from(this.tasks.values()).map(cloneTask),
      assignments: Array.from(this.assignments.values()).map(cloneAssignment),
      approvals: Array.from(this.approvals.values()).map(cloneApproval),
      events: this.events.map(cloneEvent),
      nextEventSeq: this.nextEventSeq,
    };
    mkdirSync(dirname(storagePath), { recursive: true });
    writeFileSync(storagePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function cloneConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    participantAgentKeys: [...conversation.participantAgentKeys],
    metadata: cloneStringRecord(conversation.metadata),
  };
}

function cloneRun(run: OrchestrationRun): OrchestrationRun {
  return {
    ...run,
    metadata: cloneStringRecord(run.metadata),
  };
}

function cloneTask(task: OrchestrationTask): OrchestrationTask {
  return {
    ...task,
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    runtimeOverride: cloneRuntimePartial(task.runtimeOverride),
    metadata: cloneStringRecord(task.metadata),
  };
}

function cloneAssignment(assignment: AgentAssignment): AgentAssignment {
  return {
    ...assignment,
    runtimeSnapshot: assignment.runtimeSnapshot ? cloneRuntime(assignment.runtimeSnapshot) : null,
    metadata: cloneStringRecord(assignment.metadata),
  };
}

function cloneEvent(event: AgentEvent): AgentEvent {
  return {
    ...event,
    payload: clonePayload(event.payload),
  };
}

function cloneApproval(approval: AgentApprovalRequest): AgentApprovalRequest {
  return {
    ...approval,
    card: approval.card ? { ...approval.card } : undefined,
    metadata: cloneStringRecord(approval.metadata),
  };
}

function cloneRuntime(runtime: AgentRuntimeProfile): AgentRuntimeProfile {
  return {
    ...runtime,
    toolProfileIds: runtime.toolProfileIds ? [...runtime.toolProfileIds] : undefined,
    metadata: cloneStringRecord(runtime.metadata),
  };
}

function cloneRuntimePartial(runtime?: AgentRuntimeOverride): AgentRuntimeOverride | undefined {
  if (!runtime) {
    return undefined;
  }
  return {
    ...runtime,
    metadata: cloneStringRecord(runtime.metadata),
  };
}

function cloneStringRecord(value?: Record<string, string>): Record<string, string> | undefined {
  return value ? { ...value } : undefined;
}

function clonePayload(value?: Record<string, unknown>): Record<string, unknown> | undefined {
  return value ? { ...value } : undefined;
}

function assignmentStatusToTaskStatus(status: AgentAssignment['status']): OrchestrationTaskStatus {
  switch (status) {
    case 'running':
      return 'running';
    case 'blocked':
      return 'blocked';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'pending':
    default:
      return 'assigned';
  }
}

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
