export const NETIOR_SERVICE_ROUTES = {
  health: '/health',
  rpc: '/rpc',
  events: '/events',
  resourceContentPrefix: '/resources',
} as const;

export const NETIOR_RPC_METHODS = {
  systemPing: 'system.ping',
  domainSnapshot: 'domain.snapshot',

  worldCreate: 'world.create',
  worldGet: 'world.get',
  worldList: 'world.list',
  worldRename: 'world.rename',
  worldUpdateSettings: 'world.updateSettings',
  worldArchive: 'world.archive',
  worldDelete: 'world.delete',

  modelCreate: 'model.create',
  modelGet: 'model.get',
  modelList: 'model.list',
  modelRename: 'model.rename',
  modelUpdateDescription: 'model.updateDescription',
  modelMove: 'model.move',
  modelArchive: 'model.archive',
  modelDelete: 'model.delete',
  modelBindDirectory: 'model.bindDirectory',
  modelUnbindDirectory: 'model.unbindDirectory',
  modelListDirectoryBindings: 'model.listDirectoryBindings',
  modelValidateDirectoryBindings: 'model.validateDirectoryBindings',
  modelSummary: 'model.summary',
  modelListDefinitions: 'model.listDefinitions',
  modelListInstances: 'model.listInstances',
  modelListResources: 'model.listResources',
  modelListRelations: 'model.listRelations',
  modelListUnassignedResources: 'model.listUnassignedResources',

  worldNodeGetChildren: 'worldNode.getChildren',
  worldNodeGetParent: 'worldNode.getParent',
  worldNodeGetAncestors: 'worldNode.getAncestors',
  worldNodeGetDescendants: 'worldNode.getDescendants',
  worldNodeGetTree: 'worldNode.getTree',
  worldNodeMove: 'worldNode.move',
  worldNodeReorderChildren: 'worldNode.reorderChildren',
  worldNodeGetVisibleDefinitions: 'worldNode.getVisibleDefinitions',

  kindCreate: 'kind.create',
  kindGet: 'kind.get',
  kindList: 'kind.list',
  kindListVisible: 'kind.listVisible',
  kindRename: 'kind.rename',
  kindUpdateKey: 'kind.updateKey',
  kindUpdateDescription: 'kind.updateDescription',
  kindArchive: 'kind.archive',
  kindDelete: 'kind.delete',

  propertyCreate: 'property.create',
  propertyGet: 'property.get',
  propertyList: 'property.list',
  propertyRename: 'property.rename',
  propertyUpdateKey: 'property.updateKey',
  propertyUpdateDescription: 'property.updateDescription',
  propertyUpdateValueType: 'property.updateValueType',
  propertyUpdateCardinality: 'property.updateCardinality',
  propertyUpdateRequiredPolicy: 'property.updateRequiredPolicy',
  propertyReorder: 'property.reorder',
  propertyArchive: 'property.archive',
  propertyDelete: 'property.delete',

  relationKindCreate: 'relationKind.create',
  relationKindGet: 'relationKind.get',
  relationKindList: 'relationKind.list',
  relationKindListVisible: 'relationKind.listVisible',
  relationKindRename: 'relationKind.rename',
  relationKindUpdateKey: 'relationKind.updateKey',
  relationKindUpdateDescription: 'relationKind.updateDescription',
  relationKindUpdateDirected: 'relationKind.updateDirected',
  relationKindUpdateEndpointPolicy: 'relationKind.updateEndpointPolicy',
  relationKindUpdateEndpointPolicyShape: 'relationKind.updateEndpointPolicyShape',
  relationKindListEndpointPairs: 'relationKind.listEndpointPairs',
  relationKindSetEndpointPairs: 'relationKind.setEndpointPairs',
  relationKindUpdateCardinalityPolicy: 'relationKind.updateCardinalityPolicy',
  relationKindArchive: 'relationKind.archive',
  relationKindDelete: 'relationKind.delete',

  instanceCreate: 'instance.create',
  instanceGet: 'instance.get',
  instanceList: 'instance.list',
  instanceSearch: 'instance.search',
  instanceRename: 'instance.rename',
  instanceUpdateDisplayName: 'instance.updateDisplayName',
  instanceMoveHomeModel: 'instance.moveHomeModel',
  instanceArchive: 'instance.archive',
  instanceDelete: 'instance.delete',
  instanceRestore: 'instance.restore',
  instanceLinkResource: 'instance.linkResource',
  instanceUnlinkResource: 'instance.unlinkResource',
  instanceSetPrimaryResource: 'instance.setPrimaryResource',
  instanceListResources: 'instance.listResources',
  instanceAssignKind: 'instance.assignKind',
  instanceUnassignKind: 'instance.unassignKind',
  instanceListKindAssignments: 'instance.listKindAssignments',
  instanceNeighborhood: 'instance.neighborhood',

  resourceRegister: 'resource.register',
  resourceGet: 'resource.get',
  resourceList: 'resource.list',
  resourceCreateSubResource: 'resource.createSubResource',
  resourceUpdateObservedStatus: 'resource.updateObservedStatus',
  resourceUpdateFingerprint: 'resource.updateFingerprint',
  resourceArchive: 'resource.archive',
  resourceDelete: 'resource.delete',

  kindAssignmentAccept: 'kindAssignment.accept',
  kindAssignmentReject: 'kindAssignment.reject',
  kindAssignmentSupersede: 'kindAssignment.supersede',

  propertyValueCreate: 'propertyValue.create',
  propertyValueGet: 'propertyValue.get',
  propertyValueList: 'propertyValue.list',
  propertyValueUpdate: 'propertyValue.update',
  propertyValueAccept: 'propertyValue.accept',
  propertyValueReject: 'propertyValue.reject',
  propertyValueSupersede: 'propertyValue.supersede',
  propertyValueArchive: 'propertyValue.archive',
  propertyValueDelete: 'propertyValue.delete',

  relationCreate: 'relation.create',
  relationGet: 'relation.get',
  relationList: 'relation.list',
  relationAccept: 'relation.accept',
  relationReject: 'relation.reject',
  relationSupersede: 'relation.supersede',
  relationArchive: 'relation.archive',
  relationDelete: 'relation.delete',

  evidenceCreate: 'evidence.create',
  evidenceGet: 'evidence.get',
  evidenceListForTarget: 'evidence.listForTarget',
  evidenceLinkToTarget: 'evidence.linkToTarget',
  evidenceUnlinkFromTarget: 'evidence.unlinkFromTarget',
  evidenceArchive: 'evidence.archive',
  evidenceDelete: 'evidence.delete',

  decisionRecord: 'decision.record',
  decisionGet: 'decision.get',
  decisionListForTarget: 'decision.listForTarget',
  domainEventRecord: 'domainEvent.record',
  domainEventList: 'domainEvent.list',
  domainEventGet: 'domainEvent.get',
  domainEventListByTarget: 'domainEvent.listByTarget',
  worldStateGetRevision: 'worldState.getRevision',
  worldStateListEvents: 'worldState.listEvents',

  viewCreate: 'view.create',
  viewProject: 'view.project',
  viewSaveLayout: 'view.saveLayout',
  viewArchive: 'view.archive',
  viewDelete: 'view.delete',
} as const;

export type NetiorRpcMethod = typeof NETIOR_RPC_METHODS[keyof typeof NETIOR_RPC_METHODS];

export interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: TParams;
}

export interface JsonRpcSuccess<TResult = unknown> {
  jsonrpc: '2.0';
  id: string | number | null;
  result: TResult;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcErrorObject;
}

export type JsonRpcResponse<TResult = unknown> = JsonRpcSuccess<TResult> | JsonRpcFailure;

export type SourceKind = 'system' | 'user' | 'package' | 'imported';
export type WorldNodeType = 'world' | 'model';
export type ArchiveStatus = 'active' | 'archived';
export type IconType = 'lucide' | 'image' | 'none';
export type PropertyValueType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'resource-ref' | 'option';
export type PropertyCardinality = 'single' | 'multiple';
export type RequiredPolicy = 'optional' | 'required' | 'recommended';
export type RelationEndpointPolicyShape = 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
export type AssignmentStatus = 'candidate' | 'accepted' | 'rejected' | 'superseded' | 'archived';
export type ResourceSourceKind = 'file' | 'folder' | 'url' | 'service-object' | 'sub-resource' | 'inline';
export type ResourceObservedStatus = 'observed' | 'changed' | 'missing' | 'ignored' | 'archived';
export type EvidenceType = 'resource_locator' | 'user_input' | 'user_decision' | 'ai_reasoning' | 'calculation' | 'external_sync';
export type EvidenceTargetType = 'kind_assignment' | 'property_value' | 'relation_assertion';
export type EvidenceSupportType = 'supports' | 'contradicts' | 'explains' | 'source';
export type DecisionType = 'accept' | 'reject' | 'revise' | 'supersede';
export type ViewType = 'explorer' | 'canvas';
export type ViewItemKind = 'node' | 'edge';
export type CanvasSubjectType =
  | 'world'
  | 'model'
  | 'kind'
  | 'property'
  | 'relation_kind'
  | 'instance'
  | 'resource'
  | 'kind_assignment'
  | 'relation_assertion'
  | 'resource_mapping'
  | 'note';
export type CanvasMode = 'browse' | 'edit';
export type CanvasNodeEvent =
  | 'click'
  | 'double_click'
  | 'hover'
  | 'context_menu'
  | 'drag_start'
  | 'drag'
  | 'drop'
  | 'resize';
export type CanvasActionHandler = 'view_command' | 'open_editor' | 'domain_operation';
export type CanvasInteractionBehavior = 'execute' | 'select' | 'open_menu' | 'show_preview' | 'show_toolbar';
export type ViewItemSubjectType = CanvasSubjectType | 'relation_kind_edge' | 'model_parent';

export interface SourceFields {
  source_kind: SourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
}

export interface IconFields {
  icon_type: IconType;
  icon_key: string | null;
  icon_resource_id: string | null;
}

export interface WorldNodeRecord {
  id: string;
  parent_id: string | null;
  root_id: string;
  node_type: WorldNodeType;
  key: string;
  name: string;
  description: string | null;
  root_uri: string | null;
  sort_order: number;
  status: ArchiveStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export type WorldRecord = WorldNodeRecord & {
  node_type: 'world';
  parent_id: null;
  root_uri: string;
};

export type ModelRecord = WorldNodeRecord & {
  node_type: 'model';
  parent_id: string;
};

export interface ModelDirectoryBindingRecord {
  id: string;
  model_id: string;
  root_id: string;
  relative_path: string;
  created_at: string;
}

export interface KindRecord extends SourceFields, IconFields {
  id: string;
  model_id: string;
  key: string;
  name: string;
  description: string | null;
  status: ArchiveStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface PropertyRecord {
  id: string;
  kind_id: string;
  key: string;
  name: string;
  description: string | null;
  value_type: PropertyValueType;
  cardinality: PropertyCardinality;
  required_policy: RequiredPolicy;
  sort_order: number;
  status: ArchiveStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface RelationKindRecord extends SourceFields, IconFields {
  id: string;
  model_id: string;
  key: string;
  name: string;
  description: string | null;
  directed: number;
  subject_kind_policy: string | null;
  object_kind_policy: string | null;
  cardinality_policy: string | null;
  endpoint_policy_shape: RelationEndpointPolicyShape;
  status: ArchiveStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface RelationKindEndpointPairRecord {
  id: string;
  relation_kind_id: string;
  subject_kind_id: string;
  object_kind_id: string;
  created_at: string;
}

export interface InstanceRecord extends IconFields {
  id: string;
  home_model_id: string;
  key: string;
  display_name: string;
  status: ArchiveStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ResourceRecord {
  id: string;
  root_id: string;
  source_kind: ResourceSourceKind;
  source_uri: string | null;
  relative_path: string | null;
  parent_resource_id: string | null;
  locator: string | null;
  handler_key: string | null;
  fingerprint: string | null;
  observed_status: ResourceObservedStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface InstanceResourceLinkRecord {
  id: string;
  instance_id: string;
  resource_id: string;
  is_primary: number;
  created_at: string;
}

export interface KindAssignmentRecord {
  id: string;
  instance_id: string;
  kind_id: string;
  status: AssignmentStatus;
  created_by: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface PropertyValueRecord {
  id: string;
  instance_id: string;
  property_id: string;
  value_json: string | null;
  status: AssignmentStatus;
  created_by: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface RelationAssertionRecord {
  id: string;
  subject_instance_id: string;
  subject_kind_id: string | null;
  relation_kind_id: string;
  object_instance_id: string;
  object_kind_id: string | null;
  status: AssignmentStatus;
  created_by: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface EvidenceRecord {
  id: string;
  evidence_type: EvidenceType;
  resource_id: string | null;
  locator: string | null;
  summary: string | null;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface EvidenceLinkRecord {
  id: string;
  evidence_id: string;
  target_type: EvidenceTargetType;
  target_id: string;
  support_type: EvidenceSupportType;
}

export interface DecisionRecord {
  id: string;
  target_type: EvidenceTargetType;
  target_id: string;
  decision_type: DecisionType;
  decided_status: AssignmentStatus;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DomainEventRecord {
  id: string;
  root_id: string;
  model_id: string | null;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  payload_json: string | null;
  created_by: string | null;
  created_at: string;
  revision: number;
}

export interface ViewRecord extends SourceFields {
  id: string;
  owner_model_id: string;
  type: ViewType;
  name: string;
  description: string | null;
  config_json: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CanvasActionParamBinding {
  key: string;
  from: string;
}

export interface CanvasNodeAction {
  key: string;
  label: string;
  icon?: string;
  handler: CanvasActionHandler;
  operationKey?: NetiorRpcMethod;
  params?: CanvasActionParamBinding[];
  confirmation?: {
    required: boolean;
    title?: string;
    message?: string;
  };
}

export interface CanvasInteractionBinding {
  event: CanvasNodeEvent;
  mode: CanvasMode;
  actionKey: string;
  behavior: CanvasInteractionBehavior;
  preventDefault?: boolean;
}

export interface CanvasNodeTypeRecord extends SourceFields {
  id: string;
  owner_model_id: string | null;
  key: string;
  name: string;
  description: string | null;
  allowed_subjects_json: string;
  renderer_key: string;
  fields_json: string;
  actions_json: string;
  interactions_json: string;
  default_size_json: string;
  default_style_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanvasEdgeTypeRecord extends SourceFields {
  id: string;
  owner_model_id: string | null;
  key: string;
  name: string;
  description: string | null;
  allowed_subjects_json: string;
  renderer_key: string;
  label_fields_json: string;
  actions_json: string;
  interactions_json: string;
  default_style_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViewItemRecord {
  id: string;
  view_id: string;
  item_kind: ViewItemKind;
  subject_type: ViewItemSubjectType;
  subject_id: string | null;
  subject_model_id: string | null;
  type_id: string | null;
  parent_item_id: string | null;
  layout_json: string | null;
  state_json: string | null;
  overrides_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainSnapshot {
  worldNodes: WorldNodeRecord[];
  directoryBindings: ModelDirectoryBindingRecord[];
  kinds: KindRecord[];
  properties: PropertyRecord[];
  relationKinds: RelationKindRecord[];
  relationKindEndpointPairs: RelationKindEndpointPairRecord[];
  instances: InstanceRecord[];
  resources: ResourceRecord[];
  instanceResourceLinks: InstanceResourceLinkRecord[];
  kindAssignments: KindAssignmentRecord[];
  propertyValues: PropertyValueRecord[];
  relations: RelationAssertionRecord[];
  evidence: EvidenceRecord[];
  evidenceLinks: EvidenceLinkRecord[];
  decisions: DecisionRecord[];
  domainEvents: DomainEventRecord[];
  views: ViewRecord[];
  canvasNodeTypes: CanvasNodeTypeRecord[];
  canvasEdgeTypes: CanvasEdgeTypeRecord[];
  viewItems: ViewItemRecord[];
}

export interface NetiorServiceEvent {
  eventId: string;
  operationId: string | null;
  rootId: string | null;
  type: 'service.ready' | 'heartbeat' | 'domain.changed' | 'resource.content.changed';
  entity: string | null;
  action: string | null;
  id: string | null;
  revision: number;
  timestamp: string;
  payload?: unknown;
}
