import type {
  AgentDefinition,
  AgentRuntimeOverride,
  AgentRuntimeProfile,
  NarreToolMetadata,
} from '@netior/shared/types';
import { getSupervisorAgentKey } from './agent-registry.js';
import type { SupervisorRegistry } from './supervisor-registry.js';
import type { OrchestrationRegistry } from './orchestration-registry.js';
import type { ExecutorRegistry } from './executor-registry.js';
import type { NarreRuntime } from '../runtime/narre-runtime.js';

export interface AgentRuntimeDispatcherConfig {
  supervisor: SupervisorRegistry;
  orchestration: OrchestrationRegistry;
  executors?: ExecutorRegistry;
  createRuntime: (runtimeProfile: AgentRuntimeProfile) => Promise<NarreRuntime>;
}

export class AgentRuntimeDispatcher {
  constructor(private readonly config: AgentRuntimeDispatcherConfig) {}

  async runAssignment(assignmentId: string): Promise<{
    sessionId: string;
    assistantText: string;
  }> {
    const assignment = this.config.orchestration.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    const task = this.config.orchestration.getTask(assignment.taskId);
    if (!task) {
      throw new Error(`Task not found: ${assignment.taskId}`);
    }

    const snapshot = this.config.orchestration.getRunSnapshot(assignment.runId);
    if (!snapshot) {
      throw new Error(`Run not found: ${assignment.runId}`);
    }
    if (assignment.status === 'completed') {
      return {
        sessionId: assignment.sessionId?.replace(/^narre:/, '') ?? '',
        assistantText: assignment.result ?? '',
      };
    }

    const agent = this.resolveAgent(snapshot.run.projectId, assignment.agentKey);
    if (agent.kind !== 'narre') {
      return this.queueTerminalAssignment(agent, assignmentId);
    }

    const runtimeProfile = resolveRuntimeProfile(agent, assignment.runtimeSnapshot, task.runtimeOverride);
    const runtime = await this.config.createRuntime(runtimeProfile);
    this.config.orchestration.updateRunStatus(snapshot.run.id, 'running');
    this.config.orchestration.updateAssignment({
      assignmentId,
      status: 'running',
      runtimeSnapshot: runtimeProfile,
    });
    this.config.orchestration.recordEvent({
      runId: assignment.runId,
      conversationId: snapshot.run.conversationId ?? null,
      taskId: task.id,
      assignmentId,
      agentKey: assignment.agentKey,
      type: 'task_started',
      message: `${agent.name} started ${task.title}`,
      payload: {
        runtimeProfile,
      },
    });

    try {
      const result = await runtime.runChat(
        {
          projectId: snapshot.run.projectId,
          message: buildTaskPrompt(snapshot.run.userRequest, task.input, collectUpstreamResults(snapshot.tasks, task)),
          traceId: `assignment:${assignmentId}`,
          activeAgent: agent,
          runtimeProfile,
          skillIds: parseTaskSkillIds(task.metadata),
          currentRunId: snapshot.run.id,
          currentTaskId: task.id,
          assignmentId,
        },
        {
          onText: () => {},
          onToolStart: (tool, input, metadata) => {
            this.recordToolEvent(snapshot.run.id, snapshot.run.conversationId ?? null, task.id, assignmentId, assignment.agentKey, tool, input, metadata, 'start');
          },
          onToolEnd: (tool, resultText, metadata) => {
            this.recordToolEvent(snapshot.run.id, snapshot.run.conversationId ?? null, task.id, assignmentId, assignment.agentKey, tool, { result: resultText }, metadata, 'end');
          },
          onCard: (card) => {
            this.config.orchestration.createApprovalRequest({
              runId: snapshot.run.id,
              taskId: task.id,
              assignmentId,
              sessionId: assignment.sessionId ?? null,
              agentKey: assignment.agentKey,
              prompt: `Agent produced ${card.type} card`,
              card,
            });
          },
          onError: (error) => {
            this.config.orchestration.recordEvent({
              runId: snapshot.run.id,
              conversationId: snapshot.run.conversationId ?? null,
              taskId: task.id,
              assignmentId,
              agentKey: assignment.agentKey,
              type: 'error',
              message: error,
            });
          },
        },
      );

      const supervisorSessionId = `narre:${result.sessionId}`;
      this.config.orchestration.updateAssignment({
        assignmentId,
        status: 'completed',
        sessionId: supervisorSessionId,
        result: result.assistantText,
      });
      this.config.orchestration.recordEvent({
        runId: snapshot.run.id,
        conversationId: snapshot.run.conversationId ?? null,
        taskId: task.id,
        assignmentId,
        sessionId: supervisorSessionId,
        agentKey: assignment.agentKey,
        type: 'agent_message',
        message: result.assistantText,
        payload: {
          sessionId: supervisorSessionId,
        },
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.config.orchestration.updateAssignment({
        assignmentId,
        status: 'failed',
        result: message,
      });
      this.config.orchestration.recordEvent({
        runId: snapshot.run.id,
        conversationId: snapshot.run.conversationId ?? null,
        taskId: task.id,
        assignmentId,
        agentKey: assignment.agentKey,
        type: 'error',
        message,
      });
      throw error;
    }
  }

  private resolveAgent(projectId: string, agentKey: string): AgentDefinition {
    const agent = this.config.supervisor
      .listAgents(projectId)
      .find((candidate) => getSupervisorAgentKey(candidate) === agentKey);
    if (!agent) {
      throw new Error(`Agent not found: ${agentKey}`);
    }
    return agent;
  }

  private async queueTerminalAssignment(
    agent: AgentDefinition,
    assignmentId: string,
  ): Promise<{ sessionId: string; assistantText: string }> {
    const assignment = this.config.orchestration.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }
    const task = this.config.orchestration.getTask(assignment.taskId);
    if (!task) {
      throw new Error(`Task not found: ${assignment.taskId}`);
    }
    const snapshot = this.config.orchestration.getRunSnapshot(assignment.runId);
    if (!snapshot) {
      throw new Error(`Run not found: ${assignment.runId}`);
    }
    const executors = this.config.executors;
    if (!executors) {
      throw new Error('Executor registry is not configured.');
    }

    const provider = agent.runtimeProfile?.provider ?? 'terminal';
    const executor = executors.findAvailableExecutor(snapshot.run.projectId, provider);
    if (!executor) {
      const message = `No online executor is available for ${provider}.`;
      this.config.orchestration.updateAssignment({
        assignmentId,
        status: 'blocked',
        result: message,
      });
      this.config.orchestration.recordEvent({
        runId: assignment.runId,
        conversationId: snapshot.run.conversationId ?? null,
        taskId: task.id,
        assignmentId,
        agentKey: assignment.agentKey,
        type: 'terminal_command',
        message,
        payload: { provider },
      });
      return { sessionId: '', assistantText: message };
    }

    const command = executors.queueCommand({
      executorId: executor.id,
      runId: assignment.runId,
      taskId: task.id,
      assignmentId,
      agentKey: assignment.agentKey,
      type: 'launch_agent',
      payload: {
        agent,
        userRequest: snapshot.run.userRequest,
        taskInput: task.input,
        dependsOnTaskIds: task.dependsOnTaskIds,
        runtimeProfile: agent.runtimeProfile ?? null,
      },
    });
    this.config.orchestration.updateAssignment({
      assignmentId,
      status: 'running',
      sessionId: `executor:${executor.id}`,
    });
    this.config.orchestration.recordEvent({
      runId: assignment.runId,
      conversationId: snapshot.run.conversationId ?? null,
      taskId: task.id,
      assignmentId,
      sessionId: `executor:${executor.id}`,
      agentKey: assignment.agentKey,
      type: 'terminal_command',
      message: `Queued ${command.type} on ${executor.id}`,
      payload: { command },
    });
    return {
      sessionId: `executor:${executor.id}`,
      assistantText: `Queued terminal command ${command.id}.`,
    };
  }

  private recordToolEvent(
    runId: string,
    conversationId: string | null,
    taskId: string,
    assignmentId: string,
    agentKey: string,
    tool: string,
    input: Record<string, unknown>,
    metadata: NarreToolMetadata,
    phase: 'start' | 'end',
  ): void {
    this.config.orchestration.recordEvent({
      runId,
      conversationId,
      taskId,
      assignmentId,
      agentKey,
      type: 'tool_call',
      message: `${tool} ${phase}`,
      payload: {
        phase,
        tool,
        input,
        metadata,
      },
    });
  }
}

function buildTaskPrompt(
  userRequest: string,
  taskInput: string,
  upstreamResults: Array<{ title: string; result: string }>,
): string {
  const sections = [
    'You are executing an assigned orchestration task.',
    '',
    '## User Request',
    userRequest,
    '',
    '## Assigned Task',
    taskInput,
  ];

  if (upstreamResults.length > 0) {
    sections.push(
      '',
      '## Upstream Task Results',
      ...upstreamResults.flatMap((item) => [
        `### ${item.title}`,
        item.result,
        '',
      ]),
    );
  }

  return sections.join('\n');
}

function collectUpstreamResults(
  tasks: readonly { id: string; title: string; result?: string | null }[],
  task: { dependsOnTaskIds: readonly string[] },
): Array<{ title: string; result: string }> {
  return task.dependsOnTaskIds
    .map((taskId) => tasks.find((candidate) => candidate.id === taskId))
    .filter((candidate): candidate is { id: string; title: string; result: string } =>
      Boolean(candidate?.result?.trim()),
    )
    .map((candidate) => ({
      title: candidate.title,
      result: candidate.result,
    }));
}

function parseTaskSkillIds(metadata: Record<string, string> | undefined): string[] {
  const raw = metadata?.skillIds?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((skillId) => skillId.trim())
    .filter((skillId, index, values) => skillId.length > 0 && values.indexOf(skillId) === index);
}

function resolveRuntimeProfile(
  agent: AgentDefinition,
  assignmentRuntime: AgentRuntimeProfile | null | undefined,
  taskOverride: AgentRuntimeOverride | undefined,
): AgentRuntimeProfile {
  const base = assignmentRuntime ?? agent.runtimeProfile;
  if (!base) {
    throw new Error(`Agent ${agent.id} does not define a runtime profile`);
  }

  return {
    ...base,
    model: taskOverride?.model ?? base.model,
    reasoningEffort: taskOverride?.reasoningEffort ?? base.reasoningEffort,
    temperature: taskOverride?.temperature ?? base.temperature,
    contextBudget: taskOverride?.contextBudget ?? base.contextBudget,
    extraInstruction: [
      base.extraInstruction,
      taskOverride?.extraInstruction,
    ].filter((value): value is string => Boolean(value?.trim())).join('\n\n') || undefined,
    toolProfileIds: base.toolProfileIds ? [...base.toolProfileIds] : undefined,
    metadata: {
      ...(base.metadata ?? {}),
      ...(taskOverride?.metadata ?? {}),
    },
  };
}
