import type { EvalAgentAdapter, CardHandler } from '../agents/base.js';
import type {
  EvalScenario,
  Transcript,
  TurnTranscript,
} from '../types.js';
import { buildTesterCardHandler, flattenTesterInteractions, resolveTurnTemplates } from '../tester-runtime.js';

export async function runScenario(
  adapter: EvalAgentAdapter,
  scenario: EvalScenario,
  rootNetworkId: string,
  templateVars: Record<string, string> = {},
): Promise<Transcript> {
  if (scenario.type === 'conversation') {
    return runConversation(adapter, scenario, rootNetworkId, templateVars);
  }
  return runSingleTurn(adapter, scenario, rootNetworkId, templateVars);
}

async function runSingleTurn(
  adapter: EvalAgentAdapter,
  scenario: EvalScenario,
  rootNetworkId: string,
  templateVars: Record<string, string>,
): Promise<Transcript> {
  const turns: TurnTranscript[] = [];
  let totalToolCalls = 0;
  let cardResponseCount = 0;

  for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
    const turn = scenario.turns[turnIndex];
    const resolvedTurn = resolveTurnTemplates(turn, templateVars);
    const testerInteractions: TurnTranscript['testerInteractions'] = [];
    const onCard: CardHandler = buildTesterCardHandler(scenario, turnIndex, turns, (interaction) => {
      testerInteractions.push(interaction);
    });
    const result = await adapter.sendTurn({
      sessionId: null,
      rootNetworkId,
      message: resolvedTurn.content,
      mentions: resolvedTurn.mentions,
      onCard,
    });

    turns.push({
      user: resolvedTurn.content,
      assistant: result.assistantText,
      toolCalls: result.toolCalls,
      events: result.events,
      errors: result.errors,
      testerInteractions,
    });

    totalToolCalls += result.toolCalls.length;
    cardResponseCount += result.cardResponseCount;
  }

  const allTesterInteractions = flattenTesterInteractions(turns);
  return {
    scenarioId: scenario.id,
    sessionId: null,
    turns,
    totalToolCalls,
    cardResponseCount,
    sessionResumeCount: 0,
    testerInteractions: allTesterInteractions,
    testerInteractionCount: allTesterInteractions.length,
  };
}

async function runConversation(
  adapter: EvalAgentAdapter,
  scenario: EvalScenario,
  rootNetworkId: string,
  templateVars: Record<string, string>,
): Promise<Transcript> {
  const turns: TurnTranscript[] = [];
  let totalToolCalls = 0;
  let cardResponseCount = 0;
  let sessionResumeCount = 0;
  let sessionId: string | null = null;

  for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
    const turn = scenario.turns[turnIndex];
    const resolvedTurn = resolveTurnTemplates(turn, templateVars);
    const testerInteractions: TurnTranscript['testerInteractions'] = [];
    const onCard: CardHandler = buildTesterCardHandler(scenario, turnIndex, turns, (interaction) => {
      testerInteractions.push(interaction);
    });
    if (sessionId) {
      sessionResumeCount++;
    }

    const result = await adapter.sendTurn({
      sessionId,
      rootNetworkId,
      message: resolvedTurn.content,
      mentions: resolvedTurn.mentions,
      onCard,
    });

    turns.push({
      user: resolvedTurn.content,
      assistant: result.assistantText,
      toolCalls: result.toolCalls,
      events: result.events,
      errors: result.errors,
      testerInteractions,
    });

    totalToolCalls += result.toolCalls.length;
    cardResponseCount += result.cardResponseCount;
    sessionId = result.sessionId;
  }

  const allTesterInteractions = flattenTesterInteractions(turns);
  return {
    scenarioId: scenario.id,
    sessionId,
    turns,
    totalToolCalls,
    cardResponseCount,
    sessionResumeCount,
    testerInteractions: allTesterInteractions,
    testerInteractionCount: allTesterInteractions.length,
  };
}
