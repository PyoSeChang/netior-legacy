import { randomUUID } from 'crypto';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type {
  AgentDefinition,
  AgentRuntimeProfile,
  NarreActorProvider,
  NarreBehaviorSettings,
  NarreCard,
  NarreMention,
  NarreToolMetadata,
  NarreToolCall,
  NarreToolBlock,
  NarreTranscriptBlock,
  NarreTranscriptTurn,
  SkillDefinition,
  SkillInvocation,
} from '@netior/shared/types';
import {
  buildSystemPrompt,
  DEFAULT_NARRE_BEHAVIOR_SETTINGS,
  type SystemPromptParams,
} from '../system-prompt.js';
import { buildWorldPromptMetadata } from '../world-prompt-metadata.js';
import { parseSkillInvocations } from '../skill-invocation-router.js';
import { SessionStore } from '../session-store.js';
import type { NarreMcpServerConfig, NarreProviderAdapter } from './provider-adapter.js';
import {
  loadUserAgentPromptDefinitions,
  type LoadedUserAgentPromptDefinition,
} from '../agent-skills/user-agent-skill-loader.js';
import { loadAvailableSkills } from '../skills/registry.js';
import type {
  NarreSkillContext,
  NarreSkillDefinition,
} from '../skills/types.js';
import type { SupervisorRegistry } from '../supervisor/supervisor-registry.js';
import { buildNarreSupervisorSessionId } from '../supervisor/supervisor-registry.js';

export interface NarreRuntimeChatRequest {
  traceId?: string;
  sessionId?: string;
  rootNetworkId: string;
  message: string;
  mentions?: NarreMention[];
  activeAgent?: AgentDefinition;
  runtimeProfile?: AgentRuntimeProfile;
  skillIds?: string[];
  currentRunId?: string | null;
  currentTaskId?: string | null;
  assignmentId?: string | null;
}

export interface NarreRuntimeEvents {
  onText: (text: string) => void | Promise<void>;
  onToolStart: (tool: string, input: Record<string, unknown>, metadata: NarreToolMetadata) => void | Promise<void>;
  onToolEnd: (tool: string, result: string, metadata: NarreToolMetadata) => void | Promise<void>;
  onCard: (card: NarreCard) => void | Promise<void>;
  onError: (error: string) => void;
}

export interface NarreRuntimeConfig {
  sessionStore: SessionStore;
  provider: NarreProviderAdapter;
  resolveMcpServerPath: () => string | null;
  resolvePromptMetadata?: (rootNetworkId: string) => Promise<SystemPromptParams>;
  resolveWorldRootDir?: (rootNetworkId: string) => Promise<string | null>;
  sharedUserDataRootDir?: string | null;
  globalUserAgentId?: string | null;
  worldUserAgentId?: string | null;
  supervisor?: SupervisorRegistry;
  behaviorSettings?: NarreBehaviorSettings;
}

export class NarreRuntime {
  constructor(private readonly config: NarreRuntimeConfig) {}

  resolveUiCall(toolCallId: string, response: unknown): boolean {
    return this.config.provider.resolveUiCall(toolCallId, response);
  }

  async steer(sessionId: string, message: string): Promise<boolean> {
    return await this.config.provider.steer?.(sessionId, message) ?? false;
  }

  async listSkills(rootNetworkId: string): Promise<SkillDefinition[]> {
    const worldRootDir = this.config.resolveWorldRootDir
      ? await this.config.resolveWorldRootDir(rootNetworkId)
      : (await (this.config.resolvePromptMetadata ?? buildWorldPromptMetadata)(rootNetworkId)).worldRootDir ?? null;
    const availableSkills = await loadAvailableSkills({
      worldRootDir,
      sharedUserDataRootDir: this.config.sharedUserDataRootDir ?? null,
      worldAgentId: this.config.worldUserAgentId ?? null,
      globalAgentId: this.config.globalUserAgentId ?? null,
    });

    return availableSkills.map(toPublicSkillDefinition);
  }

  async runChat(
    request: NarreRuntimeChatRequest,
    events: NarreRuntimeEvents,
    signal?: AbortSignal,
  ): Promise<{ sessionId: string; assistantText: string }> {
    const traceId = request.traceId ?? 'no-trace';
    const runStartedAt = Date.now();
    const isAborted = (): boolean => signal?.aborted === true;

    let activeSessionId = request.sessionId;
    if (!activeSessionId) {
      const session = await this.config.sessionStore.createSession(request.rootNetworkId, request.message.slice(0, 60));
      activeSessionId = session.id;
    }
    if (!activeSessionId) {
      throw new Error('Failed to resolve Narre session id');
    }
    const resolvedSessionId = activeSessionId;
    const sessionData = await this.config.sessionStore.getSession(resolvedSessionId, request.rootNetworkId);
    const historyTurns = sessionData?.transcript?.turns ?? [];

    const metadata = await (this.config.resolvePromptMetadata ?? buildWorldPromptMetadata)(request.rootNetworkId);
    const behaviorSettings = this.config.behaviorSettings ?? DEFAULT_NARRE_BEHAVIOR_SETTINGS;
    const loadedSkills = await loadAvailableSkills({
      worldRootDir: metadata.worldRootDir ?? null,
      sharedUserDataRootDir: this.config.sharedUserDataRootDir ?? null,
      worldAgentId: this.config.worldUserAgentId ?? null,
      globalAgentId: this.config.globalUserAgentId ?? null,
    });
    const availableSkills = filterSkillsForAgent(loadedSkills, request.activeAgent);
    const userAgentPromptDefinitions = await loadUserAgentPromptDefinitions({
      worldRootDir: metadata.worldRootDir ?? null,
      sharedUserDataRootDir: this.config.sharedUserDataRootDir ?? null,
      worldAgentId: this.config.worldUserAgentId ?? null,
      globalAgentId: this.config.globalUserAgentId ?? null,
    });
    const parsedSkillInvocations = parseSkillInvocations(request.message, availableSkills);
    const skillContext: NarreSkillContext = {
      params: metadata,
      behavior: behaviorSettings,
      rootNetworkId: request.rootNetworkId,
      historyTurns,
    };
    const selectedSkills = resolveSelectedSkills(availableSkills, parsedSkillInvocations, request.skillIds);
    const userAgentSystemPrompt = buildUserAgentSystemPrompt(userAgentPromptDefinitions);
    const selectedSkillPrompt = selectedSkills.length > 0
      ? selectedSkills.map((skill) => skill.buildPrompt(skillContext)).join('\n\n')
      : '';
    const runtimeProfile = request.runtimeProfile ?? request.activeAgent?.runtimeProfile;
    const systemPrompt = [
      buildSystemPrompt(metadata, behaviorSettings),
      buildActiveAgentSystemPrompt(request.activeAgent, runtimeProfile),
      userAgentSystemPrompt,
      selectedSkillPrompt,
    ]
      .filter((section) => section.trim().length > 0)
      .join('\n\n');
    const normalizedSkillArgs = Object.fromEntries(
      parsedSkillInvocations.map((parsed) => [
        parsed.invocation.skillId,
        (parsed.skill as NarreSkillDefinition).normalizeArgs?.(request.message, parsed.invocation)
          ?? parsed.invocation.args,
      ]),
    );
    const supervisorSessionId = buildNarreSupervisorSessionId(resolvedSessionId);
    this.config.supervisor?.registerNarreSession({
      narreSessionId: resolvedSessionId,
      rootNetworkId: request.rootNetworkId,
      agent: request.activeAgent,
      surfaceId: request.activeAgent ? `narre-agent:${request.activeAgent.id}` : undefined,
      title: sessionData?.title ?? request.message.slice(0, 60),
      status: 'working',
      skillId: selectedSkills[0]?.id ?? null,
      currentRunId: request.currentRunId ?? null,
      currentTaskId: request.currentTaskId ?? null,
      metadata: {
        provider: this.config.provider.name,
        traceId,
        ...(request.assignmentId ? { assignmentId: request.assignmentId } : {}),
        ...(runtimeProfile?.model ? { model: runtimeProfile.model } : {}),
        ...(runtimeProfile?.reasoningEffort ? { reasoningEffort: runtimeProfile.reasoningEffort } : {}),
        ...(selectedSkills.length > 0 ? { selectedSkillIds: selectedSkills.map((skill) => skill.id).join(',') } : {}),
      },
    });

    const processedMessage = this.buildPromptMessage(request.message, request.mentions);

    const userTurn = buildUserTurn(request.message, request.mentions, parsedSkillInvocations.map((parsed) => parsed.invocation), normalizedSkillArgs);
    await this.config.sessionStore.appendTurn(resolvedSessionId, request.rootNetworkId, userTurn);

    const mcpServerPath = this.config.resolveMcpServerPath();
    if (!mcpServerPath) {
      console.error(`[narre:runtime] trace=${traceId} stage=mcp.missing session=${resolvedSessionId}`);
      this.config.supervisor?.updateSessionStatus(supervisorSessionId, 'error', {
        eventType: 'session_failed',
        metadata: { error: 'missing_mcp_server' },
      });
      events.onError('Could not find netior-mcp server. Run: pnpm --filter @netior/mcp build');
      return { sessionId: resolvedSessionId, assistantText: '' };
    }

    const isResume = historyTurns.length > 1;
    const mcpServerConfigs = this.buildMcpServerConfigs(
      mcpServerPath,
      request.rootNetworkId,
      selectedSkills,
      skillContext,
      runtimeProfile,
    );
    console.log(
      `[narre:runtime] trace=${traceId} stage=run.start session=${resolvedSessionId} ` +
      `world=${request.rootNetworkId} resume=${isResume ? 'yes' : 'no'} mentions=${request.mentions?.length ?? 0}`,
    );
    for (const config of mcpServerConfigs) {
      console.log(
        `[narre:runtime] trace=${traceId} stage=mcp.config name=${config.name} command=${config.command} ` +
        `args=${JSON.stringify(config.args ?? [])} cwd=${config.cwd ?? '(default)'}`,
      );
    }
    const assistantBlocks: NarreTranscriptBlock[] = [];
    const assistantTurnId = buildTurnId();
    const assistantTurnCreatedAt = new Date().toISOString();
    let assistantTurnCompletedAt: string | null = null;
    let checkpointPromise: Promise<void> = Promise.resolve();
    let activeTextBlock: Extract<NarreTranscriptBlock, { type: 'rich_text' }> | null = null;

    const buildAssistantTurn = (): NarreTranscriptTurn => ({
      id: assistantTurnId,
      role: 'assistant',
      createdAt: assistantTurnCreatedAt,
      ...(assistantTurnCompletedAt ? { completedAt: assistantTurnCompletedAt } : {}),
      actor: {
        provider: resolveActorProvider(this.config.provider.name),
        ...(request.activeAgent ? { id: request.activeAgent.id } : {}),
        label: request.activeAgent?.name ?? this.config.provider.name,
      },
      blocks: structuredClone(assistantBlocks),
    });

    const queueAssistantCheckpoint = (): void => {
      if (assistantBlocks.length === 0) {
        return;
      }

      const snapshot = buildAssistantTurn();
      checkpointPromise = checkpointPromise
        .then(() => this.config.sessionStore.upsertTurn(resolvedSessionId, request.rootNetworkId, snapshot))
        .catch((error) => {
          console.error('[narre:runtime] failed to checkpoint assistant turn', error);
        });
    };

    const appendText = (text: string): void => {
      if (!text || isAborted()) {
        return;
      }

      if (!activeTextBlock) {
        activeTextBlock = {
          id: buildBlockId(),
          type: 'rich_text',
          text,
        };
        assistantBlocks.push(activeTextBlock);
        queueAssistantCheckpoint();
        return;
      }

      activeTextBlock.text += text;
    };

    const closeTextBlock = (): void => {
      activeTextBlock = null;
    };

    const beginTool = (tool: string, input: Record<string, unknown>): void => {
      if (isAborted()) {
        return;
      }

      const metadata = getNarreToolMetadata(tool);
      closeTextBlock();
      assistantBlocks.push({
        id: buildBlockId(),
        type: 'tool',
        toolKey: tool,
        metadata,
        input,
      });
      queueAssistantCheckpoint();
    };

    const completeTool = (tool: string, result: string): void => {
      if (isAborted()) {
        return;
      }
      closeTextBlock();
      const openTool = [...assistantBlocks]
        .reverse()
        .find((block): block is NarreToolBlock =>
          block.type === 'tool' && block.toolKey === tool && !block.output && !block.error,
        );

      if (!openTool) {
        const metadata = getNarreToolMetadata(tool);
        assistantBlocks.push({
          id: buildBlockId(),
          type: 'tool',
          toolKey: tool,
          metadata,
          input: {},
          ...(result.startsWith('Error') ? { error: result } : { output: result }),
        });
        queueAssistantCheckpoint();
        return;
      }

      if (result.startsWith('Error')) {
        openTool.error = result;
        queueAssistantCheckpoint();
        return;
      }

      openTool.output = result;
      queueAssistantCheckpoint();
    };

    const appendCard = (card: NarreCard): void => {
      if (isAborted()) {
        return;
      }
      closeTextBlock();
      assistantBlocks.push({
        id: buildBlockId(),
        type: 'card',
        card,
      });
      queueAssistantCheckpoint();
    };

    let result;
    try {
      result = await this.config.provider.run({
        traceId,
        rootNetworkId: request.rootNetworkId,
        worldRootDir: metadata.worldRootDir ?? null,
        systemPrompt,
        userPrompt: processedMessage,
        runtimeProfile,
        sessionId: resolvedSessionId,
        isResume,
        signal,
        mcpServerConfigs,
        onText: async (text) => {
          appendText(text);
          await checkpointPromise;
          if (!isAborted()) {
            await events.onText(text);
          }
        },
        onToolStart: async (tool, input) => {
          const metadata = getNarreToolMetadata(tool);
          beginTool(tool, input);
          await checkpointPromise;
          if (!isAborted()) {
            await events.onToolStart(tool, input, metadata);
          }
        },
        onToolEnd: async (tool, resultText) => {
          const metadata = getNarreToolMetadata(tool);
          completeTool(tool, resultText);
          await checkpointPromise;
          if (!isAborted()) {
            await events.onToolEnd(tool, resultText, metadata);
          }
        },
        onCard: async (card) => {
          appendCard(card);
          await checkpointPromise;
          if (!isAborted()) {
            await events.onCard(card);
          }
        },
      });
    } catch (error) {
      if (!isAborted()) {
        this.config.supervisor?.updateSessionStatus(supervisorSessionId, 'error', {
          eventType: 'session_failed',
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }

      await checkpointPromise;

      if (assistantBlocks.length === 0) {
        await this.config.sessionStore.removeTurn(resolvedSessionId, request.rootNetworkId, userTurn.id);
        this.config.supervisor?.updateSessionStatus(supervisorSessionId, 'idle', {
          eventType: 'session_completed',
          metadata: { aborted: 'true' },
        });
        return { sessionId: resolvedSessionId, assistantText: '' };
      }

      assistantTurnCompletedAt = new Date().toISOString();
      await this.config.sessionStore.upsertTurn(resolvedSessionId, request.rootNetworkId, buildAssistantTurn());
      this.config.supervisor?.updateSessionStatus(supervisorSessionId, 'idle', {
        eventType: 'session_completed',
        metadata: { aborted: 'true' },
      });
      return { sessionId: resolvedSessionId, assistantText: assistantBlocksToText(assistantBlocks) };
    }

    if (isAborted()) {
      if (assistantBlocks.length === 0) {
        await this.config.sessionStore.removeTurn(resolvedSessionId, request.rootNetworkId, userTurn.id);
        this.config.supervisor?.updateSessionStatus(supervisorSessionId, 'idle', {
          eventType: 'session_completed',
          metadata: { aborted: 'true' },
        });
        return { sessionId: resolvedSessionId, assistantText: '' };
      }
    } else if (assistantBlocks.length === 0) {
      if (result.assistantText) {
        appendText(result.assistantText);
      }

      for (const toolCall of result.toolCalls) {
        assistantBlocks.push(toolCallToBlock(toolCall));
      }
    }

    await checkpointPromise;

    if (assistantBlocks.length > 0) {
      assistantTurnCompletedAt = new Date().toISOString();
      await this.config.sessionStore.upsertTurn(resolvedSessionId, request.rootNetworkId, buildAssistantTurn());
    }

    console.log(
      `[narre:runtime] trace=${traceId} stage=run.completed session=${resolvedSessionId} ` +
      `assistantChars=${result.assistantText.length} tools=${result.toolCalls.length} ` +
      `elapsedMs=${Date.now() - runStartedAt}`,
    );
    this.config.supervisor?.updateSessionStatus(supervisorSessionId, 'idle', {
      eventType: 'session_completed',
      metadata: {
        assistantChars: String(result.assistantText.length),
        toolCalls: String(result.toolCalls.length),
        elapsedMs: String(Date.now() - runStartedAt),
      },
    });

    return { sessionId: resolvedSessionId, assistantText: assistantBlocksToText(assistantBlocks) };
  }

  private buildMcpServerConfigs(
    mcpServerPath: string,
    rootNetworkId: string,
    selectedSkills: readonly NarreSkillDefinition[],
    skillContext: NarreSkillContext,
    runtimeProfile?: AgentRuntimeProfile,
  ): NarreMcpServerConfig[] {
    const runningInsideElectronNode = Boolean(process.versions.electron) || process.env.ELECTRON_RUN_AS_NODE === '1';
    const mcpCommand = process.execPath;
    const baseEnv: Record<string, string> = {
      NETIOR_SERVICE_URL: process.env.NETIOR_SERVICE_URL ?? `http://127.0.0.1:${process.env.NETIOR_SERVICE_PORT ?? '3201'}`,
      NETIOR_MCP_DEFAULT_WORLD_ID: rootNetworkId,
    };

    if (runningInsideElectronNode) {
      baseEnv.ELECTRON_RUN_AS_NODE = '1';
    }

    const skillProfiles = [
      ...selectedSkills.flatMap((skill) =>
        skill.resolveToolProfiles?.(skillContext) ?? skill.additionalToolProfiles ?? [],
      ),
    ];
    const profiles = Array.from(new Set([
      ...(runtimeProfile?.toolProfileIds ?? []),
      ...skillProfiles,
    ]));

    return profiles.map((profile) => ({
      name: profile === 'core' ? 'netior-core' : `netior-${profile}`,
      command: mcpCommand,
      args: [mcpServerPath],
      env: {
        ...baseEnv,
        NETIOR_MCP_TOOL_PROFILE: profile,
      },
      required: true,
    }));
  }

  private buildPromptMessage(message: string, mentions?: NarreMention[]): string {
    let processedMessage = message;

    if (!mentions || mentions.length === 0) {
      return processedMessage;
    }

    for (const mention of mentions) {
      const tag = buildMentionTag(mention);
      if (mention.display && processedMessage.includes(mention.display)) {
        processedMessage = processedMessage.replace(mention.display, tag);
      } else {
        processedMessage += `\n${tag}`;
      }
    }

    return processedMessage;
  }
}

function toPublicSkillDefinition(skill: NarreSkillDefinition): SkillDefinition {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    source: skill.source,
    ...(skill.trigger ? { trigger: skill.trigger } : {}),
    ...(skill.args ? { args: skill.args } : {}),
    ...(skill.hint ? { hint: skill.hint } : {}),
    ...(skill.requiredMentionTypes ? { requiredMentionTypes: skill.requiredMentionTypes } : {}),
  };
}

function filterSkillsForAgent(
  skills: readonly NarreSkillDefinition[],
  agent: AgentDefinition | undefined,
): NarreSkillDefinition[] {
  if (!agent) {
    return [];
  }
  const agentSkills = 'skills' in agent ? agent.skills : [];
  if (agentSkills.length === 0) {
    return [];
  }

  const allowedSkillIds = new Set(agentSkills.map((skill) => skill.id));
  return skills.filter((skill) => allowedSkillIds.has(skill.id));
}

function resolveSelectedSkills(
  allowedSkills: readonly NarreSkillDefinition[],
  parsedSkillInvocations: readonly { skill: SkillDefinition }[],
  requestedSkillIds: readonly string[] = [],
): NarreSkillDefinition[] {
  const allowedSkillById = new Map(allowedSkills.map((skill) => [skill.id, skill]));
  const selectedSkillIds = [
    ...parsedSkillInvocations.map((parsed) => parsed.skill.id),
    ...requestedSkillIds,
  ].filter((skillId, index, values) =>
    allowedSkillById.has(skillId)
    && values.indexOf(skillId) === index,
  );

  return selectedSkillIds
    .map((skillId) => allowedSkillById.get(skillId) ?? null)
    .filter((skill): skill is NarreSkillDefinition => Boolean(skill));
}

function buildTurnId(): string {
  return `turn-${randomUUID()}`;
}

function buildBlockId(): string {
  return `block-${randomUUID()}`;
}

function resolveActorProvider(name: string): NarreActorProvider {
  switch (name) {
    case 'claude':
    case 'openai':
    case 'codex':
    case 'narre':
      return name;
    default:
      return 'custom';
  }
}

function buildActiveAgentSystemPrompt(
  agent: AgentDefinition | undefined,
  runtimeProfile: AgentRuntimeProfile | undefined,
): string {
  if (!agent) {
    return '';
  }

  const lines = [
    '## Active Agent Identity',
    '',
    `agent_id=${agent.id}`,
    `agent_name=${agent.name}`,
    `agent_kind=${agent.kind}`,
  ];

  if (agent.description) {
    lines.push(`description=${agent.description}`);
  }

  if (agent.kind === 'narre') {
    lines.push(`narre_agent_type=${agent.narreAgentType}`);
    if (agent.narreAgentType === 'system') {
      lines.push(`system_agent_type=${agent.systemAgentType}`);
      lines.push(...getSystemAgentInstructionLines(agent.systemAgentType));
    } else {
      lines.push(`user_agent_type=${agent.userAgentType}`);
      if (agent.userAgentType === 'world') {
        lines.push(`agent_root_network_id=${agent.rootNetworkId}`);
      }
    }
  } else {
    lines.push(`terminal_agent_type=${agent.terminalAgentType}`);
  }

    if (runtimeProfile) {
      lines.push(
        '',
        '### Runtime Profile',
        `provider=${runtimeProfile.provider}`,
    );
    if (runtimeProfile.model) {
      lines.push(`model=${runtimeProfile.model}`);
    }
    if (runtimeProfile.reasoningEffort) {
      lines.push(`reasoning_effort=${runtimeProfile.reasoningEffort}`);
    }
    if (runtimeProfile.toolProfileIds?.length) {
      lines.push(`tool_profiles=${runtimeProfile.toolProfileIds.join(',')}`);
    }
    if (runtimeProfile.approvalPolicy) {
      lines.push(`approval_policy=${runtimeProfile.approvalPolicy}`);
    }
    if (runtimeProfile.contextScope) {
      lines.push(`context_scope=${runtimeProfile.contextScope}`);
    }
    if (typeof runtimeProfile.temperature === 'number') {
      lines.push(`temperature=${runtimeProfile.temperature}`);
    }
    if (typeof runtimeProfile.contextBudget === 'number') {
      lines.push(`context_budget=${runtimeProfile.contextBudget}`);
    }
    if (runtimeProfile.extraInstruction?.trim()) {
      lines.push('', '### Runtime Session Instructions', runtimeProfile.extraInstruction.trim());
    }
  }

  if (agent.systemPrompt?.trim()) {
    lines.push('', '### Agent Instructions', agent.systemPrompt.trim());
  }

  return lines.join('\n').trim();
}

function getSystemAgentInstructionLines(systemAgentType: string): string[] {
  switch (systemAgentType) {
    case 'network-finder':
      return [
        '',
        '### System Agent Responsibility',
        'You are Network Finder. Your primary job is discovery, lookup, comparison, and context gathering inside the current Netior world.',
        'Prefer read-only inspection. Do not create or mutate instances, meanings, relation types, edges, files, or layouts unless a later assignment explicitly grants that responsibility.',
        'Return concise findings and handoff-ready references for the next agent.',
      ];
    case 'network-builder':
      return [
        '',
        '### System Agent Responsibility',
        'You are Network Builder. Your primary job is turning accepted findings and user intent into concrete Netior network structure.',
        'Do not define the user domain yourself. Use user-supplied domain meaning and accepted findings; ask or mark an assumption when domain meaning is missing.',
        'When the request changes how a network represents work, choose or create the network type first, then design node types and edge types from fixed representation primitives before placing nodes or edges.',
        'Do not put node card display, ports, routing, or edge presentation into schemas. Schemas meaning what exists; network representation grammar meanings how it appears on a work surface.',
        'You may propose or perform structure-changing work when the available tool profile and approval policy allow it.',
        'Keep outputs handoff-ready: describe created or proposed network types, node types, edge types, instances, meanings, and unresolved questions.',
      ];
    case 'agent-operator':
      return [
        '',
        '### System Agent Responsibility',
        'You are Agent Operator. Your primary job is planning, routing, handoff, status synthesis, and final aggregation across agents.',
        'Do not pretend to be another agent. Assign work, summarize results, surface blockers, and request approval when needed.',
      ];
    default:
      return [];
  }
}

function assistantBlocksToText(blocks: readonly NarreTranscriptBlock[]): string {
  return blocks
    .filter((block): block is Extract<NarreTranscriptBlock, { type: 'rich_text' }> => block.type === 'rich_text')
    .map((block) => block.text)
    .join('\n\n')
    .trim();
}

function buildUserTurn(
  message: string,
  mentions: NarreMention[] | undefined,
  skillInvocations: readonly SkillInvocation[],
  skillArgsById: Record<string, Record<string, string>> = {},
): NarreTranscriptTurn {
  const blocks: NarreTranscriptBlock[] = [];

  if (skillInvocations.length > 0) {
    for (const skillInvocation of skillInvocations) {
      const args = skillArgsById[skillInvocation.skillId] ?? skillInvocation.args;
      const skillName = skillInvocation.trigger?.type === 'slash'
        ? skillInvocation.trigger.name
        : skillInvocation.skillId;

      blocks.push({
        id: buildBlockId(),
        type: 'skill',
        skillId: skillInvocation.skillId,
        name: skillName,
        label: skillInvocation.trigger?.type === 'slash' ? `/${skillInvocation.trigger.name}` : skillName,
        ...(Object.keys(args).length > 0 ? { args } : {}),
        ...(mentions && mentions.length > 0 ? { refs: mentions } : {}),
      });
    }

    const contentWithoutSkillLines = stripLeadingSkillInvocationLines(message);
    if (contentWithoutSkillLines) {
      blocks.push({
        id: buildBlockId(),
        type: 'rich_text',
        text: contentWithoutSkillLines,
      });
    }
  } else {
    blocks.push({
      id: buildBlockId(),
      type: 'rich_text',
      text: message,
      ...(mentions && mentions.length > 0 ? { mentions } : {}),
    });
  }

  return {
    id: buildTurnId(),
    role: 'user',
    createdAt: new Date().toISOString(),
    blocks,
  };
}

function stripLeadingSkillInvocationLines(message: string): string {
  const lines = message.trim().split(/\r?\n/);
  while (lines[0]?.trim().startsWith('/')) {
    lines.shift();
  }

  return lines.join('\n').trim();
}

function toolCallToBlock(toolCall: NarreToolCall): NarreToolBlock {
  return {
    id: buildBlockId(),
    type: 'tool',
    toolKey: toolCall.tool,
    ...(toolCall.metadata ? { metadata: toolCall.metadata } : {}),
    input: toolCall.input,
    ...(toolCall.result ? { output: toolCall.result } : {}),
    ...(toolCall.error ? { error: toolCall.error } : {}),
  };
}

function buildMentionTag(mention: NarreMention): string {
  const mentionType = mention.type as string;

  if (mentionType === 'instance') {
    return `[instance:id=${mention.id}, title="${mention.display}"]`;
  }
  if (mentionType === 'network' || mentionType === 'canvas') {
    return `[${mentionType}:id=${mention.id}, name="${mention.display}"]`;
  }
  if (mentionType === 'edge') {
    return `[edge:id=${mention.id}]`;
  }
  if (mentionType === 'meaning') {
    return `[meaning:id=${mention.id}, name="${mention.display}"]`;
  }
  if (mentionType === 'relationType' || mentionType === 'canvasType') {
    return `[${mentionType}:id=${mention.id}, name="${mention.display}"]`;
  }
  if (mentionType === 'module') {
    return `[module:path="${mention.path}"]`;
  }
  if (mentionType === 'file') {
    return `[file:path="${mention.path}"]`;
  }
  if (mentionType === 'agent') {
    return `[agent:key=${mention.id}, name="${mention.display}"]`;
  }

  return mention.display;
}

function buildUserAgentSystemPrompt(definitions: readonly LoadedUserAgentPromptDefinition[]): string {
  if (definitions.length === 0) {
    return '';
  }

  return [
    '## User Agent System Prompts',
    '',
    ...definitions.flatMap((definition) => [
      `### ${definition.name}`,
      `agent_scope=${definition.scope}`,
      `agent_id=${definition.agentId}`,
      ...(definition.description ? [`description=${definition.description}`] : []),
      '',
      definition.systemPrompt,
      '',
    ]),
  ]
    .join('\n')
    .trim();
}
