import { spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { setTimeout as delay } from 'timers/promises';

interface OrchestrationRun {
  id: string;
  status: string;
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

interface AgentEvent {
  type: string;
  message?: string | null;
}

interface OrchestrationSnapshot {
  run: OrchestrationRun;
  tasks: OrchestrationTask[];
  assignments: AgentAssignment[];
  events: AgentEvent[];
}

interface ExecutorCommand {
  id: string;
  type: string;
  status: string;
  assignmentId?: string | null;
}

const ROOT_NETWORK_ID = 'narre-eval-orchestration-control-plane';
const EXECUTOR_ID = 'narre-eval-terminal-executor';
const TERMINAL_AGENT_KEY = 'terminal:codex-cli:codex-cli';

async function main(): Promise<void> {
  const port = Number(process.env.NARRE_EVAL_ORCHESTRATION_PORT ?? 3769);
  const dataDir = mkdtempSync(join(tmpdir(), 'narre-orchestration-e2e-'));
  const serverPath = resolveNarreServerPath();
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: ChildProcess | null = null;

  try {
    server = await startServer(serverPath, port, dataDir);
    const runSnapshot = await post<OrchestrationSnapshot>(baseUrl, '/supervisor/runs', {
      rootNetworkId: ROOT_NETWORK_ID,
      userRequest: 'Use Codex CLI to perform a deterministic terminal orchestration contract task.',
      mode: 'orchestration',
    });

    await post(baseUrl, '/supervisor/executors/register', {
      id: EXECUTOR_ID,
      rootNetworkId: ROOT_NETWORK_ID,
      provider: 'terminal',
      surface: { kind: 'terminal', id: 'narre-eval-terminal-surface' },
      capabilities: ['terminal'],
    });

    const task = await post<OrchestrationTask>(baseUrl, '/supervisor/tasks', {
      runId: runSnapshot.run.id,
      title: 'Queue deterministic terminal assignment',
      input: 'Queue a terminal launch command and wait for the executor result.',
      assignedAgentKey: TERMINAL_AGENT_KEY,
    });
    const assignment = await post<AgentAssignment>(baseUrl, '/supervisor/assignments', {
      runId: runSnapshot.run.id,
      taskId: task.id,
      agentKey: TERMINAL_AGENT_KEY,
    });

    const dispatchResult = await post<{ sessionId: string; assistantText: string }>(
      baseUrl,
      `/supervisor/assignments/${assignment.id}/run`,
      {},
    );
    assert(dispatchResult.sessionId === `executor:${EXECUTOR_ID}`, 'assignment should bind to the registered executor');

    const commands = await get<ExecutorCommand[]>(baseUrl, `/supervisor/executors/${EXECUTOR_ID}/commands`);
    assert(commands.length === 1, `expected one queued command, got ${commands.length}`);
    assert(commands[0].type === 'launch_agent', `expected launch_agent command, got ${commands[0].type}`);
    assert(commands[0].assignmentId === assignment.id, 'command should reference assignment');

    await post(baseUrl, `/supervisor/executors/${EXECUTOR_ID}/commands/${commands[0].id}/result`, {
      status: 'completed',
      result: {
        assistantText: 'terminal executor completed deterministic assignment',
        exitCode: 0,
      },
    });

    let snapshot = await get<OrchestrationSnapshot>(baseUrl, `/supervisor/runs/${runSnapshot.run.id}`);
    assert(snapshot.assignments[0]?.status === 'completed', 'assignment should be completed after executor result');
    assert(snapshot.tasks[0]?.status === 'completed', 'task should be completed after executor result');
    assert(snapshot.events.some((event) => event.type === 'terminal_command'), 'terminal command event should be recorded');
    assert(snapshot.events.some((event) => event.type === 'agent_message'), 'executor result should be recorded as agent message');

    await stopServer(server);
    server = null;

    server = await startServer(serverPath, port, dataDir);
    snapshot = await get<OrchestrationSnapshot>(baseUrl, `/supervisor/runs/${runSnapshot.run.id}`);
    assert(snapshot.run.id === runSnapshot.run.id, 'run should survive narre-server restart');
    assert(snapshot.assignments[0]?.status === 'completed', 'assignment status should survive restart');
    assert(snapshot.events.some((event) => event.type === 'terminal_command'), 'events should survive restart');

    console.log(JSON.stringify({
      status: 'pass',
      scenario: 'orchestration-terminal-control-plane',
      runId: snapshot.run.id,
      taskCount: snapshot.tasks.length,
      assignmentStatus: snapshot.assignments[0]?.status,
      eventTypes: [...new Set(snapshot.events.map((event) => event.type))],
      dataDir,
    }, null, 2));
  } finally {
    if (server) {
      await stopServer(server);
    }
  }
}

function resolveNarreServerPath(): string {
  const candidates = [
    join(process.cwd(), 'packages/narre-server/dist/index.cjs'),
    join(process.cwd(), 'packages/narre-server/dist/index.js'),
    join(process.cwd(), '../narre-server/dist/index.cjs'),
    join(process.cwd(), '../narre-server/dist/index.js'),
  ];
  const serverPath = candidates.find((candidate) => existsSync(candidate));
  if (!serverPath) {
    throw new Error('narre-server dist not found. Run pnpm --filter @netior/narre-server build first.');
  }
  return serverPath;
}

async function startServer(serverPath: string, port: number, dataDir: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      MOC_DATA_DIR: dataDir,
      NETIOR_SERVICE_URL: process.env.NETIOR_SERVICE_URL ?? 'http://127.0.0.1:3201',
      NARRE_PROVIDER: process.env.NARRE_PROVIDER ?? 'codex',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout?.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) console.log(`[narre-server] ${text}`);
  });
  child.stderr?.on('data', (chunk) => {
    const text = String(chunk).trim();
    if (text) console.error(`[narre-server:err] ${text}`);
  });

  await waitForHealth(port);
  return child;
}

async function waitForHealth(port: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // server is still starting
    }
    await delay(250);
  }
  throw new Error(`narre-server health check timed out on port ${port}`);
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  if (process.platform === 'win32' && child.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('exit', () => resolve());
      killer.once('error', () => resolve());
      setTimeout(resolve, 5_000);
    });
    return;
  }
  child.kill();
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    setTimeout(resolve, 5_000);
  });
}

async function get<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function post<T = unknown>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
