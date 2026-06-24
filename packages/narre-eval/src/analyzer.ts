import { getNetiorMcpToolSpec } from '@netior/shared/constants';
import type {
  MetricValue,
  ScenarioAnalysis,
  ScenarioExecutionConfig,
  ToolCallRecord,
  ToolUseAnalysis,
  ToolUseFinding,
  Transcript,
} from './types.js';

interface ToolCallTraceItem {
  turnIndex: number;
  callIndex: number;
  tool: string;
  input: Record<string, unknown>;
}

function toolSuffix(tool: string): string {
  return tool.split('.').pop() ?? tool;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(sortValue(value));
  } catch {
    return '[unserializable]';
  }
}

function flattenToolCalls(transcript: Transcript): ToolCallTraceItem[] {
  return transcript.turns.flatMap((turn, turnIndex) =>
    turn.toolCalls.map((toolCall, callIndex) => ({
      turnIndex,
      callIndex,
      tool: toolCall.tool,
      input: toolCall.input,
    })),
  );
}

function hasWorldBindingKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(hasWorldBindingKey);
  }

  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    if (key === 'root_network_id' || key === 'rootNetworkId') {
      return true;
    }
    return hasWorldBindingKey(nested);
  });
}

function getToolBudgetLimit(execution: ScenarioExecutionConfig, transcript: Transcript): number {
  if (execution.execution_mode === 'multi_agent') {
    return 24;
  }

  return transcript.sessionResumeCount > 0 ? 18 : 10;
}

function isMutationLikeTool(tool: string): boolean {
  const spec = getNetiorMcpToolSpec(tool);
  if (spec?.isMutation) {
    return true;
  }

  return /^(create|update|delete|upsert|reorder)_/.test(toolSuffix(tool));
}

function isDynamicConversationTool(tool: string, expected: string): boolean {
  return toolSuffix(tool) === expected;
}

export function emptyScenarioAnalysis(): ScenarioAnalysis {
  return {
    toolUse: {
      findings: [],
      summary: {
        totalCalls: 0,
        uniqueToolCount: 0,
        discoveryCallCount: 0,
        promptRedundantLookupCount: 0,
        repeatedLookupGroupCount: 0,
        worldBindingViolationCount: 0,
        overBudget: false,
        budgetLimit: 0,
      },
    },
  };
}

export function analyzeScenario(
  transcript: Transcript,
  execution: ScenarioExecutionConfig,
): ScenarioAnalysis {
  const toolCalls = flattenToolCalls(transcript);
  const findings: ToolUseFinding[] = [];
  const uniqueTools = new Set(toolCalls.map((toolCall) => toolCall.tool));

  if (execution.target_skill === 'bootstrap') {
    const firstMutationIndex = toolCalls.findIndex((toolCall) => isMutationLikeTool(toolCall.tool));
    if (firstMutationIndex >= 0) {
      const beforeMutation = toolCalls.slice(0, firstMutationIndex);
      const sawInterview = beforeMutation.some((toolCall) => isDynamicConversationTool(toolCall.tool, 'ask'));
      const interviewCount = beforeMutation.filter((toolCall) => isDynamicConversationTool(toolCall.tool, 'ask')).length;
      const sawProposal = beforeMutation.some((toolCall) => isDynamicConversationTool(toolCall.tool, 'propose'));

      if (!sawInterview) {
        findings.push({
          kind: 'bootstrap_missing_interview',
          severity: 'warn',
          message: 'Bootstrap started structural mutation before any ontology/domain interview step.',
          tools: [toolCalls[firstMutationIndex].tool],
          count: 1,
          turnIndexes: [toolCalls[firstMutationIndex].turnIndex],
        });
      }

      if (sawInterview && interviewCount < 2) {
        findings.push({
          kind: 'bootstrap_insufficient_interview',
          severity: 'warn',
          message: 'Bootstrap started structural mutation before completing the two-round ontology/domain interview.',
          tools: [toolCalls[firstMutationIndex].tool],
          count: interviewCount,
          turnIndexes: [toolCalls[firstMutationIndex].turnIndex],
        });
      }

      if (!sawProposal) {
        findings.push({
          kind: 'bootstrap_missing_proposal',
          severity: 'warn',
          message: 'Bootstrap started structural mutation before presenting a proposal or draft to the user.',
          tools: [toolCalls[firstMutationIndex].tool],
          count: 1,
          turnIndexes: [toolCalls[firstMutationIndex].turnIndex],
        });
      }
    }
  }

  const discoveryCalls = toolCalls.filter((toolCall) => {
    const spec = getNetiorMcpToolSpec(toolCall.tool);
    return Boolean(spec?.profiles?.includes('discovery'));
  });

  if (discoveryCalls.length > 0) {
    findings.push({
      kind: 'prompt_digest_redundant_lookup',
      severity: discoveryCalls.length >= 3 ? 'warn' : 'info',
      message: 'Discovery tools were used even though world schema and hierarchy digest should already be present in the system prompt.',
      tools: [...new Set(discoveryCalls.map((toolCall) => toolCall.tool))],
      count: discoveryCalls.length,
      turnIndexes: [...new Set(discoveryCalls.map((toolCall) => toolCall.turnIndex))],
    });
  }

  if (discoveryCalls.length >= 3) {
    findings.push({
      kind: 'broad_discovery_overuse',
      severity: 'warn',
      message: 'Broad discovery lookups were used repeatedly. Prefer prompt digest and targeted inspection before world-scope discovery.',
      tools: [...new Set(discoveryCalls.map((toolCall) => toolCall.tool))],
      count: discoveryCalls.length,
      turnIndexes: [...new Set(discoveryCalls.map((toolCall) => toolCall.turnIndex))],
    });
  }

  const repeatedLookupGroups = new Map<string, ToolCallTraceItem[]>();
  for (const toolCall of toolCalls) {
    const spec = getNetiorMcpToolSpec(toolCall.tool);
    if (spec?.isMutation) {
      continue;
    }

    const key = `${toolCall.tool}::${stableStringify(toolCall.input)}`;
    const current = repeatedLookupGroups.get(key) ?? [];
    current.push(toolCall);
    repeatedLookupGroups.set(key, current);
  }

  const repeatedLookups = [...repeatedLookupGroups.values()].filter((group) => group.length > 1);
  for (const group of repeatedLookups) {
    findings.push({
      kind: 'redundant_repeated_lookup',
      severity: 'warn',
      message: `Repeated identical lookup for "${group[0].tool}" detected. Prefer reusing earlier results instead of making the same query again.`,
      tools: [group[0].tool],
      count: group.length,
      turnIndexes: [...new Set(group.map((toolCall) => toolCall.turnIndex))],
    });
  }

  const worldBindingViolations = toolCalls.filter((toolCall) => {
    const spec = getNetiorMcpToolSpec(toolCall.tool);
    return Boolean(spec?.defaultWorldBinding) && hasWorldBindingKey(toolCall.input);
  });
  for (const violation of worldBindingViolations) {
    findings.push({
      kind: 'world_binding_violation',
      severity: 'warn',
      message: `Tool "${violation.tool}" explicitly passed root_network_id even though current-world binding should be used by default.`,
      tools: [violation.tool],
      count: 1,
      turnIndexes: [violation.turnIndex],
    });
  }

  const budgetLimit = getToolBudgetLimit(execution, transcript);
  if (toolCalls.length > budgetLimit) {
    findings.push({
      kind: 'tool_budget_overrun',
      severity: 'warn',
      message: `Tool call count exceeded the expected budget (${toolCalls.length}/${budgetLimit}).`,
      count: toolCalls.length,
      turnIndexes: [...new Set(toolCalls.map((toolCall) => toolCall.turnIndex))],
    });
  }

  const toolUse: ToolUseAnalysis = {
    findings,
    summary: {
      totalCalls: toolCalls.length,
      uniqueToolCount: uniqueTools.size,
      discoveryCallCount: discoveryCalls.length,
      promptRedundantLookupCount: discoveryCalls.length,
      repeatedLookupGroupCount: repeatedLookups.length,
      worldBindingViolationCount: worldBindingViolations.length,
      overBudget: toolCalls.length > budgetLimit,
      budgetLimit,
    },
  };

  return { toolUse };
}

export function buildAnalysisMetrics(analysis: ScenarioAnalysis): Record<string, MetricValue> {
  return {
    discovery_tool_call_count: {
      value: analysis.toolUse.summary.discoveryCallCount,
      source: 'derived',
      confidence: 'exact',
    },
    prompt_redundant_lookup_count: {
      value: analysis.toolUse.summary.promptRedundantLookupCount,
      source: 'derived',
      confidence: 'exact',
    },
    repeated_lookup_group_count: {
      value: analysis.toolUse.summary.repeatedLookupGroupCount,
      source: 'derived',
      confidence: 'exact',
    },
    world_binding_violation_count: {
      value: analysis.toolUse.summary.worldBindingViolationCount,
      source: 'derived',
      confidence: 'exact',
    },
    tool_budget_limit: {
      value: analysis.toolUse.summary.budgetLimit,
      source: 'derived',
      confidence: 'exact',
    },
    tool_budget_overrun: {
      value: analysis.toolUse.summary.overBudget ? 1 : 0,
      source: 'derived',
      confidence: 'exact',
    },
    tool_use_finding_count: {
      value: analysis.toolUse.findings.length,
      source: 'derived',
      confidence: 'exact',
    },
  };
}
