// ============================================
// Project
// ============================================

export type OntologySourceKind = 'system' | 'package' | 'project' | 'imported';

export interface OntologySourceFields {
  source_kind: OntologySourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
}

export interface Project {
  id: string;
  name: string;
  root_dir: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  root_dir: string;
}

export interface ProjectUpdate {
  name?: string;
  root_dir?: string;
}

// ============================================
// Instance
// ============================================

export interface Instance {
  id: string;
  project_id: string;
  schema_id: string | null;
  recurrence_source_instance_id: string | null;
  recurrence_occurrence_key: string | null;
  title: string;
  color: string | null;
  icon: string | null;
  content: string | null;
  agent_content: string | null;
  source_kind: OntologySourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstanceCreate {
  project_id: string;
  title: string;
  schema_id?: string;
  recurrence_source_instance_id?: string | null;
  recurrence_occurrence_key?: string | null;
  color?: string;
  icon?: string;
  content?: string;
  agent_content?: string;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface InstanceUpdate {
  title?: string;
  schema_id?: string | null;
  recurrence_source_instance_id?: string | null;
  recurrence_occurrence_key?: string | null;
  color?: string | null;
  icon?: string | null;
  content?: string | null;
  agent_content?: string | null;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

// ============================================
// Network
// ============================================

export interface Network {
  id: string;
  project_id: string | null;
  scope: string;
  kind: NetworkKind;
  parent_network_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export type NetworkKind = 'universe' | 'ontology' | 'network';

export interface NetworkCreate {
  project_id: string | null;
  name: string;
  scope?: string;
  kind?: NetworkKind;
  parent_network_id?: string;
}

export interface NetworkUpdate {
  name?: string;
  scope?: string;
  parent_network_id?: string | null;
}

// ============================================
// File (1급 엔티티 — 파일/디렉토리)
// ============================================

export type FileEntityType = 'file' | 'directory';

export interface FileEntity {
  id: string;
  project_id: string;
  path: string;
  type: FileEntityType;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileEntityCreate {
  project_id: string;
  path: string;
  type: FileEntityType;
}

export interface FileEntityUpdate {
  metadata?: string | null;
}

// ============================================
// PDF TOC (file.metadata.pdf_toc)
// ============================================

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

// ============================================
// Context
// ============================================

export interface Context {
  id: string;
  network_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContextCreate {
  network_id: string;
  name: string;
  description?: string;
}

export interface ContextUpdate {
  name?: string;
  description?: string | null;
}

export interface ContextMember {
  id: string;
  context_id: string;
  member_type: 'object' | 'edge';
  member_id: string;
}

// ============================================
// Network Object
// ============================================

export type NetworkObjectType =
  | 'instance' | 'network' | 'project' | 'schema' | 'model'
  | 'agent' | 'context'
  | 'file' | 'module' | 'folder';

export type NodeType = 'basic' | 'portal' | 'group' | 'hierarchy';
export type NodeConfigKind = 'freeform' | 'grid' | 'list';
export type NodeSortDirection = 'asc' | 'desc';
export type NodeSortEmptyPlacement = 'first' | 'last';

export type NodeSortConfig =
  | {
      kind: 'meaning_binding';
      meaning: FieldMeaningBindingKey;
      direction?: NodeSortDirection;
      emptyPlacement?: NodeSortEmptyPlacement;
    }
  | {
      kind: 'property';
      fieldId: string;
      direction?: NodeSortDirection;
      emptyPlacement?: NodeSortEmptyPlacement;
    };

export interface NodeFreeformConfig {
  kind: 'freeform';
}

export interface NodeGridConfig {
  kind: 'grid';
  columns?: number;
  gapX?: number;
  gapY?: number;
  padding?: number;
  itemWidth?: number;
  itemHeight?: number;
  sort?: NodeSortConfig | null;
}

export interface NodeListConfig {
  kind: 'list';
  gap?: number;
  padding?: number;
  itemHeight?: number;
  sort?: NodeSortConfig | null;
}

export type NodeConfig = NodeFreeformConfig | NodeGridConfig | NodeListConfig;

export interface ObjectRecord {
  id: string;
  object_type: NetworkObjectType;
  scope: string;
  project_id: string | null;
  ref_id: string;
  created_at: string;
}

// ============================================
// NetworkNode
// ============================================

export interface NetworkNode {
  id: string;
  network_id: string;
  object_id: string;
  node_type: NodeType;
  parent_node_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetworkNodeCreate {
  network_id: string;
  object_id: string;
  node_type?: NodeType;
  parent_node_id?: string;
  metadata?: string | null;
}

export interface NetworkNodeUpdate {
  node_type?: NodeType;
  parent_node_id?: string | null;
  metadata?: string | null;
}

// ============================================
// Edge
// ============================================

export interface Edge {
  id: string;
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  model_id: string | null;
  description: string | null;
  created_at: string;
}

export interface EdgeCreate {
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  model_id?: string | null;
  description?: string;
}

export interface EdgeUpdate {
  model_id?: string | null;
  description?: string | null;
}

// ============================================
// Meaning Model
// ============================================

export type SemanticCategoryKey =
  | 'time'
  | 'workflow'
  | 'structure'
  | 'knowledge'
  | 'space'
  | 'quant'
  | 'governance';

export type SemanticCategoryRefKey = SemanticCategoryKey | (string & {});

export type ModelKey =
  | 'temporal'
  | 'dueable'
  | 'recurring'
  | 'statusful'
  | 'assignable'
  | 'prioritizable'
  | 'progressable'
  | 'estimable'
  | 'hierarchical'
  | 'ordered'
  | 'taggable'
  | 'categorizable'
  | 'sourceable'
  | 'attachable'
  | 'versioned'
  | 'locatable'
  | 'measurable'
  | 'budgeted'
  | 'ownable'
  | 'approvable'
  | 'instance_select'
  | 'instance_multi_select'
  | 'schema_composition'
  | 'schema_extension'
  | 'conditional_field'
  | 'computed_field'
  | 'derived_collection'
  | 'contains_relation'
  | 'entry_portal_relation'
  | 'parent_relation';

export type ModelRefKey = ModelKey | (string & {});

export type SemanticMeaningKey =
  | 'time_interval'
  | 'deadline'
  | 'recurrence'
  | 'workflow_state'
  | 'assignment'
  | 'priority'
  | 'progress'
  | 'estimate'
  | 'hierarchy'
  | 'ordering'
  | 'tagging'
  | 'classification'
  | 'source'
  | 'attachment'
  | 'versioning'
  | 'location'
  | 'measurement'
  | 'budget'
  | 'ownership'
  | 'approval';

export type MeaningSlotKey =
  | 'start_at'
  | 'end_at'
  | 'all_day'
  | 'timezone'
  | 'due_at'
  | 'recurrence_rule'
  | 'recurrence_frequency'
  | 'recurrence_interval'
  | 'recurrence_weekdays'
  | 'recurrence_monthday'
  | 'recurrence_until'
  | 'recurrence_count'
  | 'status'
  | 'status_changed_at'
  | 'assignee_refs'
  | 'primary_assignee_ref'
  | 'priority'
  | 'progress_ratio'
  | 'completed_at'
  | 'estimate_value'
  | 'estimate_unit'
  | 'actual_value'
  | 'parent_ref'
  | 'order_index'
  | 'tag_keys'
  | 'category_key'
  | 'source_url'
  | 'source_ref'
  | 'citation'
  | 'attachment_refs'
  | 'version'
  | 'revision'
  | 'supersedes_ref'
  | 'place_ref'
  | 'address'
  | 'lat'
  | 'lng'
  | 'measure_value'
  | 'measure_unit'
  | 'target_value'
  | 'budget_amount'
  | 'budget_currency'
  | 'budget_limit'
  | 'owner_ref'
  | 'approval_state'
  | 'approved_by_ref'
  | 'approved_at';

export type FieldMeaningKey =
  | 'time.start'
  | 'time.end'
  | 'time.all_day'
  | 'time.timezone'
  | 'time.due'
  | 'time.recurrence_rule'
  | 'time.recurrence_frequency'
  | 'time.recurrence_interval'
  | 'time.recurrence_weekdays'
  | 'time.recurrence_monthday'
  | 'time.recurrence_until'
  | 'time.recurrence_count'
  | 'workflow.status'
  | 'workflow.status_changed_at'
  | 'workflow.assignees'
  | 'workflow.primary_assignee'
  | 'workflow.priority'
  | 'workflow.progress'
  | 'workflow.completed_at'
  | 'workflow.estimate_value'
  | 'workflow.estimate_unit'
  | 'workflow.actual_value'
  | 'structure.parent'
  | 'structure.order'
  | 'structure.tags'
  | 'structure.category'
  | 'knowledge.source_url'
  | 'knowledge.source_ref'
  | 'knowledge.citation'
  | 'knowledge.attachments'
  | 'knowledge.version'
  | 'knowledge.revision'
  | 'knowledge.supersedes'
  | 'space.place'
  | 'space.address'
  | 'space.lat'
  | 'space.lng'
  | 'quant.measure_value'
  | 'quant.measure_unit'
  | 'quant.target_value'
  | 'quant.budget_amount'
  | 'quant.budget_currency'
  | 'quant.budget_limit'
  | 'governance.owner'
  | 'governance.approval_state'
  | 'governance.approved_by'
  | 'governance.approved_at';

export type FieldMeaningBindingKey = FieldMeaningKey | `${string}.${string}`;
export type FieldMeaningBindingSource = 'manual' | 'model' | 'migration' | 'system';
export type MeaningBindingKey = FieldMeaningBindingKey;
export type MeaningSourceKind = 'manual' | 'model' | 'migration' | 'system';
export type SlotBindingTargetKind = 'field' | 'edge' | 'derived';

export type SlotConstraintLevel = 'strict' | 'constrained' | 'loose';

export type ModelRepresentationKind = 'single_field' | 'field_group' | 'relation' | 'computed';
export type ModelTargetKind = 'object' | 'edge' | 'both';
export type SchemaFieldBindingKind =
  | 'instance_select'
  | 'instance_multi_select'
  | 'schema_composition'
  | 'schema_extension'
  | 'conditional_field'
  | 'computed_field'
  | 'derived_collection';
export type SchemaFieldBindingCardinality = 'none' | 'one' | 'many' | 'object';
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';

export interface ModelFieldRecipe {
  id: string;
  key: string;
  name: string;
  field_types: FieldType[];
  required: boolean;
  description?: string | null;
  options?: string | null;
}

export interface ModelMeaningRecipe {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  representation: ModelRepresentationKind;
  fields: ModelFieldRecipe[];
}

export interface ModelRuleRecipe {
  id: string;
  description: string;
}

export interface ModelRecipe {
  meanings: ModelMeaningRecipe[];
  rules: ModelRuleRecipe[];
}

export interface Model {
  id: string;
  project_id: string;
  key: ModelRefKey;
  name: string;
  description: string | null;
  category_instance_id: string | null;
  category_instance_title?: string | null;
  category_instance_source_ref?: string | null;
  target_kind: ModelTargetKind;
  meaning_keys: SemanticMeaningKey[];
  core_slots: MeaningSlotKey[];
  optional_slots: MeaningSlotKey[];
  recipe: ModelRecipe;
  color: string | null;
  icon: string | null;
  line_style: EdgeLineStyle | null;
  directed: boolean | null;
  built_in: boolean;
  source_kind: OntologySourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelCreate {
  project_id: string;
  key?: ModelRefKey;
  name: string;
  description?: string | null;
  category_instance_id?: string | null;
  target_kind?: ModelTargetKind;
  meaning_keys?: SemanticMeaningKey[];
  core_slots?: MeaningSlotKey[];
  optional_slots?: MeaningSlotKey[];
  recipe?: ModelRecipe;
  color?: string | null;
  icon?: string | null;
  line_style?: EdgeLineStyle | null;
  directed?: boolean | null;
  built_in?: boolean;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface ModelUpdate {
  key?: ModelRefKey;
  name?: string;
  description?: string | null;
  category_instance_id?: string | null;
  target_kind?: ModelTargetKind;
  meaning_keys?: SemanticMeaningKey[];
  core_slots?: MeaningSlotKey[];
  optional_slots?: MeaningSlotKey[];
  recipe?: ModelRecipe;
  color?: string | null;
  icon?: string | null;
  line_style?: EdgeLineStyle | null;
  directed?: boolean | null;
  built_in?: boolean;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

// ============================================
// Layout
// ============================================

export interface Layout {
  id: string;
  layout_type: string;
  layout_config_json: string | null;
  viewport_json: string | null;
  network_id: string | null;
  context_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayoutUpdate {
  layout_type?: string;
  layout_config_json?: string | null;
  viewport_json?: string | null;
}

export interface LayoutNodePosition {
  id: string;
  layout_id: string;
  node_id: string;
  position_json: string;
}

export interface LayoutEdgeVisual {
  id: string;
  layout_id: string;
  edge_id: string;
  visual_json: string;
}

// ============================================
// Service DTOs
// ============================================

export interface NodePosition {
  nodeId: string;
  positionJson: string;
}

export interface EdgeVisual {
  edgeId: string;
  visualJson: string;
}

export interface NetworkFullData {
  network: Network;
  layout: Layout | undefined;
  nodes: (NetworkNode & {
    object?: ObjectRecord;
    instance?: Instance;
    file?: FileEntity;
  })[];
  edges: (Edge & { model?: Model })[];
  nodePositions: NodePosition[];
  edgeVisuals: EdgeVisual[];
}

// ============================================
// IPC
// ============================================

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface NetiorServiceSuccess<T> {
  ok: true;
  data: T;
}

export interface NetiorServiceError {
  ok: false;
  error: string;
}

export type NetiorServiceResponse<T> = NetiorServiceSuccess<T> | NetiorServiceError;

// ============================================
// File System
// ============================================

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  extension?: string;
  /** Directory exists but children not yet loaded (lazy loading) */
  hasChildren?: boolean;
}

// ============================================
// Module
// ============================================

export interface Module {
  id: string;
  project_id: string;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleCreate {
  project_id: string;
  name: string;
  path: string;
}

export interface ModuleUpdate {
  name?: string;
  path?: string;
}

export interface ModuleDirectory {
  id: string;
  module_id: string;
  dir_path: string;
  created_at: string;
}

export interface ModuleDirectoryCreate {
  module_id: string;
  dir_path: string;
}

// ============================================
// Schema
// ============================================

export interface Schema {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  node_shape: string | null;
  file_template: string | null;
  models: ModelRefKey[];
  source_kind: OntologySourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchemaCreate {
  project_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  node_shape?: string;
  file_template?: string;
  models?: ModelRefKey[];
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface SchemaUpdate {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  node_shape?: string | null;
  file_template?: string | null;
  models?: ModelRefKey[];
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

// ============================================
// Schema Field
// ============================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'relation'
  | 'object'
  | 'file'
  | 'url'
  | 'color'
  | 'rating'
  | 'tags'
  | 'model_ref';

export interface SchemaFieldBinding {
  id: string;
  field_id: string;
  model_id: string | null;
  binding_kind: SchemaFieldBindingKind;
  source_schema_id: string | null;
  source_field_id: string | null;
  cardinality: SchemaFieldBindingCardinality;
  read_only: boolean;
  config: string | null;
  sort_order: number;
  source_kind: OntologySourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchemaFieldBindingCreate {
  field_id?: string;
  model_id?: string | null;
  binding_kind: SchemaFieldBindingKind;
  source_schema_id?: string | null;
  source_field_id?: string | null;
  cardinality?: SchemaFieldBindingCardinality;
  read_only?: boolean;
  config?: string | null;
  sort_order?: number;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface SchemaFieldBindingUpdate {
  model_id?: string | null;
  binding_kind?: SchemaFieldBindingKind;
  source_schema_id?: string | null;
  source_field_id?: string | null;
  cardinality?: SchemaFieldBindingCardinality;
  read_only?: boolean;
  config?: string | null;
  sort_order?: number;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface SchemaField {
  id: string;
  schema_id: string;
  name: string;
  field_type: FieldType;
  options: string | null;
  sort_order: number;
  required: boolean;
  default_value: string | null;
  bindings: SchemaFieldBinding[];
  meaning_bindings: FieldMeaningBindingKey[];
  slot_binding_locked: boolean;
  generated_by_model: boolean;
  source_kind: OntologySourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
  created_at: string;
}

export interface SchemaFieldCreate {
  schema_id: string;
  name: string;
  field_type: FieldType;
  options?: string;
  sort_order: number;
  required?: boolean;
  default_value?: string;
  bindings?: SchemaFieldBindingCreate[];
  meaning_slot?: MeaningSlotKey | null;
  meaning_key?: FieldMeaningKey | null;
  meaning_bindings?: FieldMeaningBindingKey[];
  slot_binding_locked?: boolean;
  generated_by_model?: boolean;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface SchemaFieldUpdate {
  name?: string;
  field_type?: FieldType;
  options?: string | null;
  sort_order?: number;
  required?: boolean;
  default_value?: string | null;
  bindings?: SchemaFieldBindingCreate[];
  meaning_slot?: MeaningSlotKey | null;
  meaning_key?: FieldMeaningKey | null;
  meaning_bindings?: FieldMeaningBindingKey[];
  slot_binding_locked?: boolean;
  generated_by_model?: boolean;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface SchemaMeaningSlotBinding {
  id: string;
  meaning_id: string;
  slot_key: MeaningSlotKey;
  target_kind: SlotBindingTargetKind;
  field_id: string | null;
  required: boolean;
  sort_order: number;
  created_at: string;
}

export interface SchemaMeaning {
  id: string;
  schema_id: string;
  meaning_key: SemanticMeaningKey;
  label: string | null;
  source: MeaningSourceKind;
  source_model: ModelRefKey | null;
  sort_order: number;
  slots: SchemaMeaningSlotBinding[];
  source_kind: OntologySourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchemaMeaningCreate {
  schema_id: string;
  meaning_key: SemanticMeaningKey;
  label?: string | null;
  source?: MeaningSourceKind;
  source_model?: ModelRefKey | null;
  sort_order?: number;
  source_kind?: OntologySourceKind;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface SchemaMeaningUpdate {
  label?: string | null;
  sort_order?: number;
}

export interface SchemaMeaningSlotBindingUpdate {
  target_kind?: SlotBindingTargetKind;
  field_id?: string | null;
}

export type SchemaSlot = SchemaField;
export type SchemaSlotCreate = SchemaFieldCreate;
export type SchemaSlotUpdate = SchemaFieldUpdate;

// ============================================
// Instance Property
// ============================================

export interface InstanceProperty {
  id: string;
  instance_id: string;
  field_id: string;
  value: string | null;
}

export interface InstancePropertyUpsert {
  instance_id: string;
  field_id: string;
  value: string | null;
}

// ============================================
// Network Tree
// ============================================

export interface NetworkTreeNode {
  network: Network;
  children: NetworkTreeNode[];
}

// ============================================
// Network Breadcrumb
// ============================================

export interface NetworkBreadcrumbItem {
  networkId: string;
  networkName: string;
}

// ============================================
// Editor System
// ============================================

export type EditorViewMode = 'float' | 'full' | 'side' | 'detached';
export type EditorTabType = 'instance' | 'file' | 'schema' | 'model' | 'terminal' | 'edge' | 'network' | 'networkViewer' | 'ontology' | 'project' | 'narre' | 'agent' | 'fileMetadata' | 'context' | 'browser';

/** Identifies a window that hosts editor tabs (main window or detached window) */
export interface EditorHostState {
  id: string;
  /** Display label for the window (shown in context menu "Move to > ...") */
  label: string;
  /** 'main' for the primary window, 'detached' for pop-out windows */
  kind: 'main' | 'detached';
  /** Per-host active tab id */
  activeTabId: string | null;
  /** Split layout tree for side-mode tabs in this host */
  sideLayout: SplitNode | null;
  /** Split layout tree for full-mode tabs in this host */
  fullLayout: SplitNode | null;
}

// Split layout tree for side/full editor panes
export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitLeaf {
  type: 'leaf';
  tabIds: string[];
  activeTabId: string;
}

export interface SplitBranch {
  type: 'branch';
  direction: SplitDirection;
  ratio: number;
  children: [SplitNode, SplitNode];
}

export type SplitNode = SplitLeaf | SplitBranch;

export interface EditorTab {
  id: string;
  type: EditorTabType;
  /** Display name for tab bar */
  title: string;
  /** Target entity identifier: instanceId for instance tabs, absolutePath for file tabs */
  targetId: string;
  /** Owning project id for project-scoped tabs */
  projectId?: string;
  /** Host window this tab belongs to */
  hostId: string;
  viewMode: EditorViewMode;
  floatRect: { x: number; y: number; width: number; height: number };
  isMinimized: boolean;
  sideSplitRatio: number;
  isDirty: boolean;
  isStale?: boolean;
  /** Active sub-file within a instance editor */
  activeFilePath: string | null;
  /** Override editor type for file tabs (when user switches via context menu) */
  editorType?: string;
  /** Network context for object tabs opened from a network node */
  networkId?: string;
  /** Network node context for object tabs opened from a concrete node */
  nodeId?: string;
  /** Working directory override for terminal tabs */
  terminalCwd?: string;
  /** Launch override for terminal tabs (for example agent-specific terminals) */
  terminalLaunchConfig?: Pick<TerminalLaunchConfig, 'shell' | 'args' | 'agent'>;
  /** Favicon URL for embedded browser tabs */
  browserFaviconUrl?: string;
  /** Draft data for unsaved new entities (instance creation flow) */
  draftData?: {
    networkId?: string;
    parentGroupNodeId?: string;
    slotIndex?: number;
    positionX?: number;
    positionY?: number;
    allowedSchemaIds?: string[];
  };
  /** Whether the user manually renamed this tab (prevents auto-title updates) */
  isManuallyRenamed?: boolean;
}

export interface InstanceEditorPrefs {
  id: string;
  instance_id: string;
  view_mode: EditorViewMode;
  float_x: number | null;
  float_y: number | null;
  float_width: number;
  float_height: number;
  side_split_ratio: number;
  updated_at: string;
}

export interface InstanceEditorPrefsUpdate {
  view_mode?: EditorViewMode;
  float_x?: number;
  float_y?: number;
  float_width?: number;
  float_height?: number;
  side_split_ratio?: number;
}

export interface InteractiveViewState {
  id: string;
  project_id: string;
  instance_id: string;
  view_template_id: string;
  state_json: string;
  created_at: string;
  updated_at: string;
}

export interface InteractiveViewStateUpsert {
  instance_id: string;
  view_template_id: string;
  state_json: string;
}

export type InteractiveViewTemplateTargetKind = 'schema' | 'instance';
export type InteractiveViewTemplateSourceKind = 'manual' | 'narre';
export type InteractiveViewTrustLevel = 'untrusted' | 'validated' | 'trusted';
export type InteractiveViewRuntime = 'host' | 'sandbox';
export type InteractiveViewValidationStatus = 'unknown' | 'passed' | 'failed';

export interface InteractiveViewManifest {
  kind: 'interactive-view';
  sdkVersion: number;
  target?: {
    schemaId?: string;
    instanceId?: string;
  };
  permissions?: {
    readFields?: string[];
    writeFields?: string[];
    viewState?: boolean;
  };
  runtime?: InteractiveViewRuntime;
}

export interface InteractiveViewTemplate {
  id: string;
  project_id: string;
  target_kind: InteractiveViewTemplateTargetKind;
  target_id: string | null;
  name: string;
  description: string | null;
  source_code: string;
  manifest_json: string;
  source_kind: InteractiveViewTemplateSourceKind;
  trust_level: InteractiveViewTrustLevel;
  default_runtime: InteractiveViewRuntime;
  enabled: number;
  validation_status: InteractiveViewValidationStatus;
  validation_errors_json: string;
  created_at: string;
  updated_at: string;
}

export interface InteractiveViewTemplateCreate {
  project_id: string;
  target_kind: InteractiveViewTemplateTargetKind;
  target_id?: string | null;
  name: string;
  description?: string | null;
  source_code: string;
  manifest_json: string;
  source_kind?: InteractiveViewTemplateSourceKind;
  trust_level?: InteractiveViewTrustLevel;
  default_runtime?: InteractiveViewRuntime;
  enabled?: number;
  validation_status?: InteractiveViewValidationStatus;
  validation_errors_json?: string;
}

export interface InteractiveViewTemplateUpdate {
  target_kind?: InteractiveViewTemplateTargetKind;
  target_id?: string | null;
  name?: string;
  description?: string | null;
  source_code?: string;
  manifest_json?: string;
  source_kind?: InteractiveViewTemplateSourceKind;
  trust_level?: InteractiveViewTrustLevel;
  default_runtime?: InteractiveViewRuntime;
  enabled?: number;
  validation_status?: InteractiveViewValidationStatus;
  validation_errors_json?: string;
}

export interface InteractiveViewTemplateListQuery {
  projectId: string;
  schemaId?: string | null;
  instanceId?: string | null;
}

export interface InteractiveViewPreference {
  id: string;
  project_id: string;
  instance_id: string;
  preference_mode: 'inherit' | 'template' | 'none';
  selected_view_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InteractiveViewPreferenceUpsert {
  instance_id: string;
  preference_mode?: 'inherit' | 'template' | 'none';
  selected_view_template_id: string | null;
}

export interface InteractiveViewSchemaPreference {
  id: string;
  project_id: string;
  schema_id: string;
  selected_view_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InteractiveViewSchemaPreferenceUpsert {
  schema_id: string;
  selected_view_template_id: string | null;
}

// ============================================
// Narre Types
// ============================================

export interface NarreSession {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
}

export interface NarreMessage {
  role: 'user' | 'assistant';
  content: string;
  mentions?: NarreMention[];
  tool_calls?: NarreToolCall[];
  timestamp: string;
}

export interface NarreMention {
  type: 'instance' | 'network' | 'edge' | 'schema' | 'model' | 'module' | 'file' | 'agent';
  id?: string;
  path?: string;
  display: string;
}

export interface NarreToolCall {
  tool: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  metadata?: NarreToolMetadata;
  result?: string;
  error?: string;
}

export type NarreToolCategory =
  | 'project'
  | 'types'
  | 'instances'
  | 'graph'
  | 'files'
  | 'modules'
  | 'search'
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
export type NetiorMcpToolScope = 'app' | 'project' | 'network' | 'object' | 'file' | 'mixed';

export interface NetiorMcpToolSpec {
  key: string;
  displayName?: string;
  description: string;
  category: NarreToolCategory;
  kind: NarreToolKind;
  isMutation: boolean;
  approvalMode: NarreToolApprovalMode;
  profiles?: readonly NetiorMcpToolProfile[];
  scope?: NetiorMcpToolScope;
  defaultProjectBinding?: boolean;
}

export interface NarreToolMetadata {
  displayName: string;
  description?: string;
  category: NarreToolCategory;
  kind: NarreToolKind;
  isMutation: boolean;
  approvalMode: NarreToolApprovalMode;
  profiles?: readonly NetiorMcpToolProfile[];
  scope?: NetiorMcpToolScope;
  defaultProjectBinding?: boolean;
}

export type NarreActorProvider = 'narre' | 'claude' | 'openai' | 'codex' | 'custom';

export interface NarreActor {
  provider: NarreActorProvider;
  id?: string;
  label?: string;
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

export interface NarreLegacyCommandBlock {
  id: string;
  type: 'command';
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

export interface NarreTranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  createdAt: string;
  actor?: NarreActor;
  blocks: NarreTranscriptBlock[];
}

export type NarreTranscriptBlock =
  | NarreRichTextBlock
  | NarreSkillInvocationBlock
  | NarreLegacyCommandBlock
  | NarreDraftBlock
  | NarreToolBlock
  | NarreCardBlock;

export interface NarreTranscript {
  turns: NarreTranscriptTurn[];
}

export interface NarreSessionFileV1 {
  messages: NarreMessage[];
}

export interface NarreSessionFileV2 {
  version: 2;
  transcript: NarreTranscript;
}

export interface NarreSessionDetail extends NarreSession {
  projectId?: string;
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
  useProjectRootAsWorkingDirectory: boolean;
  sandboxMode: NarreCodexSandboxMode;
  approvalPolicy: NarreCodexApprovalPolicy;
  enableShellTool: boolean;
  enableMultiAgent: boolean;
  enableWebSearch: boolean;
  enableViewImage: boolean;
  enableApps: boolean;
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
  projectId?: string;
}

// ============================================
// Skill Types
// ============================================

export type SkillId = string;
export type BuiltInSkillId = 'bootstrap' | 'index' | 'interactive-view';
export type SkillSource = 'builtin' | 'file';
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

// ============================================
// Narre Response Card Types
// ============================================

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
  kind?: 'text' | 'icon' | 'color' | 'node_shape' | 'model_list';
  models?: Array<{
    key: string;
    name: string;
    description?: string | null;
    built_in?: boolean;
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
  type: 'schemas' | 'models' | 'instances' | 'relationTypes' | 'networks' | 'edges' | 'layouts' | 'contexts';
  action: 'created' | 'updated' | 'deleted';
  id: string;
}

// ============================================
// Agent Definition Types
// ============================================

export type AgentDefinitionKind = 'narre' | 'terminal';
export type NarreAgentType = 'system' | 'user';
export type NarreSystemAgentType = 'network-builder' | 'network-finder' | 'agent-operator';
export type NarreUserAgentType = 'global' | 'project';
export type TerminalAgentType = 'codex-cli' | 'claude-code';
export type AgentSkillPackageFormat = 'skill-md-directory';

export interface AgentSkillRef {
  id: string;
  name?: string;
  version?: string;
  format?: AgentSkillPackageFormat;
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
  projectId?: string;
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
  projectId?: string;
}

export interface UpsertUserAgentSkillInput {
  agentId: string;
  userAgentType: NarreUserAgentType;
  projectId?: string;
  skillId?: string;
  name: string;
  description: string;
  body: string;
}

export interface DeleteUserAgentInput {
  agentId: string;
  userAgentType: NarreUserAgentType;
  projectId?: string;
}

export interface DeleteUserAgentSkillInput extends DeleteUserAgentInput {
  skillId: string;
}

export interface BaseAgentDefinition {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
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

export interface NarreProjectUserAgentDefinition extends BaseAgentDefinition {
  kind: 'narre';
  narreAgentType: 'user';
  userAgentType: 'project';
  projectId: string;
  skills: AgentSkillRef[];
}

export type NarreUserAgentDefinition =
  | NarreGlobalUserAgentDefinition
  | NarreProjectUserAgentDefinition;

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
  projectId?: string;
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
  projectId?: string;
  title?: string | null;
  status?: AgentStatus;
  reason?: AgentAttentionReason | null;
  skillId?: SkillId | null;
  metadata?: Record<string, string>;
}

// ============================================
// Terminal Types
// ============================================

export type TerminalSessionState = 'created' | 'starting' | 'running' | 'exited';

export type AgentProvider = 'claude' | 'codex' | 'narre';
export type AgentRuntimeProvider = 'terminal' | 'claude' | 'codex' | 'openai' | 'narre';
export type AgentReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface AgentRuntimeProfile {
  provider: AgentRuntimeProvider;
  model?: string;
  reasoningEffort?: AgentReasoningEffort;
  temperature?: number;
  contextBudget?: number;
  extraInstruction?: string;
  toolProfileIds?: string[];
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

export type ConversationMode = 'direct' | 'orchestration';

export interface Conversation {
  id: string;
  projectId: string;
  mode: ConversationMode;
  title: string;
  participantAgentKeys: string[];
  activeRunId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export type OrchestrationRunStatus = 'planning' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type OrchestrationTaskStatus = 'pending' | 'assigned' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type AgentAssignmentStatus = 'pending' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type AgentApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AgentEventType =
  | 'user_message'
  | 'task_created'
  | 'task_assigned'
  | 'approval_requested'
  | 'approval_resolved'
  | 'run_completed'
  | 'task_completed'
  | 'executor_registered'
  | 'terminal_command'
  | 'agent_message'
  | 'error';

export interface OrchestrationRun {
  id: string;
  conversationId: string | null;
  projectId: string;
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
  projectId: string;
  mode?: ConversationMode;
  title?: string;
  participantAgentKeys?: string[];
  metadata?: Record<string, string>;
}

export interface CreateOrchestrationRunInput {
  projectId: string;
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
  projectId: string | null;
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

// ============================================
// Agent Runtime Types
// ============================================

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'error' | 'offline';
export type AgentAttentionReason = 'approval' | 'user_input' | 'unknown';
export type AgentUxState = 'working' | 'needs_attention' | 'idle' | 'error' | 'offline';

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

// ============================================
// Claude Code Integration Types
// ============================================

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
