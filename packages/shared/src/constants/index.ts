import type {
  AssignmentStatus,
  CanvasSubjectType,
  EvidenceSupportType,
  EvidenceTargetType,
  EvidenceType,
  IconType,
  PropertyCardinality,
  PropertyValueType,
  RequiredPolicy,
  ResourceObservedStatus,
  ResourceSourceKind,
  SkillDefinition,
  SourceKind,
  ViewType,
  WorldNodeType,
} from '../types/index.js';

export * from './netior-mcp-tools.js';

export const AGENT_SKILL_STORAGE = {
  WORLD_CONFIG_DIR: '.netior',
  AGENTS_DIR: 'agents',
  AGENT_FILE_NAME: 'agent.json',
  SKILLS_DIR: 'skills',
  SKILL_FILE_NAME: 'SKILL.md',
  FORMAT: 'skill-md-directory',
} as const;

export const BUILT_IN_SKILLS: readonly SkillDefinition[] = [
  {
    id: 'bootstrap',
    name: 'bootstrap',
    description: 'narre.command.bootstrap',
    source: 'builtin',
    trigger: { type: 'slash', name: 'bootstrap' },
    hint: 'narre.command.bootstrapHint',
  },
  {
    id: 'index',
    name: 'index',
    description: 'narre.command.index',
    source: 'builtin',
    trigger: { type: 'slash', name: 'index' },
    hint: 'narre.command.indexHint',
    args: [
      {
        name: 'startPage',
        description: 'pdfToc.startPage',
        required: true,
        type: 'number',
      },
      {
        name: 'endPage',
        description: 'pdfToc.endPage',
        required: true,
        type: 'number',
      },
      {
        name: 'overviewPages',
        description: 'pdfToc.overviewPages',
        required: false,
        type: 'number_list',
      },
    ],
    requiredMentionTypes: ['file'],
  },
] as const;

export const SLASH_TRIGGER_SKILLS = BUILT_IN_SKILLS.filter(
  (skill) => skill.trigger?.type === 'slash',
);

export function findSkillBySlashTrigger(triggerName: string): SkillDefinition | null {
  const normalized = triggerName.toLowerCase();
  return SLASH_TRIGGER_SKILLS.find((skill) => skill.trigger?.name === normalized) ?? null;
}

export const DEFAULTS = {
  WINDOW_WIDTH: 1200,
  WINDOW_HEIGHT: 800,
} as const;

export const IPC_CHANNELS = {
  TERMINAL_CREATE_INSTANCE: 'terminal:createInstance',
  TERMINAL_GET_SESSION: 'terminal:getSession',
  TERMINAL_ATTACH: 'terminal:attach',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_SHUTDOWN: 'terminal:shutdown',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_READY: 'terminal:ready',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_TITLE_CHANGED: 'terminal:titleChanged',
  TERMINAL_STATE_CHANGED: 'terminal:stateChanged',

  AGENT_LIST_DEFINITIONS: 'agent:listDefinitions',
  AGENT_UPSERT_DEFINITION: 'agent:upsertDefinition',
  AGENT_DELETE_DEFINITION: 'agent:deleteDefinition',
  AGENT_UPSERT_SKILL: 'agent:upsertSkill',
  AGENT_DELETE_SKILL: 'agent:deleteSkill',
  AGENT_SESSION_EVENT: 'agent:sessionEvent',
  AGENT_STATUS_EVENT: 'agent:statusEvent',
  AGENT_NAME_CHANGED: 'agent:nameChanged',
  AGENT_TURN_EVENT: 'agent:turnEvent',
  CLAUDE_SESSION_EVENT: 'claude:sessionEvent',
  CLAUDE_STATUS_EVENT: 'claude:statusEvent',
  CLAUDE_NAME_CHANGED: 'claude:nameChanged',

  NARRE_STREAM_EVENT: 'narre:streamEvent',
  NARRE_LIST_SESSIONS: 'narre:listSessions',
  NARRE_LIST_SKILLS: 'narre:listSkills',
  NARRE_SUPERVISOR_LIST_AGENTS: 'narre:supervisorListAgents',
  NARRE_SUPERVISOR_LIST_SKILLS: 'narre:supervisorListSkills',
  NARRE_SUPERVISOR_LIST_SESSIONS: 'narre:supervisorListSessions',
  NARRE_SUPERVISOR_LIST_EVENTS: 'narre:supervisorListEvents',
  NARRE_SUPERVISOR_LIST_RUNS: 'narre:supervisorListRuns',
  NARRE_SUPERVISOR_CREATE_RUN: 'narre:supervisorCreateRun',
  NARRE_SUPERVISOR_GET_RUN: 'narre:supervisorGetRun',
  NARRE_SUPERVISOR_PLAN_RUN: 'narre:supervisorPlanRun',
  NARRE_SUPERVISOR_RUN_RUN: 'narre:supervisorRunRun',
  NARRE_SUPERVISOR_CANCEL_RUN: 'narre:supervisorCancelRun',
  NARRE_SUPERVISOR_LIST_APPROVALS: 'narre:supervisorListApprovals',
  NARRE_SUPERVISOR_RESOLVE_APPROVAL: 'narre:supervisorResolveApproval',
  NARRE_CREATE_SESSION: 'narre:createSession',
  NARRE_GET_SESSION: 'narre:getSession',
  NARRE_UPDATE_SESSION_TITLE: 'narre:updateSessionTitle',
  NARRE_DELETE_SESSION: 'narre:deleteSession',
  NARRE_GET_API_KEY_STATUS: 'narre:getApiKeyStatus',
  NARRE_SET_API_KEY: 'narre:setApiKey',
  NARRE_LIST_RUNTIME_MODELS: 'narre:listRuntimeModels',
  NARRE_SEARCH_MENTIONS: 'narre:searchMentions',
  NARRE_SEND_MESSAGE: 'narre:sendMessage',
  NARRE_INTERRUPT_MESSAGE: 'narre:interruptMessage',
  NARRE_STEER_MESSAGE: 'narre:steerMessage',
  NARRE_RESPOND_CARD: 'narre:respondCard',
} as const;

export const WORLD_NODE_TYPES: readonly WorldNodeType[] = ['world', 'model'];
export const SOURCE_KINDS: readonly SourceKind[] = ['system', 'user', 'package', 'imported'];
export const ICON_TYPES: readonly IconType[] = ['lucide', 'image', 'none'];
export const PROPERTY_VALUE_TYPES: readonly PropertyValueType[] = [
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'resource-ref',
  'option',
];
export const PROPERTY_CARDINALITIES: readonly PropertyCardinality[] = ['single', 'multiple'];
export const REQUIRED_POLICIES: readonly RequiredPolicy[] = ['optional', 'required', 'recommended'];
export const ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  'candidate',
  'accepted',
  'rejected',
  'superseded',
  'archived',
];
export const RESOURCE_SOURCE_KINDS: readonly ResourceSourceKind[] = [
  'file',
  'folder',
  'url',
  'service-object',
  'sub-resource',
  'inline',
];
export const RESOURCE_OBSERVED_STATUSES: readonly ResourceObservedStatus[] = [
  'observed',
  'changed',
  'missing',
  'ignored',
  'archived',
];
export const EVIDENCE_TYPES: readonly EvidenceType[] = [
  'resource_locator',
  'user_input',
  'user_decision',
  'ai_reasoning',
  'calculation',
  'external_sync',
];
export const EVIDENCE_TARGET_TYPES: readonly EvidenceTargetType[] = [
  'kind_assignment',
  'property_value',
  'relation_assertion',
];
export const EVIDENCE_SUPPORT_TYPES: readonly EvidenceSupportType[] = [
  'supports',
  'contradicts',
  'explains',
  'source',
];
export const VIEW_TYPES: readonly ViewType[] = ['explorer', 'canvas'];
export const CANVAS_SUBJECT_TYPES: readonly CanvasSubjectType[] = [
  'world',
  'model',
  'kind',
  'property',
  'relation_kind',
  'instance',
  'resource',
  'kind_assignment',
  'relation_assertion',
  'resource_mapping',
  'note',
];

export function getKindDisplayKey(kindKey: string): string {
  return `domain.kind.${kindKey}`;
}

export function getRelationKindDisplayKey(relationKindKey: string): string {
  return `domain.relationKind.${relationKindKey}`;
}
