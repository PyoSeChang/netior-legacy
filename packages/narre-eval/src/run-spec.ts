import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import type { EvalOptions, RunSpec, ScenarioExecutionConfig, ScenarioType } from './types.js';
import { applyRunSpecExecutionOverrides } from './execution.js';

function isTruthyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function loadRunSpec(runSpecPath: string): RunSpec {
  if (!existsSync(runSpecPath)) {
    throw new Error(`Run spec not found: ${runSpecPath}`);
  }

  const raw = readFileSync(runSpecPath, 'utf-8');
  const parsed = parse(raw) as RunSpec | null;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Run spec must be an object: ${runSpecPath}`);
  }

  return parsed;
}

export function applyRunSpecToOptions(options: EvalOptions, runSpec: RunSpec | null): EvalOptions {
  if (!runSpec) {
    return options;
  }

  return {
    ...options,
    ...(options.scenario ? {} : isTruthyString(runSpec.scenario_id) ? { scenario: runSpec.scenario_id.trim() } : {}),
    ...(options.tag ? {} : isTruthyString(runSpec.tag) ? { tag: runSpec.tag.trim() } : {}),
    ...(options.repeat !== 1 || runSpec.repeat == null ? {} : { repeat: runSpec.repeat }),
    ...(options.judge !== true || runSpec.judge == null ? {} : { judge: runSpec.judge }),
    ...(options.port !== 3199 || runSpec.port == null ? {} : { port: runSpec.port }),
    ...(options.baseline ? {} : isTruthyString(runSpec.baseline) ? { baseline: runSpec.baseline.trim() } : {}),
    ...(options.preserve !== undefined || runSpec.preserve == null ? {} : { preserve: runSpec.preserve }),
    ...(options.dbPath ? {} : isTruthyString(runSpec.db_path) ? { dbPath: runSpec.db_path.trim() } : {}),
    ...(options.projectId ? {} : isTruthyString(runSpec.project_id) ? { projectId: runSpec.project_id.trim() } : {}),
  };
}

export function resolveRunId(defaultRunId: string, runSpec: RunSpec | null): string {
  if (!runSpec || !isTruthyString(runSpec.run_id)) {
    return defaultRunId;
  }

  return runSpec.run_id.trim() === 'auto' ? defaultRunId : runSpec.run_id.trim();
}

export function resolveScenarioExecutionForRun(
  execution: ScenarioExecutionConfig,
  _scenarioType: ScenarioType,
  runSpec: RunSpec | null,
): ScenarioExecutionConfig {
  return applyRunSpecExecutionOverrides(execution, runSpec);
}
