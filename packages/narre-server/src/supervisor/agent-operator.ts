import type {
  AgentAssignment,
  AgentDefinition,
  AgentRuntimeProfile,
  OrchestrationTask,
} from '@netior/shared/types';
import { getSupervisorAgentKey } from './agent-registry.js';
import type { SupervisorRegistry } from './supervisor-registry.js';
import type { OrchestrationRegistry, OrchestrationSnapshot } from './orchestration-registry.js';
import type { AgentRuntimeDispatcher } from './agent-runtime-dispatcher.js';
import type { NarreRuntime } from '../runtime/narre-runtime.js';

export interface AgentOperatorConfig {
  supervisor: SupervisorRegistry;
  orchestration: OrchestrationRegistry;
  dispatcher: AgentRuntimeDispatcher;
  createRuntime: (runtimeProfile: AgentRuntimeProfile) => Promise<NarreRuntime>;
}

export class AgentOperator {
  constructor(private readonly config: AgentOperatorConfig) {}

  async planRun(runId: string): Promise<OrchestrationSnapshot> {
    const snapshot = this.requireRun(runId);
    if (snapshot.tasks.length > 0) {
      return snapshot;
    }

    const agents = this.config.supervisor.listAgents(snapshot.run.rootNetworkId);
    const finderKey = requireAgentKey(agents, 'network-finder');
    const builderKey = requireAgentKey(agents, 'network-builder');
    const operatorKey = requireAgentKey(agents, 'agent-operator');
    const plan = await this.buildPlan(snapshot, agents);
    const createdTasks: OrchestrationTask[] = [];

    if (plan.tasks.length > 0) {
      for (const planTask of plan.tasks) {
        const dependsOnTaskIds = planTask.dependsOnIndexes
          .map((index) => createdTasks[index]?.id)
          .filter((taskId): taskId is string => Boolean(taskId));
        createdTasks.push(this.createAssignedTask({
          runId,
          title: planTask.title,
          input: planTask.input,
          agentKey: planTask.agentKey,
          dependsOnTaskIds,
          skillIds: planTask.skillIds,
        }));
      }
    } else {
      const fallback = buildRuleBasedPlan(snapshot.run.userRequest);
      if (fallback.useFinder) {
        createdTasks.push(this.createAssignedTask({
          runId,
          title: 'Discover relevant world context',
          input: [
            'Find relevant instances, networks, files, meanings, relation types, and unresolved context for the user request.',
            'Return concise findings with stable references and avoid mutations.',
          ].join('\n'),
          agentKey: finderKey,
          dependsOnTaskIds: [],
        }));
      }

      if (fallback.useBuilder) {
        createdTasks.push(this.createAssignedTask({
          runId,
          title: 'Build or propose Netior structure',
          input: [
            'Use the user request and upstream findings to build or propose the needed Netior structure.',
            'Keep the output explicit about created/proposed instances, meanings, relation types, edges, and questions.',
          ].join('\n'),
          agentKey: builderKey,
          dependsOnTaskIds: createdTasks.map((task) => task.id),
        }));
      }

      if (!fallback.useFinder && !fallback.useBuilder) {
        createdTasks.push(this.createAssignedTask({
          runId,
          title: 'Answer and coordinate the request',
          input: [
            'Analyze the user request, identify the needed next steps, and provide a concise response.',
            'If additional agent work is needed, describe the missing task clearly.',
          ].join('\n'),
          agentKey: operatorKey,
          dependsOnTaskIds: [],
        }));
      }
    }

    if (createdTasks.length > 1) {
      createdTasks.push(this.createAssignedTask({
        runId,
        title: 'Synthesize orchestration result',
        input: [
          'Review upstream agent results and produce a final synthesis for the user.',
          'Surface unresolved risks, assumptions, and recommended next steps.',
        ].join('\n'),
        agentKey: operatorKey,
        dependsOnTaskIds: createdTasks.map((task) => task.id),
      }));
    }

    this.config.orchestration.recordEvent({
      runId,
      conversationId: snapshot.run.conversationId ?? null,
      agentKey: operatorKey,
      type: 'agent_message',
      message: 'Agent Operator created an initial task plan.',
      payload: {
        planner: plan.source,
        taskCount: createdTasks.length,
      },
    });

    const next = this.config.orchestration.getRunSnapshot(runId);
    if (!next) {
      throw new Error(`Run not found after planning: ${runId}`);
    }
    return next;
  }

  async runPlannedRun(runId: string): Promise<OrchestrationSnapshot> {
    let snapshot = await this.planRun(runId);
    this.config.orchestration.updateRunStatus(runId, 'running');

    while (true) {
      snapshot = this.requireRun(runId);
      const runnable = findRunnableAssignments(snapshot);
      if (runnable.length === 0) {
        break;
      }

      await Promise.all(runnable.map(async (assignment) => {
        const task = snapshot.tasks.find((candidate) => candidate.id === assignment.taskId);
        if (task?.dependsOnTaskIds.length) {
          this.config.orchestration.recordEvent({
            runId,
            conversationId: snapshot.run.conversationId ?? null,
            taskId: task.id,
            assignmentId: assignment.id,
            agentKey: assignment.agentKey,
            type: 'handoff',
            message: `Passing ${task.dependsOnTaskIds.length} upstream result(s) to ${assignment.agentKey}`,
            payload: {
              dependsOnTaskIds: task.dependsOnTaskIds,
            },
          });
        }

        await this.config.dispatcher.runAssignment(assignment.id);
      }));
    }

    snapshot = this.requireRun(runId);
    const failed = snapshot.assignments.find((assignment) => assignment.status === 'failed');
    const unfinished = snapshot.assignments.filter((assignment) => assignment.status !== 'completed');
    const running = unfinished.filter((assignment) => assignment.status === 'running');
    if (failed) {
      this.config.orchestration.updateRunStatus(runId, 'failed', failed.result ?? `Assignment failed: ${failed.id}`);
    } else if (unfinished.length === 0 && snapshot.assignments.length > 0) {
      const finalResult = snapshot.assignments[snapshot.assignments.length - 1]?.result ?? '';
      this.config.orchestration.updateRunStatus(runId, 'completed', finalResult);
    } else if (running.length > 0) {
      this.config.orchestration.updateRunStatus(runId, 'running', 'Waiting for asynchronous executor assignment results.');
    } else if (unfinished.length > 0) {
      this.config.orchestration.updateRunStatus(runId, 'blocked', 'No runnable assignment is available.');
    }

    return this.requireRun(runId);
  }

  private createAssignedTask(input: {
    runId: string;
    title: string;
    input: string;
    agentKey: string;
    dependsOnTaskIds: string[];
    skillIds?: string[];
  }): OrchestrationTask {
    const task = this.config.orchestration.createTask({
      runId: input.runId,
      title: input.title,
      input: input.input,
      assignedAgentKey: input.agentKey,
      dependsOnTaskIds: input.dependsOnTaskIds,
      metadata: input.skillIds && input.skillIds.length > 0
        ? { skillIds: input.skillIds.join(',') }
        : undefined,
    });
    this.config.orchestration.assignTask({
      runId: input.runId,
      taskId: task.id,
      agentKey: input.agentKey,
    });
    return task;
  }

  private requireRun(runId: string): OrchestrationSnapshot {
    const snapshot = this.config.orchestration.getRunSnapshot(runId);
    if (!snapshot) {
      throw new Error(`Run not found: ${runId}`);
    }
    return snapshot;
  }

  private async buildPlan(
    snapshot: OrchestrationSnapshot,
    agents: readonly AgentDefinition[],
  ): Promise<ResolvedPlan> {
    const operator = agents.find((candidate) =>
      candidate.kind === 'narre'
      && candidate.narreAgentType === 'system'
      && candidate.systemAgentType === 'agent-operator',
    );
    if (!operator?.runtimeProfile) {
      return { source: 'rule-based-fallback', tasks: [] };
    }

    try {
      const runtime = await this.config.createRuntime(operator.runtimeProfile);
      const result = await runtime.runChat({
        rootNetworkId: snapshot.run.rootNetworkId,
        message: buildPlannerPrompt(snapshot, agents),
        traceId: `operator-plan:${snapshot.run.id}`,
        activeAgent: operator,
        runtimeProfile: operator.runtimeProfile,
        currentRunId: snapshot.run.id,
      }, {
        onText: () => {},
        onToolStart: () => {},
        onToolEnd: () => {},
        onCard: (card) => {
          this.config.orchestration.createApprovalRequest({
            runId: snapshot.run.id,
            agentKey: getSupervisorAgentKey(operator),
            prompt: `Agent Operator produced ${card.type} card while planning.`,
            card,
          });
        },
        onError: (error) => {
          this.config.orchestration.recordEvent({
            runId: snapshot.run.id,
            conversationId: snapshot.run.conversationId ?? null,
            agentKey: getSupervisorAgentKey(operator),
            type: 'error',
            message: error,
          });
        },
      });
      return parsePlannerResult(result.assistantText, agents);
    } catch (error) {
      this.config.orchestration.recordEvent({
        runId: snapshot.run.id,
        conversationId: snapshot.run.conversationId ?? null,
        agentKey: getSupervisorAgentKey(operator),
        type: 'error',
        message: `Agent Operator planner fell back to rule-based planning: ${(error as Error).message}`,
      });
      return { source: 'rule-based-fallback', tasks: [] };
    }
  }
}

interface ResolvedPlanTask {
  title: string;
  input: string;
  agentKey: string;
  dependsOnIndexes: number[];
  skillIds: string[];
}

interface ResolvedPlan {
  source: 'llm' | 'rule-based-fallback';
  tasks: ResolvedPlanTask[];
}

interface PlannerTaskJson {
  title?: unknown;
  input?: unknown;
  agent?: unknown;
  dependsOn?: unknown;
  skills?: unknown;
}

interface PlannerJson {
  tasks?: unknown;
}

function buildPlannerPrompt(snapshot: OrchestrationSnapshot, agents: readonly AgentDefinition[]): string {
  const agentList = agents
    .filter((agent) => agent.kind === 'narre')
    .map((agent) => {
      const key = getSupervisorAgentKey(agent);
      const purpose = agent.description ?? agent.name;
      return `- ${key}: ${purpose}`;
    })
    .join('\n');

  return [
    'Create an execution plan for this Netior multi-agent orchestration run.',
    'Return JSON only. Do not include Markdown fences or commentary.',
    '',
    'Meaning:',
    '{"tasks":[{"title":"short task title","input":"full instruction for the assigned agent","agent":"agent key from available agents","skills":["skill-id"],"dependsOn":[0]}]}',
    '',
    'Rules:',
    '- Use independent tasks when work can run in parallel.',
    '- Use dependencies only when a task truly needs upstream results.',
    '- Use network-finder for discovery/read-only investigation.',
    '- Use network-builder for Netior structure creation or mutation.',
    '- Use agent-operator for coordination, synthesis, or direct answers.',
    '- Use skills only when the task needs specialized procedure knowledge.',
    '- Available specialized skills: network-representation-authoring, schema-field-behavior, interactive-view, bootstrap.',
    '- Keep tasks concrete enough that each agent can run without more UI context.',
    '',
    'Available agents:',
    agentList,
    '',
    'User request:',
    snapshot.run.userRequest,
  ].join('\n');
}

function parsePlannerResult(text: string, agents: readonly AgentDefinition[]): ResolvedPlan {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return { source: 'rule-based-fallback', tasks: [] };
  }

  try {
    const parsed = JSON.parse(jsonText) as PlannerJson;
    if (!Array.isArray(parsed.tasks)) {
      return { source: 'rule-based-fallback', tasks: [] };
    }
    const validAgentKeys = new Set(agents.map(getSupervisorAgentKey));
    const validSkillIds = new Set([
      'network-representation-authoring',
      'schema-field-behavior',
      'interactive-view',
      'bootstrap',
    ]);
    const tasks = parsed.tasks
      .map((task): PlannerTaskJson => task as PlannerTaskJson)
      .map((task): ResolvedPlanTask | null => {
        if (
          typeof task.title !== 'string'
          || typeof task.input !== 'string'
          || typeof task.agent !== 'string'
          || !validAgentKeys.has(task.agent)
        ) {
          return null;
        }
        const dependsOnIndexes = Array.isArray(task.dependsOn)
          ? task.dependsOn
            .filter((value): value is number => Number.isInteger(value) && value >= 0)
            .filter((value, index, values) => values.indexOf(value) === index)
          : [];
        const skillIds = Array.isArray(task.skills)
          ? task.skills
            .filter((value): value is string => typeof value === 'string' && validSkillIds.has(value))
            .filter((value, index, values) => values.indexOf(value) === index)
          : [];
        return {
          title: task.title.trim(),
          input: task.input.trim(),
          agentKey: task.agent,
          dependsOnIndexes,
          skillIds,
        };
      })
      .filter((task): task is ResolvedPlanTask =>
        Boolean(task?.title && task.input),
      );
    return tasks.length > 0
      ? { source: 'llm', tasks }
      : { source: 'rule-based-fallback', tasks: [] };
  } catch {
    return { source: 'rule-based-fallback', tasks: [] };
  }
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]?.trim().startsWith('{')) {
    return fenced[1].trim();
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
}

function buildRuleBasedPlan(userRequest: string): { useFinder: boolean; useBuilder: boolean } {
  const normalized = userRequest.toLowerCase();
  const finderKeywords = [
    '\ucc3e',
    '\uac80\uc0c9',
    '\uc870\uc0ac',
    '\ud655\uc778',
    '\ubd84\uc11d',
  ];
  const builderKeywords = [
    '\ub9cc\ub4e4',
    '\uc0dd\uc131',
    '\uad6c\uc131',
    '\uc124\uacc4',
    '\uc815\ub9ac',
    '\ucd94\uac00',
    '\uc218\uc815',
  ];
  const useFinder = finderKeywords.some((keyword) => normalized.includes(keyword))
    || /\b(discover|find|search|lookup|inspect|analy[sz]e)\b/.test(normalized);
  const useBuilder = builderKeywords.some((keyword) => normalized.includes(keyword))
    || /\b(build|create|design|bootstrap|structure|organize|update)\b/.test(normalized);
  return {
    useFinder,
    useBuilder,
  };
}

function requireAgentKey(agents: readonly AgentDefinition[], systemAgentType: string): string {
  const agent = agents.find((candidate) =>
    candidate.kind === 'narre'
    && candidate.narreAgentType === 'system'
    && candidate.systemAgentType === systemAgentType,
  );
  if (!agent) {
    throw new Error(`System agent not found: ${systemAgentType}`);
  }
  return getSupervisorAgentKey(agent);
}

function findRunnableAssignments(snapshot: OrchestrationSnapshot): AgentAssignment[] {
  const completedTaskIds = new Set(
    snapshot.tasks
      .filter((task) => task.status === 'completed')
      .map((task) => task.id),
  );

  return snapshot.assignments.filter((assignment) => {
    if (assignment.status !== 'pending') {
      return false;
    }

    const task = snapshot.tasks.find((candidate) => candidate.id === assignment.taskId);
    return Boolean(task?.dependsOnTaskIds.every((taskId) => completedTaskIds.has(taskId)));
  });
}
