import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { loadScenarios } from './loader.js';
import { setupScenario, teardownScenario, setRunId } from './harness.js';
import { runScenario } from './runner/session-runner.js';
import { runOrchestrationScenario } from './runner/orchestration-runner.js';
import { NarreServerAdapter } from './agents/narre-server.js';
import { gradeScenario, errorMetrics, skippedMetrics, GRADING_VERSION, type GradeContext } from './grader.js';
import { recordResult, recordRunResult, printSummary } from './report.js';
import { findBaselineRunDir, loadBaselineResult, compareResults } from './comparator.js';
import { loadRunSpec, applyRunSpecToOptions, resolveRunId, resolveScenarioExecutionForRun } from './run-spec.js';
import { emptyScenarioAnalysis } from './analyzer.js';
import { resolveDevRuntimeTarget } from './dev-runtime.js';
import type {
  AgentInfo,
  EvalOptions,
  ScenarioResult,
  EvalScenario,
  ProvenanceInfo,
  RunSpec,
  ScenarioExecutionConfig,
} from './types.js';
import type { EvalAgentAdapter } from './agents/base.js';

const APPDATA = process.env.APPDATA || process.env.HOME || '.';
const EVAL_DATA_DIR = join(APPDATA, 'netior', 'data', 'eval');
const EXECUTOR_INFO: ProvenanceInfo = {
  id: process.env.NARRE_EVAL_EXECUTOR_ID || 'narre-eval-cli',
  name: process.env.NARRE_EVAL_EXECUTOR_NAME || 'narre-eval CLI',
  source: process.env.NARRE_EVAL_EXECUTOR_SOURCE || 'manual-cli',
};

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]): EvalOptions {
  const args = argv.slice(2);
  const options: EvalOptions = {
    repeat: 1,
    judge: true,
    port: 3199,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scenario':
        options.scenario = args[++i];
        break;
      case '--tag':
        options.tag = args[++i];
        break;
      case '--repeat':
        options.repeat = parseInt(args[++i], 10);
        break;
      case '--no-judge':
        options.judge = false;
        break;
      case '--port':
        options.port = parseInt(args[++i], 10);
        break;
      case '--baseline':
        options.baseline = args[++i];
        break;
      case '--run-spec':
        options.runSpec = args[++i];
        break;
      case '--preserve':
        options.preserve = true;
        break;
      case '--dev-db':
        options.devDb = true;
        break;
      case '--db-path':
        options.dbPath = args[++i];
        break;
      case '--project-id':
        options.projectId = args[++i];
        break;
    }
  }

  return options;
}

function buildTargetAgentInfo(
  adapter: EvalAgentAdapter,
  execution: ScenarioExecutionConfig,
): AgentInfo {
  return {
    id: execution.agent_id,
    name: execution.agent_id,
    runtime: adapter.runtimeType,
    adapter_id: adapter.agentId,
    adapter_name: adapter.agentName,
    provider: execution.provider,
    tester: execution.tester,
  };
}

function buildAdapterEnv(execution: ScenarioExecutionConfig): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    NARRE_PROVIDER: execution.provider,
  };

  if (execution.provider === 'codex') {
    const model = typeof execution.provider_settings?.model === 'string'
      ? execution.provider_settings.model.trim()
      : '';
    if (model) {
      env.NARRE_CODEX_MODEL = model;
    }
    if (execution.provider_settings) {
      env.NARRE_CODEX_SETTINGS_JSON = JSON.stringify(execution.provider_settings);
    }
  }

  if (execution.provider === 'openai') {
    const model = typeof execution.provider_settings?.model === 'string'
      ? execution.provider_settings.model.trim()
      : '';
    if (model) {
      env.NARRE_OPENAI_MODEL = model;
    }
  }

  return env;
}

function checkCompatibility(
  execution: ScenarioExecutionConfig,
  adapter: EvalAgentAdapter,
): string | null {
  if (
    execution.supported_agents.length > 0 &&
    !execution.supported_agents.includes(execution.agent_id) &&
    !execution.supported_agents.includes(adapter.agentId)
  ) {
    return `agent "${execution.agent_id}" / adapter "${adapter.agentId}" not in supported_agents [${execution.supported_agents.join(', ')}]`;
  }

  const missingCaps = execution.required_capabilities.filter(
    (cap) => !adapter.capabilities.includes(cap),
  );
  if (missingCaps.length > 0) {
    return `missing required capabilities: [${missingCaps.join(', ')}]`;
  }

  return null;
}

function buildSkippedResult(
  runId: string,
  scenario: EvalScenario,
  agent: AgentInfo,
  execution: ScenarioExecutionConfig,
  reason: string,
): ScenarioResult {
  return {
    runId,
    scenarioId: scenario.id,
    timestamp: new Date().toISOString(),
    status: 'skipped',
    agent,
    execution,
    scenarioAuthor: scenario.versionInfo?.created_by ?? null,
    executedBy: EXECUTOR_INFO,
    scenarioVersion: scenario.versionInfo?.scenario_version ?? null,
    schemaVersion: scenario.versionInfo?.schema_version ?? null,
    gradingVersion: GRADING_VERSION,
    verifyResults: { passed: 0, total: 0, results: [] },
    judgeScores: [],
    judgeAvg: null,
    judgeReportMarkdown: null,
    durationMs: 0,
    metrics: skippedMetrics(),
    analysis: emptyScenarioAnalysis(),
    transcript: {
      scenarioId: scenario.id,
      sessionId: null,
      turns: [],
      totalToolCalls: 0,
      cardResponseCount: 0,
      sessionResumeCount: 0,
      testerInteractions: [],
      testerInteractionCount: 0,
    },
    skipReason: reason,
  };
}

function buildErrorResult(
  runId: string,
  scenario: EvalScenario,
  agent: AgentInfo,
  execution: ScenarioExecutionConfig,
  error: Error,
): ScenarioResult {
  return {
    runId,
    scenarioId: scenario.id,
    timestamp: new Date().toISOString(),
    status: 'error',
    agent,
    execution,
    scenarioAuthor: scenario.versionInfo?.created_by ?? null,
    executedBy: EXECUTOR_INFO,
    scenarioVersion: scenario.versionInfo?.scenario_version ?? null,
    schemaVersion: scenario.versionInfo?.schema_version ?? null,
    gradingVersion: GRADING_VERSION,
    verifyResults: { passed: 0, total: 0, results: [] },
    judgeScores: [],
    judgeAvg: null,
    judgeReportMarkdown: null,
    durationMs: 0,
    metrics: errorMetrics(),
    analysis: emptyScenarioAnalysis(),
    transcript: {
      scenarioId: scenario.id,
      sessionId: null,
      turns: [],
      totalToolCalls: 0,
      cardResponseCount: 0,
      sessionResumeCount: 0,
      testerInteractions: [],
      testerInteractionCount: 0,
    },
    error: error.message,
  };
}

function summarizeRunAgentInfo(results: ScenarioResult[], adapter: EvalAgentAdapter): AgentInfo {
  const distinctKeys = new Set(results.map((result) => {
    return `${result.agent.id}|${result.execution.provider}|${result.execution.tester}`;
  }));

  if (results.length > 0 && distinctKeys.size === 1) {
    return results[0].agent;
  }

  return {
    id: 'multiple',
    name: 'multiple execution profiles',
    runtime: adapter.runtimeType,
    adapter_id: adapter.agentId,
    adapter_name: adapter.agentName,
  };
}

async function main() {
  const rawOptions = parseArgs(process.argv);
  const runSpec: RunSpec | null = rawOptions.runSpec ? loadRunSpec(rawOptions.runSpec) : null;
  const options = applyRunSpecToOptions(rawOptions, runSpec);
  const devRuntimeTarget = options.devDb ? resolveDevRuntimeTarget(process.cwd()) : null;
  const scenarioDbPath = devRuntimeTarget?.dbPath ?? options.dbPath;
  const preserveScenarioData = options.devDb ? true : options.preserve ?? false;

  const runId = resolveRunId(randomUUID().slice(0, 8), runSpec);
  setRunId(runId);

  const startedAt = new Date().toISOString();

  const packageRoot = join(__dirname, '..');
  const scenariosDir = join(packageRoot, 'scenarios');
  const runsDir = join(packageRoot, 'runs');

  const scenarios = await loadScenarios(scenariosDir, options);
  if (scenarios.length === 0) {
    console.error('No scenarios found matching filters.');
    process.exit(1);
  }

  const adapter = new NarreServerAdapter();

  const baselineRunDir = options.baseline !== undefined
    ? findBaselineRunDir(runsDir, runId, options.baseline || 'latest')
    : findBaselineRunDir(runsDir, runId, 'latest');

  console.log(`\nLoaded ${scenarios.length} scenario(s)  [run: ${runId}]`);
  if (rawOptions.runSpec) console.log(`Run spec: ${rawOptions.runSpec}`);
  if (baselineRunDir) console.log(`Baseline: ${baselineRunDir}`);
  if (!options.judge) console.log('LLM judge: disabled');
  if (options.repeat > 1) console.log(`Repeat: ${options.repeat}x`);
  if (preserveScenarioData) console.log('Preserve: enabled');
  if (devRuntimeTarget) {
    console.log(`Dev runtime scope: ${devRuntimeTarget.runtimeScope}`);
    console.log(`Dev DB: ${devRuntimeTarget.dbPath}`);
  } else if (scenarioDbPath) {
    console.log(`DB path: ${scenarioDbPath}`);
  }
  if (options.projectId) console.log(`Project ID: ${options.projectId}`);

  const allResults: ScenarioResult[] = [];
  const scenarioExecutions: Array<{ scenarioId: string; execution: ScenarioExecutionConfig }> = [];

  for (let rep = 0; rep < options.repeat; rep++) {
    if (options.repeat > 1) console.log(`\n--- Run ${rep + 1}/${options.repeat} ---`);

    for (const scenario of scenarios) {
      const execution = resolveScenarioExecutionForRun(scenario.execution, scenario.type, runSpec);
      const targetAgent = buildTargetAgentInfo(adapter, execution);

      if (rep === 0) {
        scenarioExecutions.push({ scenarioId: scenario.id, execution });
      }

      console.log(`\n> Running: ${scenario.id} [${execution.agent_id}/${execution.provider}/${execution.tester}] - ${scenario.description}`);

      const skipReason = checkCompatibility(execution, adapter);
      if (skipReason) {
        console.log(`  SKIPPED: ${skipReason}`);
        const skipped = buildSkippedResult(runId, scenario, targetAgent, execution, skipReason);
        recordResult(scenario.scenarioDir, skipped);
        allResults.push(skipped);
        continue;
      }

      let setup: Awaited<ReturnType<typeof setupScenario>> | null = null;

      try {
        console.log('  Setting up scenario...');
        setup = await setupScenario(scenario.scenarioDir, scenario.seed, scenario.id, {
          dbPath: scenarioDbPath,
          projectId: options.projectId,
          preserve: preserveScenarioData,
        });
        if (setup.preserve) {
          console.log(`  Preserving scenario data: db=${setup.dbPath}, project=${setup.projectId}, dir=${setup.tempDir}`);
        }

        console.log(`  Starting narre-server (${execution.provider})...`);
        await adapter.setup({
          runId,
          port: options.port,
          dbPath: setup.dbPath,
          dataDir: EVAL_DATA_DIR,
          serviceUrl: setup.serviceUrl,
          env: buildAdapterEnv(execution),
        });

        console.log(execution.execution_mode === 'multi_agent' ? '  Running orchestration...' : '  Sending turns...');
        const startTime = Date.now();
        const transcript = execution.execution_mode === 'multi_agent'
          ? await runOrchestrationScenario(adapter, scenario, setup.projectId, setup.templateVars)
          : await runScenario(adapter, scenario, setup.projectId, setup.templateVars);
        const durationMs = Date.now() - startTime;

        console.log(`  Completed in ${(durationMs / 1000).toFixed(1)}s (${transcript.totalToolCalls} tool calls)`);

        console.log('  Grading...');
        const gradeCtx: GradeContext = {
          runId,
          agent: targetAgent,
          execution,
          durationMs,
          versionInfo: scenario.versionInfo,
          executedBy: EXECUTOR_INFO,
          scenarioDescription: scenario.description,
          scenarioType: scenario.type,
          scenarioTags: scenario.tags,
          scenarioResponsibilitySurfaces: scenario.responsibilitySurfaces,
        };
        const result = await gradeScenario(
          scenario.id,
          transcript,
          scenario.verify,
          scenario.qualitative,
          setup.projectId,
          setup.serviceUrl,
          options.judge,
          gradeCtx,
        );
        result.setup = {
          projectId: setup.projectId,
          dbPath: setup.dbPath,
          tempDir: setup.tempDir,
          preserved: setup.preserve,
        };

        if (baselineRunDir) {
          const baseline = loadBaselineResult(baselineRunDir, scenario.id);
          if (baseline) {
            result.comparison = compareResults(result, baseline);
          }
        }

        recordResult(scenario.scenarioDir, result);
        allResults.push(result);
      } catch (error) {
        const errResult = buildErrorResult(
          runId,
          scenario,
          targetAgent,
          execution,
          error as Error,
        );
        recordResult(scenario.scenarioDir, errResult);
        allResults.push(errResult);
        console.error(`  ERROR: ${(error as Error).message}`);
      } finally {
        try {
          await adapter.teardown();
        } catch (error) {
          console.warn(`  WARNING: adapter teardown failed: ${(error as Error).message}`);
        }
        if (setup) {
          try {
            await teardownScenario(setup, { preserve: setup.preserve });
          } catch (error) {
            console.warn(`  WARNING: scenario cleanup failed for ${scenario.id}: ${(error as Error).message}`);
          }
        }
      }
    }
  }

  const finishedAt = new Date().toISOString();
  recordRunResult(packageRoot, {
    runId,
    startedAt,
    finishedAt,
    agent: summarizeRunAgentInfo(allResults, adapter),
    executedBy: EXECUTOR_INFO,
    runSpecPath: rawOptions.runSpec ?? null,
    runSpec,
    scenarioExecutions,
    scenarioIds: allResults.map((r) => r.scenarioId),
  }, allResults);

  printSummary(allResults);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
