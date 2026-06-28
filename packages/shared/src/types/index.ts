import type {
  ArchiveStatus,
  AssignmentStatus,
  CanvasSubjectType,
  DecisionType,
  DomainSnapshot,
  EvidenceSupportType,
  EvidenceTargetType,
  EvidenceType,
  IconType,
  InstanceRecord,
  ModelRecord,
  NetiorRpcMethod,
  PropertyCardinality,
  PropertyValueType,
  RequiredPolicy,
  ResourceObservedStatus,
  ResourceSourceKind,
  SourceKind,
  ViewRecord,
  ViewType,
  WorldNodeRecord,
  WorldRecord,
} from '../domain.js';

export type {
  ArchiveStatus,
  AssignmentStatus,
  CanvasActionHandler,
  CanvasActionParamBinding,
  CanvasEdgeTypeRecord,
  CanvasInteractionBehavior,
  CanvasInteractionBinding,
  CanvasMode,
  CanvasNodeAction,
  CanvasNodeEvent,
  CanvasNodeTypeRecord,
  CanvasSubjectType,
  DecisionRecord,
  DecisionType,
  DomainEventRecord,
  DomainSnapshot,
  EvidenceLinkRecord,
  EvidenceRecord,
  EvidenceSupportType,
  EvidenceTargetType,
  EvidenceType,
  IconFields,
  IconType,
  InstanceRecord,
  InstanceResourceLinkRecord,
  JsonRpcErrorObject,
  JsonRpcFailure,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccess,
  KindAssignmentRecord,
  KindRecord,
  ModelDirectoryBindingRecord,
  ModelRecord,
  NetiorRpcMethod,
  NetiorServiceEvent,
  PropertyCardinality,
  PropertyRecord,
  PropertyValueRecord,
  PropertyValueType,
  RelationAssertionRecord,
  RelationKindRecord,
  RequiredPolicy,
  ResourceObservedStatus,
  ResourceRecord,
  ResourceSourceKind,
  SourceFields,
  SourceKind,
  ViewItemKind,
  ViewItemRecord,
  ViewItemSubjectType,
  ViewRecord,
  ViewType,
  WorldNodeRecord,
  WorldNodeType,
  WorldRecord,
} from '../domain.js';

export type EntityId = string;
export type JsonObject = Record<string, unknown>;

export type World = WorldRecord;
export type Model = ModelRecord;
export type Instance = InstanceRecord;
export type View = ViewRecord;

export interface WorldCreate {
  key?: string;
  name: string;
  root_uri: string;
  description?: string | null;
}

export interface WorldUpdate {
  name?: string;
  description?: string | null;
  root_uri?: string;
}

export interface ModelCreate {
  parent_id: string;
  key?: string;
  name: string;
  description?: string | null;
}

export interface ModelUpdate {
  parent_id?: string;
  name?: string;
  description?: string | null;
  sort_order?: number;
}

export interface KindCreate {
  model_id: string;
  key: string;
  name: string;
  description?: string | null;
  icon_type?: IconType;
  icon_key?: string | null;
  icon_resource_id?: string | null;
  source_kind?: SourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface PropertyCreate {
  kind_id: string;
  key: string;
  name: string;
  description?: string | null;
  value_type: PropertyValueType;
  cardinality?: PropertyCardinality;
  required_policy?: RequiredPolicy;
  sort_order?: number;
}

export interface RelationKindCreate {
  model_id: string;
  key: string;
  name: string;
  description?: string | null;
  directed?: boolean;
  subject_kind_policy?: string | null;
  object_kind_policy?: string | null;
  cardinality_policy?: string | null;
  icon_type?: IconType;
  icon_key?: string | null;
  icon_resource_id?: string | null;
  source_kind?: SourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface InstanceCreate {
  home_model_id: string;
  key?: string;
  display_name: string;
  icon_type?: IconType;
  icon_key?: string | null;
  icon_resource_id?: string | null;
}

export interface InstanceUpdate {
  home_model_id?: string;
  key?: string;
  display_name?: string;
  icon_type?: IconType;
  icon_key?: string | null;
  icon_resource_id?: string | null;
  status?: ArchiveStatus;
}

export interface ResourceCreate {
  root_id: string;
  source_kind: ResourceSourceKind;
  source_uri?: string | null;
  relative_path?: string | null;
  parent_resource_id?: string | null;
  locator?: string | null;
  handler_key?: string | null;
  fingerprint?: string | null;
  observed_status?: ResourceObservedStatus;
}

export interface KindAssignmentCreate {
  instance_id: string;
  kind_id: string;
  status?: AssignmentStatus;
  created_by?: string | null;
}

export interface PropertyValueCreate {
  instance_id: string;
  property_id: string;
  value_json?: string | null;
  status?: AssignmentStatus;
  created_by?: string | null;
}

export interface RelationCreate {
  subject_instance_id: string;
  relation_kind_id: string;
  object_instance_id: string;
  status?: AssignmentStatus;
  created_by?: string | null;
}

export interface EvidenceCreate {
  evidence_type: EvidenceType;
  resource_id?: string | null;
  locator?: string | null;
  summary?: string | null;
  created_by?: string | null;
}

export interface EvidenceLinkCreate {
  evidence_id: string;
  target_type: EvidenceTargetType;
  target_id: string;
  support_type?: EvidenceSupportType;
}

export interface DecisionCreate {
  target_type: EvidenceTargetType;
  target_id: string;
  decision_type: DecisionType;
  decided_status: AssignmentStatus;
  reason?: string | null;
  created_by?: string | null;
}

export interface ViewCreate {
  owner_model_id: string;
  type: ViewType;
  name: string;
  description?: string | null;
  config_json?: string | null;
  source_kind?: SourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface DomainMutationResult<TRecord = unknown> {
  record: TRecord;
  eventId?: string;
  revision?: number;
}

export interface DomainQueryResult<TRecord = unknown> {
  data: TRecord;
  snapshot?: DomainSnapshot;
}

export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface NetiorServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  hasChildren?: boolean;
  children?: FileTreeNode[];
}

export interface PdfTocEntry {
  id: string;
  title: string;
  destPage: number;
  level: number;
}

export interface PdfToc {
  entries: PdfTocEntry[];
  pageCount: number;
  analyzedAt: string;
  sourceMethod: 'text' | 'vision';
}

export type EditorTabType =
  | 'world'
  | 'model'
  | 'kind'
  | 'property'
  | 'relationKind'
  | 'instance'
  | 'resource'
  | 'view'
  | 'file'
  | 'terminal'
  | 'browser'
  | 'agent'
  | 'narre';

export type EditorViewMode = 'details' | 'source' | 'preview';

export interface EditorTab {
  id: string;
  type: EditorTabType;
  title: string;
  entityId?: string;
  path?: string;
  rootId?: string;
  modelId?: string;
  viewMode?: EditorViewMode;
  metadata?: Record<string, string>;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitLeaf {
  id: string;
  type: 'leaf';
  tabIds: string[];
  activeTabId: string | null;
}

export interface SplitBranch {
  id: string;
  type: 'branch';
  direction: SplitDirection;
  children: SplitNode[];
  sizes: number[];
}

export type SplitNode = SplitLeaf | SplitBranch;

export type SkillId = string;
export type SkillSource = 'builtin' | 'file';
export type BuiltInSkillId = 'bootstrap' | 'index';
export type SkillArgType = 'string' | 'enum' | 'number' | 'number_list';

export interface SkillArg {
  name: string;
  description: string;
  required: boolean;
  type: SkillArgType;
  options?: string[];
}

export interface SkillSlashTrigger {
  type: 'slash';
  name: string;
}

export type SkillTrigger = SkillSlashTrigger;

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  source: SkillSource;
  trigger?: SkillTrigger;
  args?: SkillArg[];
  hint?: string;
  requiredMentionTypes?: NarreMention['type'][];
  instructions?: string;
}

export interface SkillInvocation {
  skillId: SkillId;
  trigger?: SkillTrigger;
  args: Record<string, string>;
}

export type NarreMentionType =
  | 'world'
  | 'model'
  | 'kind'
  | 'property'
  | 'relationKind'
  | 'instance'
  | 'resource'
  | 'view'
  | 'file'
  | 'agent';

export interface NarreMention {
  type: NarreMentionType;
  id?: string;
  label?: string;
  path?: string;
}

export type NarreToolCategory =
  | 'world'
  | 'model'
  | 'definition'
  | 'instance'
  | 'resource'
  | 'relation'
  | 'evidence'
  | 'decision'
  | 'event'
  | 'view'
  | 'files'
  | 'search'
  | 'agent'
  | 'analysis';

export type NarreToolKind = 'query' | 'mutation' | 'analysis';
export type NarreToolApprovalMode = 'auto' | 'prompt';
export type NetiorMcpToolProfile =
  | 'core'
  | 'discovery'
  | 'bootstrap-skill'
  | 'bootstrap-interview'
  | 'bootstrap-execution'
  | 'index-skill';
export type NetiorMcpToolScope = 'app' | 'world' | 'model' | 'object' | 'resource' | 'file' | 'mixed';

export interface NetiorMcpToolSpec {
  key: string;
  displayName?: string;
  description: string;
  category: NarreToolCategory;
  kind: NarreToolKind;
  isMutation: boolean;
  approvalMode: NarreToolApprovalMode;
  profiles?: readonly NetiorMcpToolProfile[];
  scope: NetiorMcpToolScope;
  defaultWorldBinding?: boolean;
}

export interface NarreToolMetadata {
  displayName: string;
  description?: string;
  category: NarreToolCategory;
  kind: NarreToolKind;
  isMutation: boolean;
  approvalMode: NarreToolApprovalMode;
  profiles?: readonly NetiorMcpToolProfile[];
  scope: NetiorMcpToolScope;
  defaultWorldBinding?: boolean;
}

export interface NarreToolCall {
  id?: string;
  name?: string;
  tool?: string;
  input: Record<string, unknown>;
  metadata?: NarreToolMetadata;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'success' | 'error';
  result?: string;
  error?: string;
}

export type NarreRole = 'user' | 'assistant' | 'system';
export type NarreActor = 'user' | 'narre' | 'agent';

export interface NarreMessage {
  id?: string;
  role: NarreRole;
  content: string;
  createdAt?: string;
  timestamp?: string;
  toolCalls?: NarreToolCall[];
  tool_calls?: NarreToolCall[];
  mentions?: NarreMention[];
  card?: NarreCard;
}

export interface NarreSession {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  last_message_at?: string;
  message_count?: number;
  agentKey?: string | null;
}

export interface NarreSessionFileV1 {
  messages: NarreMessage[];
}

export interface NarreSessionFileV2 {
  version: 2;
  transcript: NarreTranscript;
}

export interface NarreRichTextBlock {
  id: string;
  type: 'rich_text';
  text: string;
  mentions?: NarreMention[];
}

export interface NarreSkillInvocationBlock {
  id: string;
  type: 'skill';
  skillId: string;
  name: string;
  label: string;
  args?: Record<string, string>;
  refs?: NarreMention[];
}

export interface NarreDraftBlock {
  id: string;
  type: 'draft';
  format: 'markdown';
  content: string;
}

export interface NarreToolBlock {
  id: string;
  type: 'tool';
  toolKey: string;
  displayName?: string;
  metadata?: NarreToolMetadata;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
}

export interface NarreCardBlock {
  id: string;
  type: 'card';
  card: NarreCard;
}

export type NarreTranscriptBlock =
  | NarreRichTextBlock
  | NarreSkillInvocationBlock
  | NarreDraftBlock
  | NarreToolBlock
  | NarreCardBlock;

export interface NarreTranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  createdAt: string;
  completedAt?: string;
  actor?: NarreActor;
  blocks: NarreTranscriptBlock[];
}

export interface NarreTranscript {
  turns: NarreTranscriptTurn[];
}

export interface NarreSessionDetail extends NarreSession {
  rootId?: string;
  rootNetworkId?: string;
  messages: NarreMessage[];
  transcript?: NarreTranscript;
}

export type NarreGraphPriority = 'balanced' | 'strict';

export interface NarreBehaviorSettings {
  graphPriority: NarreGraphPriority;
  discourageLocalWorkspaceActions: boolean;
  extraInstructions?: string;
}

export type NarreCodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';
export type NarreCodexApprovalPolicy = 'untrusted' | 'on-request' | 'never';

export interface NarreCodexSettings {
  model?: string;
  useWorldRootAsWorkingDirectory: boolean;
  sandboxMode: NarreCodexSandboxMode;
  approvalPolicy: NarreCodexApprovalPolicy;
  enableShellTool: boolean;
  enableMultiAgent: boolean;
  enableWebSearch: boolean;
  enableViewImage: boolean;
  enableApps: boolean;
}

export type NarrePromptRuntimeProvider = 'claude' | 'openai' | 'codex';

export interface NarreRuntimeModelOption {
  id: string;
  label: string;
}

export interface NarrePromptCodexRuntimeOverride {
  sandboxMode?: NarreCodexSandboxMode;
  approvalPolicy?: NarreCodexApprovalPolicy;
}

export interface NarrePromptRuntimeOverride {
  model?: string;
  reasoningEffort?: AgentReasoningEffort;
  codex?: NarrePromptCodexRuntimeOverride;
}

export interface NarreStreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done' | 'card';
  content?: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolMetadata?: NarreToolMetadata;
  toolResult?: string;
  error?: string;
  card?: NarreCard;
  sessionId?: string;
  rootId?: string;
  rootNetworkId?: string;
}

export type NarreCardType = 'draft' | 'proposal' | 'permission' | 'interview' | 'summary';
export type ProposalCellType = 'text' | 'icon' | 'color' | 'enum' | 'boolean' | 'readonly';

export interface ProposalColumn {
  key: string;
  label: string;
  cellType: ProposalCellType;
  options?: string[];
}

export interface ProposalRow {
  id: string;
  values: Record<string, unknown>;
}

export interface NarreProposalCard {
  type: 'proposal';
  toolCallId: string;
  title: string;
  columns: ProposalColumn[];
  rows: ProposalRow[];
}

export interface NarreDraftCard {
  type: 'draft';
  toolCallId: string;
  title?: string;
  content: string;
  format?: 'markdown';
  placeholder?: string;
  confirmLabel?: string;
  feedbackLabel?: string;
  feedbackPlaceholder?: string;
  submittedResponse?: NarreDraftResponse;
}

export interface NarreOperationPreviewItem {
  label: string;
  value?: string;
  detail?: string;
  kind?: 'text' | 'icon' | 'color' | 'definition_list';
  definitions?: Array<{
    key: string;
    name: string;
    description?: string | null;
    source_kind?: SourceKind;
    source_ref?: string | null;
  }>;
}

export interface NarreOperationPreview {
  toolKey?: string;
  title: string;
  description?: string;
  summary: string;
  items?: NarreOperationPreviewItem[];
  details?: string[];
}

export interface NarrePermissionCard {
  type: 'permission';
  toolCallId: string;
  message: string;
  preview?: NarreOperationPreview;
  resolvedActionKey?: string;
  actions: Array<{ key: string; label: string; variant?: 'danger' | 'default' }>;
}

export interface NarreInterviewCard {
  type: 'interview';
  toolCallId: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
  allowText?: boolean;
  textPlaceholder?: string;
  submitLabel?: string;
  submittedResponse?: NarreInterviewResponse;
}

export interface NarreInterviewResponse {
  selected: string[];
  text?: string;
}

export interface NarreDraftResponse {
  action: 'confirm' | 'feedback';
  content: string;
  feedback?: string;
}

export interface NarreSummaryCard {
  type: 'summary';
  title: string;
  items: Array<{ label: string; status: 'success' | 'error' }>;
}

export type NarreCard =
  | NarreDraftCard
  | NarreProposalCard
  | NarrePermissionCard
  | NarreInterviewCard
  | NarreSummaryCard;

export interface NetiorChangeEvent {
  type:
    | 'worldNodes'
    | 'kinds'
    | 'properties'
    | 'relationKinds'
    | 'instances'
    | 'resources'
    | 'assignments'
    | 'relations'
    | 'evidence'
    | 'decisions'
    | 'events'
    | 'views';
  action: 'created' | 'updated' | 'deleted' | 'archived' | 'restored';
  id: string;
}

export type AgentDefinitionKind = 'narre' | 'terminal';
export type NarreAgentType = 'system' | 'user';
export type NarreSystemAgentType = 'world-builder' | 'world-finder' | 'agent-operator';
export type NarreUserAgentType = 'global' | 'world';
export type TerminalAgentType = 'codex-cli' | 'claude-code';
export type AgentSkillPackageFormat = 'skill-md-directory';

export interface AgentSkillRef {
  id: string;
  name?: string;
  version?: string;
  format?: AgentSkillPackageFormat;
  source?: SkillSource;
}

export interface UserAgentSkillPackage {
  id: string;
  rootDir: string;
  skillFilePath: string;
  format: AgentSkillPackageFormat;
}

export interface UserAgentSkillSummary {
  id: string;
  name: string;
  description: string;
  body: string;
  rootDir: string;
  skillFilePath: string;
  updatedAt: string | null;
}

export interface UserAgentRecord {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userAgentType: NarreUserAgentType;
  rootId?: string;
  rootNetworkId?: string;
  rootDir: string;
  createdAt: string;
  updatedAt: string;
  skills: UserAgentSkillSummary[];
}

export interface UpsertUserAgentInput {
  id?: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  userAgentType: NarreUserAgentType;
  rootId?: string;
  rootNetworkId?: string;
}

export interface UpsertUserAgentSkillInput {
  agentId: string;
  userAgentType: NarreUserAgentType;
  rootId?: string;
  rootNetworkId?: string;
  skillId?: string;
  name: string;
  description: string;
  body: string;
}

export interface DeleteUserAgentInput {
  agentId: string;
  userAgentType: NarreUserAgentType;
  rootId?: string;
  rootNetworkId?: string;
}

export interface DeleteUserAgentSkillInput extends DeleteUserAgentInput {
  skillId: string;
}

export interface BaseAgentDefinition {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  runtimeProfile?: AgentRuntimeProfile;
}

export interface NarreSystemAgentDefinition extends BaseAgentDefinition {
  kind: 'narre';
  narreAgentType: 'system';
  systemAgentType: NarreSystemAgentType;
  skills: AgentSkillRef[];
}

export interface NarreGlobalUserAgentDefinition extends BaseAgentDefinition {
  kind: 'narre';
  narreAgentType: 'user';
  userAgentType: 'global';
  skills: AgentSkillRef[];
}

export interface NarreWorldUserAgentDefinition extends BaseAgentDefinition {
  kind: 'narre';
  narreAgentType: 'user';
  userAgentType: 'world';
  rootId?: string;
  rootNetworkId?: string;
  skills: AgentSkillRef[];
}

export type NarreUserAgentDefinition =
  | NarreGlobalUserAgentDefinition
  | NarreWorldUserAgentDefinition;

export type NarreAgentDefinition =
  | NarreSystemAgentDefinition
  | NarreUserAgentDefinition;

export interface TerminalAgentDefinition extends BaseAgentDefinition {
  kind: 'terminal';
  terminalAgentType: TerminalAgentType;
}

export type AgentDefinition =
  | NarreAgentDefinition
  | TerminalAgentDefinition;

export type AgentProvider = 'claude' | 'codex' | 'narre';
export type AgentRuntimeProvider = 'terminal' | 'claude' | 'codex' | 'openai' | 'narre';
export type AgentReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'error' | 'offline';
export type AgentAttentionReason = 'approval' | 'user_input' | 'unknown';
export type AgentUxState = 'working' | 'needs_attention' | 'idle' | 'error' | 'offline';

export interface AgentRuntimeProfile {
  provider: AgentRuntimeProvider;
  model?: string;
  reasoningEffort?: AgentReasoningEffort;
  temperature?: number;
  contextBudget?: number;
  extraInstruction?: string;
  toolProfileIds?: string[];
  approvalPolicy?: 'default' | 'strict';
  contextScope?: 'run' | 'task';
  metadata?: Record<string, string>;
}

export interface AgentRuntimeOverride {
  model?: string;
  reasoningEffort?: AgentReasoningEffort;
  temperature?: number;
  contextBudget?: number;
  extraInstruction?: string;
  metadata?: Record<string, string>;
}

export interface AgentSurfaceRef {
  kind: 'terminal' | 'editor';
  id: string;
}

export interface AgentSessionEvent {
  provider: AgentProvider;
  sessionId: string;
  surface: AgentSurfaceRef;
  externalSessionId?: string | null;
  type: 'start' | 'stop';
}

export interface AgentStatusEvent {
  provider: AgentProvider;
  sessionId: string;
  status: AgentStatus;
  reason?: AgentAttentionReason | null;
}

export interface AgentNameEvent {
  provider: AgentProvider;
  sessionId: string;
  name: string;
}

export interface AgentTurnEvent {
  provider: AgentProvider;
  sessionId: string;
  turnId?: string | null;
  type: 'start' | 'complete';
}

export interface AgentSessionSnapshot {
  provider: AgentProvider;
  sessionId: string;
  surface: AgentSurfaceRef;
  externalSessionId: string | null;
  status: AgentStatus;
  reason: AgentAttentionReason | null;
  name: string | null;
  turnState: 'idle' | 'working';
}

export type TerminalSessionState = 'created' | 'starting' | 'running' | 'exited';

export interface TerminalAgentLaunchConfig {
  provider: Exclude<AgentProvider, 'narre'>;
  remoteUrl?: string;
}

export interface TerminalLaunchConfig {
  cwd: string;
  shell?: string;
  args?: string[];
  title?: string;
  env?: Record<string, string>;
  agent?: TerminalAgentLaunchConfig;
}

export interface TerminalSessionInfo {
  sessionId: string;
  cwd: string;
  title: string;
  shellPath: string;
  shellArgs: string[];
  state: TerminalSessionState;
  pid: number | null;
  exitCode: number | null;
  cols: number;
  rows: number;
}

export type ClaudeCodeStatus = 'idle' | 'working';

export interface ClaudeSessionEvent {
  ptySessionId: string;
  claudeSessionId: string | null;
  type: 'start' | 'stop';
}

export interface ClaudeStatusEvent {
  ptySessionId: string;
  status: ClaudeCodeStatus;
}

export interface ClaudeNameEvent {
  ptySessionId: string;
  sessionName: string;
}

export type ConversationMode = 'direct' | 'orchestration';
export type OrchestrationRunStatus = 'planning' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type OrchestrationTaskStatus = 'pending' | 'assigned' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type AgentAssignmentStatus = 'pending' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type AgentApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AgentEventType =
  | 'user_message'
  | 'task_created'
  | 'task_assigned'
  | 'task_started'
  | 'approval_requested'
  | 'approval_resolved'
  | 'run_completed'
  | 'task_completed'
  | 'executor_registered'
  | 'executor_heartbeat'
  | 'terminal_command'
  | 'handoff'
  | 'tool_call'
  | 'agent_message'
  | 'error';

export interface Conversation {
  id: string;
  rootId?: string;
  rootNetworkId?: string;
  mode: ConversationMode;
  title: string;
  participantAgentKeys: string[];
  activeRunId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface OrchestrationRun {
  id: string;
  conversationId: string | null;
  rootId?: string;
  rootNetworkId?: string;
  mode: ConversationMode;
  userRequest: string;
  status: OrchestrationRunStatus;
  rootTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  result: string | null;
  metadata?: Record<string, string>;
}

export interface OrchestrationTask {
  id: string;
  runId: string;
  parentTaskId: string | null;
  dependsOnTaskIds: string[];
  title: string;
  input: string;
  status: OrchestrationTaskStatus;
  assignedAgentKey: string | null;
  assignedSessionId: string | null;
  runtimeOverride?: AgentRuntimeOverride;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  metadata?: Record<string, string>;
}

export interface AgentAssignment {
  id: string;
  runId: string;
  taskId: string;
  agentKey: string;
  sessionId: string | null;
  status: AgentAssignmentStatus;
  runtimeSnapshot: AgentRuntimeProfile | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  result: string | null;
  metadata?: Record<string, string>;
}

export interface AgentApprovalRequest {
  id: string;
  runId: string;
  taskId: string | null;
  assignmentId: string | null;
  agentKey: string | null;
  sessionId: string | null;
  status: AgentApprovalStatus;
  card?: NarreCard;
  prompt: string | null;
  response: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  resolvedAt?: string | null;
  metadata?: Record<string, string>;
}

export interface AgentEvent {
  seq: number;
  id: string;
  runId: string;
  conversationId: string | null;
  taskId: string | null;
  assignmentId: string | null;
  sessionId: string | null;
  agentKey: string | null;
  type: AgentEventType;
  message: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateConversationInput {
  rootId?: string;
  rootNetworkId?: string;
  mode?: ConversationMode;
  title?: string;
  participantAgentKeys?: string[];
  metadata?: Record<string, string>;
}

export interface CreateOrchestrationRunInput {
  rootId?: string;
  rootNetworkId?: string;
  conversationId?: string | null;
  mode?: ConversationMode;
  userRequest: string;
  participantAgentKeys?: string[];
  metadata?: Record<string, string>;
}

export interface CreateOrchestrationTaskInput {
  runId: string;
  parentTaskId?: string | null;
  dependsOnTaskIds?: string[];
  title: string;
  input: string;
  assignedAgentKey?: string | null;
  runtimeOverride?: AgentRuntimeOverride;
  metadata?: Record<string, string>;
}

export interface CreateAgentAssignmentInput {
  runId: string;
  taskId: string;
  agentKey: string;
  sessionId?: string | null;
  runtimeSnapshot?: AgentRuntimeProfile | null;
  metadata?: Record<string, string>;
}

export type AgentExecutorStatus = 'online' | 'busy' | 'offline';
export type AgentExecutorCommandType =
  | 'start_assignment'
  | 'cancel_assignment'
  | 'request_status'
  | 'launch_agent'
  | 'send_input'
  | 'interrupt'
  | 'attach_session';
export type AgentExecutorCommandStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentExecutorRegistration {
  id: string;
  rootId: string | null;
  rootNetworkId?: string | null;
  provider: AgentProvider | AgentRuntimeProvider;
  surface: AgentSurfaceRef;
  status: AgentExecutorStatus;
  capabilities: string[];
  currentAssignmentId: string | null;
  registeredAt: string;
  lastHeartbeatAt: string;
  metadata?: Record<string, string>;
}

export interface AgentExecutorCommand {
  id: string;
  executorId: string;
  runId: string | null;
  taskId: string | null;
  assignmentId: string | null;
  agentKey: string | null;
  type: AgentExecutorCommandType;
  status: AgentExecutorCommandStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type SupervisorEventType =
  | 'session_started'
  | 'session_updated'
  | 'session_completed'
  | 'session_failed'
  | 'session_reported';

export interface SupervisorAgentSessionSnapshot {
  id: string;
  agentKey: string;
  agentId: string;
  agent: AgentDefinition;
  status: AgentStatus;
  reason: AgentAttentionReason | null;
  surface: AgentSurfaceRef;
  externalSessionId: string | null;
  rootId?: string;
  rootNetworkId?: string;
  currentRunId: string | null;
  currentTaskId: string | null;
  title?: string | null;
  skillId?: SkillId | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface SupervisorEvent {
  seq: number;
  type: SupervisorEventType;
  sessionId: string;
  agentKey: string;
  status: AgentStatus;
  createdAt: string;
  snapshot: SupervisorAgentSessionSnapshot;
}

export interface SupervisorSessionReport {
  agent: AgentDefinition;
  surface: AgentSurfaceRef;
  sessionId: string;
  externalSessionId?: string | null;
  rootId?: string;
  rootNetworkId?: string;
  currentRunId?: string | null;
  currentTaskId?: string | null;
  title?: string | null;
  status?: AgentStatus;
  reason?: AgentAttentionReason | null;
  skillId?: SkillId | null;
  metadata?: Record<string, string>;
}
