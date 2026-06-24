import type { AgentDefinition } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';

type Translate = (key: TranslationKey) => string;

function translateOrFallback(t: Translate, key: string, fallback: string): string {
  const translated = t(key as TranslationKey);
  return translated === key ? fallback : translated;
}

export function getLocalizedAgentName(agent: AgentDefinition | undefined, t: Translate, fallback = ''): string {
  if (!agent) return fallback;
  if (agent.kind === 'narre' && agent.narreAgentType === 'system') {
    return translateOrFallback(t, `narre.systemAgents.${agent.systemAgentType}.name`, agent.name);
  }
  return agent.name;
}

export function getLocalizedAgentDescription(agent: AgentDefinition | undefined, t: Translate): string {
  if (!agent) return '';
  if (agent.kind === 'narre' && agent.narreAgentType === 'system') {
    return translateOrFallback(t, `narre.systemAgents.${agent.systemAgentType}.description`, agent.description ?? '');
  }
  return agent.description ?? '';
}

export function getLocalizedAgentScope(agent: AgentDefinition, t: Translate): string {
  if (agent.kind === 'terminal') {
    return agent.terminalAgentType === 'codex-cli' ? 'Codex CLI' : 'Claude Code';
  }
  if (agent.narreAgentType === 'system') {
    return translateOrFallback(t, 'narre.agentScopes.system', 'System');
  }
  return agent.userAgentType === 'world'
    ? translateOrFallback(t, 'narre.agentScopes.world', 'World')
    : translateOrFallback(t, 'narre.agentScopes.global', 'Global');
}

export function getLocalizedAgentRole(agent: AgentDefinition | undefined, t: Translate): string {
  if (!agent) return '';
  const description = getLocalizedAgentDescription(agent, t);
  if (description) return description;
  if (agent.kind === 'terminal') return getLocalizedAgentScope(agent, t);
  if (agent.narreAgentType === 'system') {
    return translateOrFallback(t, 'narre.agentScopes.systemAgent', 'System agent');
  }
  return agent.userAgentType === 'world'
    ? translateOrFallback(t, 'narre.agentScopes.worldAgent', 'World agent')
    : translateOrFallback(t, 'narre.agentScopes.globalAgent', 'Global agent');
}
