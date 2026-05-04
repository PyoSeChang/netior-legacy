import type { AgentEvent, NarreStreamEvent } from '@netior/shared/types';
import type { NarreServerAdapter } from '../agents/narre-server.js';
import type { EvalScenario, ToolCallRecord, Transcript } from '../types.js';
import { resolveTurnTemplates } from '../tester-runtime.js';

interface OrchestrationRun {
  id: string;
  status: string;
  result?: string | null;
}

interface OrchestrationTask {
  id: string;
  status: string;
}

interface AgentAssignment {
  id: string;
  status: string;
  result?: string | null;
}

interface OrchestrationSnapshot {
  run: OrchestrationRun;
  tasks: OrchestrationTask[];
  assignments: AgentAssignment[];
  events: AgentEvent[];
}

interface AgentDefinition {
  kind: 'narre' | 'terminal';
  id: string;
  terminalAgentType?: string;
}

interface ExecutorCommand {
  id: string;
  type: string;
  status: string;
  assignmentId?: string | null;
}

const EXECUTOR_ID = 'narre-eval-terminal-executor';
const EXECUTOR_SURFACE_ID = 'narre-eval-terminal-surface';

export async function runOrchestrationScenario(
  adapter: NarreServerAdapter,
  scenario: EvalScenario,
  projectId: string,
  templateVars: Record<string, string> = {},
): Promise<Transcript> {
  const baseUrl = adapter.getBaseUrl();
  const resolvedTurn = resolveTurnTemplates(scenario.turns[0], templateVars);
  const userRequest = resolvedTurn?.content?.trim() || scenario.description;
  const toolCalls: ToolCallRecord[] = [];
  const errors: string[] = [];

  try {
    const runSnapshot = await callTool<OrchestrationSnapshot>(baseUrl, toolCalls, 'supervisor.create_run', '/supervisor/runs', {
      projectId,
      userRequest,
      mode: 'orchestration',
    });

    await callTool(baseUrl, toolCalls, 'supervisor.register_executor', '/supervisor/executors/register', {
      id: EXECUTOR_ID,
      projectId,
      provider: 'terminal',
      surface: { kind: 'terminal', id: EXECUTOR_SURFACE_ID },
      capabilities: ['terminal'],
    });

    const terminalAgentKey = await resolveTerminalAgentKey(baseUrl, projectId, toolCalls);
    const task = await callTool<OrchestrationTask>(baseUrl, toolCalls, 'supervisor.create_task', '/supervisor/tasks', {
      runId: runSnapshot.run.id,
      title: 'Queue deterministic terminal assignment',
      input: 'Queue a terminal launch command and report the executor result.',
      assignedAgentKey: terminalAgentKey,
    });
    const assignment = await callTool<AgentAssignment>(baseUrl, toolCalls, 'supervisor.assign_task', '/supervisor/assignments', {
      runId: runSnapshot.run.id,
      taskId: task.id,
      agentKey: terminalAgentKey,
    });

    await callTool(baseUrl, toolCalls, 'supervisor.run_assignment', `/supervisor/assignments/${assignment.id}/run`, {});
    const commands = await getTool<ExecutorCommand[]>(baseUrl, toolCalls, 'supervisor.claim_executor_commands', `/supervisor/executors/${EXECUTOR_ID}/commands`);
    if (commands.length !== 1) {
      throw new Error(`expected one executor command, got ${commands.length}`);
    }
    if (commands[0].type !== 'launch_agent') {
      throw new Error(`expected launch_agent command, got ${commands[0].type}`);
    }

    await callTool(baseUrl, toolCalls, 'supervisor.complete_executor_command', `/supervisor/executors/${EXECUTOR_ID}/commands/${commands[0].id}/result`, {
      status: 'completed',
      result: {
        assistantText: 'terminal executor completed deterministic assignment',
        exitCode: 0,
      },
    });

    const snapshot = await getTool<OrchestrationSnapshot>(baseUrl, toolCalls, 'supervisor.get_run_snapshot', `/supervisor/runs/${runSnapshot.run.id}`);
    assert(snapshot.assignments[0]?.status === 'completed', 'assignment should be completed');
    assert(snapshot.tasks[0]?.status === 'completed', 'task should be completed');
    assert(snapshot.events.some((event) => event.type === 'terminal_command'), 'terminal_command event should be recorded');
    assert(snapshot.events.some((event) => event.type === 'agent_message'), 'agent_message event should be recorded');

    toolCalls.push({
      tool: 'supervisor.restart_server',
      input: { reason: 'verify persisted orchestration state' },
      result: 'restarted',
    });
    await adapter.restart();

    const restoredSnapshot = await getTool<OrchestrationSnapshot>(
      baseUrl,
      toolCalls,
      'supervisor.get_restored_run_snapshot',
      `/supervisor/runs/${runSnapshot.run.id}`,
    );
    assert(restoredSnapshot.run.id === runSnapshot.run.id, 'run should survive restart');
    assert(restoredSnapshot.assignments[0]?.status === 'completed', 'assignment should survive restart');
    assert(restoredSnapshot.events.some((event) => event.type === 'terminal_command'), 'events should survive restart');

    return buildTranscript(scenario.id, userRequest, restoredSnapshot, toolCalls, errors);
  } catch (error) {
    errors.push((error as Error).message);
    return buildTranscript(scenario.id, userRequest, null, toolCalls, errors);
  }
}

async function resolveTerminalAgentKey(
  baseUrl: string,
  projectId: string,
  toolCalls: ToolCallRecord[],
): Promise<string> {
  const agents = await getTool<AgentDefinition[]>(
    baseUrl,
    toolCalls,
    'supervisor.list_agents',
    `/supervisor/agents?projectId=${encodeURIComponent(projectId)}`,
  );
  const terminalAgent = agents.find((agent) =>
    agent.kind === 'terminal' && agent.terminalAgentType === 'codex-cli',
  );
  if (!terminalAgent) {
    throw new Error('codex-cli terminal agent not found');
  }
  return `terminal:codex-cli:${terminalAgent.id}`;
}

function buildTranscript(
  scenarioId: string,
  userRequest: string,
  snapshot: OrchestrationSnapshot | null,
  toolCalls: ToolCallRecord[],
  errors: string[],
): Transcript {
  const eventSummary = snapshot
    ? [...new Set(snapshot.events.map((event) => event.type))].join(', ')
    : 'none';
  const assistant = snapshot
    ? [
      'orchestration control-plane contract completed',
      `run: ${snapshot.run.id}`,
      `run status: ${snapshot.run.status}`,
      `assignment status: ${snapshot.assignments[0]?.status ?? 'missing'}`,
      `events: ${eventSummary}`,
    ].join('\n')
    : `orchestration control-plane contract failed\n${errors.join('\n')}`;

  return {
    scenarioId,
    sessionId: snapshot?.run.id ?? null,
    turns: [{
      user: userRequest,
      assistant,
      toolCalls,
      events: supervisorEventsToStreamEvents(snapshot?.events ?? []),
      errors,
      testerInteractions: [],
    }],
    totalToolCalls: toolCalls.length,
    cardResponseCount: 0,
    sessionResumeCount: 0,
    testerInteractions: [],
    testerInteractionCount: 0,
  };
}

function supervisorEventsToStreamEvents(events: AgentEvent[]): NarreStreamEvent[] {
  return events.map((event) => ({
    type: 'tool_end',
    tool: `supervisor.${event.type}`,
    toolResult: event.message ?? JSON.stringify(event.payload ?? {}),
  }));
}

async function getTool<T>(
  baseUrl: string,
  toolCalls: ToolCallRecord[],
  tool: string,
  path: string,
): Promise<T> {
  const result = await requestJson<T>(baseUrl, path);
  toolCalls.push({ tool, input: { method: 'GET', path }, result: JSON.stringify(result) });
  return result;
}

async function callTool<T>(
  baseUrl: string,
  toolCalls: ToolCallRecord[],
  tool: string,
  path: string,
  body: unknown,
): Promise<T> {
  const result = await requestJson<T>(baseUrl, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  toolCalls.push({ tool, input: { method: 'POST', path, body: body as Record<string, unknown> }, result: JSON.stringify(result) });
  return result;
}

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
