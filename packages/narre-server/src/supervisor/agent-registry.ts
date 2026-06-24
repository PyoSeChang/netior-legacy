import type {
  AgentDefinition,
  NarreGlobalUserAgentDefinition,
  NarreWorldUserAgentDefinition,
  NarreSystemAgentDefinition,
  TerminalAgentDefinition,
} from '@netior/shared/types';

export const DEFAULT_USER_AGENT_ID = 'default';

export interface SupervisorAgentRegistryOptions {
  rootNetworkId?: string | null;
  worldUserAgentId?: string | null;
  globalUserAgentId?: string | null;
}

const SYSTEM_AGENTS: readonly NarreSystemAgentDefinition[] = [
  {
    id: 'network-builder',
    name: 'Network Builder',
    description: 'Builds and expands Netior instance networks.',
    kind: 'narre',
    narreAgentType: 'system',
    systemAgentType: 'network-builder',
    skills: [
      {
        id: 'network-representation-authoring',
        name: 'network-representation',
        source: 'builtin',
      },
      {
        id: 'schema-field-behavior',
        name: 'schema-field-behavior',
        source: 'builtin',
      },
      {
        id: 'interactive-view',
        name: 'interactive-view',
        source: 'builtin',
      },
      {
        id: 'bootstrap',
        name: 'bootstrap',
        source: 'builtin',
      },
    ],
    runtimeProfile: {
      provider: 'openai',
      reasoningEffort: 'high',
      toolProfileIds: ['core'],
      approvalPolicy: 'strict',
      contextScope: 'run',
    },
  },
  {
    id: 'network-finder',
    name: 'Network Finder',
    description: 'Finds relevant networks, instances, and paths.',
    kind: 'narre',
    narreAgentType: 'system',
    systemAgentType: 'network-finder',
    skills: [],
    runtimeProfile: {
      provider: 'openai',
      reasoningEffort: 'medium',
      toolProfileIds: ['discovery'],
      approvalPolicy: 'default',
      contextScope: 'run',
    },
  },
  {
    id: 'agent-operator',
    name: 'Agent Operator',
    description: 'Coordinates agent sessions and future orchestration.',
    kind: 'narre',
    narreAgentType: 'system',
    systemAgentType: 'agent-operator',
    skills: [],
    runtimeProfile: {
      provider: 'openai',
      reasoningEffort: 'high',
      toolProfileIds: ['core'],
      approvalPolicy: 'strict',
      contextScope: 'run',
    },
  },
];

const TERMINAL_AGENTS: readonly TerminalAgentDefinition[] = [
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    description: 'Terminal runtime session for Codex CLI.',
    kind: 'terminal',
    terminalAgentType: 'codex-cli',
    runtimeProfile: {
      provider: 'terminal',
      toolProfileIds: ['code-write'],
      approvalPolicy: 'strict',
      contextScope: 'task',
    },
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Terminal runtime session for Claude Code.',
    kind: 'terminal',
    terminalAgentType: 'claude-code',
    runtimeProfile: {
      provider: 'terminal',
      toolProfileIds: ['code-review'],
      approvalPolicy: 'strict',
      contextScope: 'task',
    },
  },
];

export function listSupervisorAgentDefinitions(
  options: SupervisorAgentRegistryOptions = {},
): AgentDefinition[] {
  const globalAgentId = options.globalUserAgentId?.trim() || DEFAULT_USER_AGENT_ID;
  const worldAgentId = options.worldUserAgentId?.trim() || DEFAULT_USER_AGENT_ID;
  const agents: AgentDefinition[] = [
    ...SYSTEM_AGENTS,
    createGlobalUserAgentDefinition(globalAgentId),
  ];

  if (options.rootNetworkId) {
    agents.push(createWorldUserAgentDefinition(worldAgentId, options.rootNetworkId));
  }

  agents.push(...TERMINAL_AGENTS);
  return agents.map((agent) => ({ ...agent }));
}

export function createGlobalUserAgentDefinition(agentId: string): NarreGlobalUserAgentDefinition {
  return {
    id: agentId,
    name: agentId === DEFAULT_USER_AGENT_ID ? 'Global User Agent' : agentId,
    description: 'Narre user agent shared across worlds.',
    kind: 'narre',
    narreAgentType: 'user',
    userAgentType: 'global',
    skills: [],
    runtimeProfile: {
      provider: 'openai',
      reasoningEffort: 'medium',
      toolProfileIds: ['core'],
      approvalPolicy: 'default',
      contextScope: 'run',
    },
  };
}

export function createWorldUserAgentDefinition(
  agentId: string,
  rootNetworkId: string,
): NarreWorldUserAgentDefinition {
  return {
    id: agentId,
    name: agentId === DEFAULT_USER_AGENT_ID ? 'World User Agent' : agentId,
    description: 'Narre user agent scoped to a single world.',
    kind: 'narre',
    narreAgentType: 'user',
    userAgentType: 'world',
    rootNetworkId,
    skills: [],
    runtimeProfile: {
      provider: 'openai',
      reasoningEffort: 'medium',
      toolProfileIds: ['core'],
      approvalPolicy: 'default',
      contextScope: 'run',
    },
  };
}

export function getSupervisorAgentKey(agent: AgentDefinition): string {
  if (agent.kind === 'terminal') {
    return `terminal:${agent.terminalAgentType}:${agent.id}`;
  }

  if (agent.narreAgentType === 'system') {
    return `narre:system:${agent.systemAgentType}:${agent.id}`;
  }

  if (agent.userAgentType === 'world') {
    return `narre:user:world:${agent.rootNetworkId}:${agent.id}`;
  }

  return `narre:user:global:${agent.id}`;
}
