import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type {
  AssignmentStatus,
  CanvasEdgeTypeRecord,
  CanvasNodeTypeRecord,
  CanvasSubjectType,
  DecisionRecord,
  DomainEventRecord,
  DomainSnapshot,
  EvidenceLinkRecord,
  EvidenceRecord,
  InstanceRecord,
  InstanceResourceLinkRecord,
  KindAssignmentRecord,
  KindRecord,
  ModelDirectoryBindingRecord,
  ModelRecord,
  PropertyRecord,
  PropertyValueRecord,
  RelationEndpointPolicyShape,
  RelationAssertionRecord,
  RelationKindEndpointPairRecord,
  RelationKindRecord,
  ResourceRecord,
  ViewItemRecord,
  ViewRecord,
  WorldNodeRecord,
  WorldRecord,
} from '@netior/shared';
import { getDatabase } from './connection';

type TableName =
  | 'world_nodes'
  | 'model_directory_bindings'
  | 'kinds'
  | 'properties'
  | 'relation_kinds'
  | 'relation_kind_endpoint_pairs'
  | 'instances'
  | 'resources'
  | 'instance_resource_links'
  | 'kind_assignments'
  | 'property_values'
  | 'relation_assertions'
  | 'evidence_records'
  | 'evidence_links'
  | 'decisions'
  | 'domain_events'
  | 'views'
  | 'canvas_node_types'
  | 'canvas_edge_types'
  | 'view_items';

type RecordForTable<TTable extends TableName> =
  TTable extends 'world_nodes' ? WorldNodeRecord :
  TTable extends 'model_directory_bindings' ? ModelDirectoryBindingRecord :
  TTable extends 'kinds' ? KindRecord :
  TTable extends 'properties' ? PropertyRecord :
  TTable extends 'relation_kinds' ? RelationKindRecord :
  TTable extends 'relation_kind_endpoint_pairs' ? RelationKindEndpointPairRecord :
  TTable extends 'instances' ? InstanceRecord :
  TTable extends 'resources' ? ResourceRecord :
  TTable extends 'instance_resource_links' ? InstanceResourceLinkRecord :
  TTable extends 'kind_assignments' ? KindAssignmentRecord :
  TTable extends 'property_values' ? PropertyValueRecord :
  TTable extends 'relation_assertions' ? RelationAssertionRecord :
  TTable extends 'evidence_records' ? EvidenceRecord :
  TTable extends 'evidence_links' ? EvidenceLinkRecord :
  TTable extends 'decisions' ? DecisionRecord :
  TTable extends 'domain_events' ? DomainEventRecord :
  TTable extends 'views' ? ViewRecord :
  TTable extends 'canvas_node_types' ? CanvasNodeTypeRecord :
  TTable extends 'canvas_edge_types' ? CanvasEdgeTypeRecord :
  TTable extends 'view_items' ? ViewItemRecord :
  never;

type TimestampMode = 'both' | 'created' | 'none';

export class DomainValidationError extends Error {
  constructor(message: string, readonly code = 'DOMAIN_VALIDATION') {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export class DomainNotFoundError extends Error {
  constructor(message: string, readonly code = 'DOMAIN_NOT_FOUND') {
    super(message);
    this.name = 'DomainNotFoundError';
  }
}

export const DOMAIN_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function assertDomainKey(key: string, name = 'key'): string {
  if (!DOMAIN_KEY_PATTERN.test(key)) {
    throw new DomainValidationError(`${name} must be non-empty, start with a lowercase letter or digit, and contain only lowercase letters, digits, underscores, or hyphens`);
  }
  return key;
}

const RELATION_ENDPOINT_POLICY_SHAPES = new Set<RelationEndpointPolicyShape>([
  'one_to_one',
  'one_to_many',
  'many_to_one',
  'many_to_many',
]);

export function assertRelationEndpointPolicyShape(
  shape: string,
  directed: boolean | number,
): RelationEndpointPolicyShape {
  if (!RELATION_ENDPOINT_POLICY_SHAPES.has(shape as RelationEndpointPolicyShape)) {
    throw new DomainValidationError('relation endpoint policy shape must be one_to_one, one_to_many, many_to_one, or many_to_many');
  }
  if (!truthy(directed) && shape === 'many_to_one') {
    throw new DomainValidationError('undirected relation endpoint policy shape cannot be many_to_one');
  }
  return shape as RelationEndpointPolicyShape;
}

export function listWorlds(): WorldRecord[] {
  return getDatabase()
    .prepare("SELECT * FROM world_nodes WHERE node_type = 'world' AND status = 'active' ORDER BY created_at")
    .all() as WorldRecord[];
}

export function getWorld(id: string): WorldRecord | null {
  const record = getWorldNode(id);
  return record?.node_type === 'world' ? record as WorldRecord : null;
}

export function createWorld(data: { key?: string; name: string; root_uri: string; description?: string | null }): WorldRecord {
  ensureBuiltInCanvasTypes();
  const id = randomUUID();
  const timestamp = now();
  const rootUri = data.root_uri;
  if (!rootUri) throw new DomainValidationError('World root_uri is required');

  getDatabase()
    .prepare(
      `INSERT INTO world_nodes (
        id, parent_id, root_id, node_type, key, name, description, root_uri,
        sort_order, status, created_at, updated_at, archived_at
      ) VALUES (?, NULL, ?, 'world', ?, ?, ?, ?, 0, 'active', ?, ?, NULL)`,
    )
    .run(id, id, data.key === undefined ? slugKey(data.name) : assertDomainKey(data.key, 'world key'), data.name, data.description ?? null, rootUri, timestamp, timestamp);
  return requireWorld(id);
}

export function updateWorld(
  id: string,
  data: Partial<Pick<WorldNodeRecord, 'key' | 'name' | 'description' | 'root_uri'>>,
): WorldRecord {
  requireWorld(id);
  if (data.key !== undefined) assertDomainKey(data.key, 'world key');
  return updateRecord('world_nodes', id, data) as WorldRecord;
}

export function renameWorld(id: string, name: string): WorldRecord {
  return updateWorld(id, { name });
}

export function archiveWorld(id: string): WorldRecord {
  return archiveWorldNode(id) as WorldRecord;
}

export function deleteWorld(id: string): boolean {
  return deleteRecord('world_nodes', id);
}

export function getWorldNode(id: string): WorldNodeRecord | null {
  return getRecord('world_nodes', id);
}

export function listWorldNodeChildren(parentId: string): WorldNodeRecord[] {
  return listRecords('world_nodes', { parent_id: parentId, status: 'active' }, 'sort_order, name, created_at');
}

export function getWorldNodeParent(id: string): WorldNodeRecord | null {
  const node = requireWorldNode(id);
  return node.parent_id ? getWorldNode(node.parent_id) : null;
}

export function getWorldNodeAncestors(id: string): WorldNodeRecord[] {
  const ancestors: WorldNodeRecord[] = [];
  let current = getWorldNodeParent(id);
  while (current) {
    ancestors.unshift(current);
    current = current.parent_id ? getWorldNode(current.parent_id) : null;
  }
  return ancestors;
}

export function getWorldNodeDescendants(id: string): WorldNodeRecord[] {
  const descendants: WorldNodeRecord[] = [];
  const visit = (nodeId: string): void => {
    for (const child of listWorldNodeChildren(nodeId)) {
      descendants.push(child);
      visit(child.id);
    }
  };
  visit(id);
  return descendants;
}

export interface WorldNodeTree extends WorldNodeRecord {
  children: WorldNodeTree[];
}

export function getWorldNodeTree(rootId: string): WorldNodeTree | null {
  const root = getWorldNode(rootId);
  if (!root) return null;
  const build = (node: WorldNodeRecord): WorldNodeTree => ({
    ...node,
    children: listWorldNodeChildren(node.id).map(build),
  });
  return build(root);
}

export function moveWorldNode(id: string, parentId: string): WorldNodeRecord {
  const node = requireModel(id);
  const parent = requireWorldNode(parentId);
  if (parent.root_id !== node.root_id) {
    throw new DomainValidationError('Model cannot move across world roots');
  }
  if (getWorldNodeDescendants(id).some((descendant) => descendant.id === parentId)) {
    throw new DomainValidationError('Model cannot move under its descendant');
  }
  return updateRecord('world_nodes', id, { parent_id: parentId });
}

export function reorderWorldNodeChildren(parentId: string, orderedIds: string[]): WorldNodeRecord[] {
  requireWorldNode(parentId);
  const database = getDatabase();
  const timestamp = now();
  database.transaction(() => {
    orderedIds.forEach((id, index) => {
      database
        .prepare('UPDATE world_nodes SET sort_order = ?, updated_at = ? WHERE id = ? AND parent_id = ?')
        .run(index, timestamp, id, parentId);
    });
  })();
  return listWorldNodeChildren(parentId);
}

export function listModels(rootId: string): ModelRecord[] {
  return getDatabase()
    .prepare("SELECT * FROM world_nodes WHERE root_id = ? AND node_type = 'model' AND status = 'active' ORDER BY sort_order, name")
    .all(rootId) as ModelRecord[];
}

export function getModel(id: string): ModelRecord | null {
  const record = getWorldNode(id);
  return record?.node_type === 'model' ? record as ModelRecord : null;
}

export function createModel(data: {
  parent_id?: string;
  world_id?: string;
  root_id?: string;
  key?: string;
  name: string;
  description?: string | null;
}): ModelRecord {
  ensureBuiltInCanvasTypes();
  const parentId = data.parent_id ?? data.world_id ?? data.root_id;
  if (!parentId) throw new DomainValidationError('Model parent_id is required');
  const parent = requireWorldNode(parentId);
  const timestamp = now();
  const id = randomUUID();
  const key = uniqueWorldNodeKey(parent.root_id, parent.id, data.key === undefined ? slugKey(data.name) : assertDomainKey(data.key, 'model key'));
  getDatabase()
    .prepare(
      `INSERT INTO world_nodes (
        id, parent_id, root_id, node_type, key, name, description, root_uri,
        sort_order, status, created_at, updated_at, archived_at
      ) VALUES (?, ?, ?, 'model', ?, ?, ?, NULL, ?, 'active', ?, ?, NULL)`,
    )
    .run(id, parent.id, parent.root_id, key, data.name, data.description ?? null, nextSortOrder(parent.id), timestamp, timestamp);
  ensureDefaultViewsForModel(id);
  return requireModel(id);
}

export function updateModel(
  id: string,
  data: Partial<Pick<WorldNodeRecord, 'key' | 'name' | 'description' | 'sort_order' | 'parent_id'>>,
): ModelRecord {
  requireModel(id);
  if (data.key !== undefined) assertDomainKey(data.key, 'model key');
  if (data.parent_id) {
    moveWorldNode(id, data.parent_id);
  }
  const { parent_id: _parentId, ...rest } = data;
  return updateRecord('world_nodes', id, rest) as ModelRecord;
}

export function renameModel(id: string, name: string): ModelRecord {
  return updateModel(id, { name });
}

export function archiveModel(id: string): ModelRecord {
  return archiveWorldNode(id) as ModelRecord;
}

export function deleteModel(id: string): boolean {
  return deleteRecord('world_nodes', id);
}

export function bindModelDirectory(data: { model_id: string; relative_path?: string; path?: string }): ModelDirectoryBindingRecord {
  const model = requireWorldNode(data.model_id);
  const relativePath = normalizeRelativePath(data.relative_path ?? data.path ?? '');
  if (!relativePath) throw new DomainValidationError('Directory relative_path is required');
  return insertRecord('model_directory_bindings', {
    model_id: model.id,
    root_id: model.root_id,
    relative_path: relativePath,
  }, 'created');
}

export const createModelDirectoryBinding = bindModelDirectory;

export function listModelDirectoryBindings(modelId: string): ModelDirectoryBindingRecord[] {
  return listRecords('model_directory_bindings', { model_id: modelId }, 'relative_path, created_at');
}

export function unbindModelDirectory(id: string): boolean {
  return deleteRecord('model_directory_bindings', id);
}

export const deleteModelDirectoryBinding = unbindModelDirectory;

export function validateModelDirectoryBindings(rootId: string): { valid: boolean; conflicts: string[] } {
  const bindings = listRecords('model_directory_bindings', { root_id: rootId }, 'relative_path');
  const conflicts: string[] = [];
  for (let index = 0; index < bindings.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < bindings.length; otherIndex += 1) {
      const left = bindings[index];
      const right = bindings[otherIndex];
      if (pathsOverlap(left.relative_path, right.relative_path)) {
        conflicts.push(`${left.relative_path} overlaps ${right.relative_path}`);
      }
    }
  }
  return { valid: conflicts.length === 0, conflicts };
}

export function listKinds(modelId: string): KindRecord[] {
  return listRecords('kinds', { model_id: modelId, status: 'active' }, 'created_at');
}

export function listVisibleKinds(modelId: string): KindRecord[] {
  const nodeIds = visibleNodeIds(modelId);
  return rowsWhereIn<KindRecord>('kinds', 'model_id', nodeIds, "status = 'active'", 'created_at');
}

export function getKind(id: string): KindRecord | null {
  return getRecord('kinds', id);
}

export function createKind(data: Partial<KindRecord> & Pick<KindRecord, 'model_id' | 'key' | 'name'>): KindRecord {
  requireWorldNode(data.model_id);
  return insertRecord('kinds', {
    model_id: data.model_id,
    key: assertDomainKey(data.key, 'kind key'),
    name: data.name,
    description: data.description ?? null,
    icon_type: data.icon_type ?? 'none',
    icon_key: data.icon_key ?? null,
    icon_resource_id: data.icon_resource_id ?? null,
    source_kind: data.source_kind ?? 'user',
    source_id: data.source_id ?? null,
    source_ref: data.source_ref ?? null,
    source_version: data.source_version ?? null,
    status: 'active',
    archived_at: null,
  });
}

export function updateKind(id: string, data: Partial<Omit<KindRecord, 'id' | 'created_at' | 'updated_at'>>): KindRecord {
  if (data.key !== undefined) assertDomainKey(data.key, 'kind key');
  return updateRecord('kinds', id, data);
}

export function archiveKind(id: string): KindRecord {
  return archiveRecord('kinds', id);
}

export const deleteKind = (id: string): boolean => deleteRecord('kinds', id);

export function listProperties(kindId: string): PropertyRecord[] {
  return listRecords('properties', { kind_id: kindId, status: 'active' }, 'sort_order, created_at');
}

export function getProperty(id: string): PropertyRecord | null {
  return getRecord('properties', id);
}

export function createProperty(data: Partial<PropertyRecord> & Pick<PropertyRecord, 'kind_id' | 'key' | 'name' | 'value_type'>): PropertyRecord {
  requireRecord('kinds', data.kind_id);
  return insertRecord('properties', {
    kind_id: data.kind_id,
    key: assertDomainKey(data.key, 'property key'),
    name: data.name,
    description: data.description ?? null,
    value_type: data.value_type,
    cardinality: data.cardinality ?? 'single',
    required_policy: data.required_policy ?? 'optional',
    sort_order: data.sort_order ?? 0,
    status: 'active',
    archived_at: null,
  });
}

export function updateProperty(id: string, data: Partial<Omit<PropertyRecord, 'id' | 'created_at' | 'updated_at'>>): PropertyRecord {
  if (data.key !== undefined) assertDomainKey(data.key, 'property key');
  return updateRecord('properties', id, data);
}

export function archiveProperty(id: string): PropertyRecord {
  return archiveRecord('properties', id);
}

export const deleteProperty = (id: string): boolean => deleteRecord('properties', id);

export function reorderProperties(kindId: string, orderedIds: string[]): PropertyRecord[] {
  requireRecord('kinds', kindId);
  updateSortOrder('properties', 'kind_id', kindId, orderedIds);
  return listProperties(kindId);
}

export function listRelationKinds(modelId: string): RelationKindRecord[] {
  return listRecords('relation_kinds', { model_id: modelId, status: 'active' }, 'created_at');
}

export function listVisibleRelationKinds(modelId: string): RelationKindRecord[] {
  const nodeIds = visibleNodeIds(modelId);
  return rowsWhereIn<RelationKindRecord>('relation_kinds', 'model_id', nodeIds, "status = 'active'", 'created_at');
}

export function getRelationKind(id: string): RelationKindRecord | null {
  return getRecord('relation_kinds', id);
}

export function createRelationKind(data: Partial<RelationKindRecord> & Pick<RelationKindRecord, 'model_id' | 'key' | 'name'>): RelationKindRecord {
  requireWorldNode(data.model_id);
  const directed = data.directed === undefined ? 1 : truthy(data.directed);
  return insertRecord('relation_kinds', {
    model_id: data.model_id,
    key: assertDomainKey(data.key, 'relation kind key'),
    name: data.name,
    description: data.description ?? null,
    icon_type: data.icon_type ?? 'none',
    icon_key: data.icon_key ?? null,
    icon_resource_id: data.icon_resource_id ?? null,
    directed,
    subject_kind_policy: data.subject_kind_policy ?? null,
    object_kind_policy: data.object_kind_policy ?? null,
    cardinality_policy: data.cardinality_policy ?? null,
    endpoint_policy_shape: assertRelationEndpointPolicyShape(data.endpoint_policy_shape ?? 'many_to_many', directed),
    source_kind: data.source_kind ?? 'user',
    source_id: data.source_id ?? null,
    source_ref: data.source_ref ?? null,
    source_version: data.source_version ?? null,
    status: 'active',
    archived_at: null,
  });
}

export function updateRelationKind(id: string, data: Partial<Omit<RelationKindRecord, 'id' | 'created_at' | 'updated_at'>>): RelationKindRecord {
  const current = requireRecord('relation_kinds', id);
  if (data.key !== undefined) assertDomainKey(data.key, 'relation kind key');
  const update = normalizeBooleanFields(data, ['directed']);
  if (update.directed !== undefined || update.endpoint_policy_shape !== undefined) {
    assertRelationEndpointPolicyShape(
      update.endpoint_policy_shape ?? current.endpoint_policy_shape,
      update.directed ?? current.directed,
    );
  }
  return updateRecord('relation_kinds', id, update);
}

export function archiveRelationKind(id: string): RelationKindRecord {
  return archiveRecord('relation_kinds', id);
}

export const deleteRelationKind = (id: string): boolean => deleteRecord('relation_kinds', id);

export interface RelationKindEndpointPairInput {
  subject_kind_id?: string;
  subjectKindId?: string;
  subject_kind_key?: string;
  subjectKindKey?: string;
  object_kind_id?: string;
  objectKindId?: string;
  object_kind_key?: string;
  objectKindKey?: string;
}

export interface RelationKindEndpointPairView extends RelationKindEndpointPairRecord {
  subject_kind_key: string;
  subject_kind_name: string;
  object_kind_key: string;
  object_kind_name: string;
}

export function listRelationKindEndpointPairs(relationKindId: string): RelationKindEndpointPairView[] {
  requireRecord('relation_kinds', relationKindId);
  return getDatabase()
    .prepare(
      `SELECT pairs.*,
              subject.key AS subject_kind_key,
              subject.name AS subject_kind_name,
              object.key AS object_kind_key,
              object.name AS object_kind_name
         FROM relation_kind_endpoint_pairs pairs
         JOIN kinds subject ON subject.id = pairs.subject_kind_id
         JOIN kinds object ON object.id = pairs.object_kind_id
        WHERE pairs.relation_kind_id = ?
        ORDER BY subject.key, object.key, pairs.created_at`,
    )
    .all(relationKindId) as RelationKindEndpointPairView[];
}

export function setRelationKindEndpointPairs(
  relationKindId: string,
  pairs: RelationKindEndpointPairInput[],
): RelationKindEndpointPairView[] {
  const relationKind = requireRecord('relation_kinds', relationKindId);
  const timestamp = now();
  const rows = pairs.map((pair) => ({
    id: randomUUID(),
    relation_kind_id: relationKind.id,
    subject_kind_id: resolveRelationEndpointKind(relationKind, pair.subject_kind_id ?? pair.subjectKindId, pair.subject_kind_key ?? pair.subjectKindKey, 'subject'),
    object_kind_id: resolveRelationEndpointKind(relationKind, pair.object_kind_id ?? pair.objectKindId, pair.object_kind_key ?? pair.objectKindKey, 'object'),
    created_at: timestamp,
  }));

  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.subject_kind_id}:${row.object_kind_id}`;
    if (seen.has(key)) {
      throw new DomainValidationError('Duplicate relation kind endpoint pair');
    }
    seen.add(key);
  }

  getDatabase().transaction(() => {
    getDatabase()
      .prepare('DELETE FROM relation_kind_endpoint_pairs WHERE relation_kind_id = ?')
      .run(relationKind.id);
    const insert = getDatabase().prepare(
      `INSERT INTO relation_kind_endpoint_pairs (
        id, relation_kind_id, subject_kind_id, object_kind_id, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const row of rows) {
      insert.run(row.id, row.relation_kind_id, row.subject_kind_id, row.object_kind_id, row.created_at);
    }
  })();

  return listRelationKindEndpointPairs(relationKind.id);
}

export function listInstances(modelId: string): InstanceRecord[] {
  return listRecords('instances', { home_model_id: modelId, status: 'active' }, 'display_name, created_at');
}

export function searchInstances(modelId: string, query: string): InstanceRecord[] {
  return getDatabase()
    .prepare("SELECT * FROM instances WHERE home_model_id = ? AND status = 'active' AND display_name LIKE ? ORDER BY updated_at DESC")
    .all(modelId, `%${query}%`) as InstanceRecord[];
}

export function getInstance(id: string): InstanceRecord | null {
  return getRecord('instances', id);
}

export function createInstance(data: Partial<InstanceRecord> & { home_model_id?: string; model_id?: string; key?: string; display_name?: string; title?: string }): InstanceRecord {
  const homeModelId = data.home_model_id ?? data.model_id;
  if (!homeModelId) throw new DomainValidationError('Instance home_model_id is required');
  requireWorldNode(homeModelId);
  const displayName = data.display_name ?? data.title;
  if (!displayName) throw new DomainValidationError('Instance display_name is required');
  return insertRecord('instances', {
    home_model_id: homeModelId,
    key: data.key === undefined ? slugKey(displayName) : assertDomainKey(data.key, 'instance key'),
    display_name: displayName,
    icon_type: data.icon_type ?? 'none',
    icon_key: data.icon_key ?? null,
    icon_resource_id: data.icon_resource_id ?? null,
    status: 'active',
    archived_at: null,
  });
}

export function updateInstance(id: string, data: Partial<Omit<InstanceRecord, 'id' | 'created_at' | 'updated_at'>> & { title?: string }): InstanceRecord {
  const update = {
    ...data,
    display_name: data.display_name ?? data.title,
  };
  delete update.title;
  if (update.key !== undefined) assertDomainKey(update.key, 'instance key');
  if (update.home_model_id) validateInstanceAssignmentsVisible(id, update.home_model_id);
  return updateRecord('instances', id, update);
}

export function renameInstance(id: string, displayName: string): InstanceRecord {
  return updateInstance(id, { display_name: displayName });
}

export function archiveInstance(id: string): InstanceRecord {
  return archiveRecord('instances', id);
}

export function restoreInstance(id: string): InstanceRecord {
  return updateRecord('instances', id, { status: 'active', archived_at: null });
}

export const deleteInstance = (id: string): boolean => deleteRecord('instances', id);

export function assignKind(data: Partial<KindAssignmentRecord> & Pick<KindAssignmentRecord, 'instance_id' | 'kind_id'>): KindAssignmentRecord {
  assertKindVisibleToInstance(data.instance_id, data.kind_id);
  return insertRecord('kind_assignments', {
    instance_id: data.instance_id,
    kind_id: data.kind_id,
    status: data.status ?? 'candidate',
    created_by: data.created_by ?? null,
    decided_at: data.decided_at ?? null,
  }, 'created');
}

export const createKindAssignment = assignKind;

export function listKindAssignments(instanceId: string): KindAssignmentRecord[] {
  return listRecords('kind_assignments', { instance_id: instanceId }, 'created_at');
}

export function unassignKind(id: string): boolean {
  return deleteRecord('kind_assignments', id);
}

export const deleteKindAssignment = unassignKind;

export function acceptKindAssignment(id: string): KindAssignmentRecord {
  return updateAssignmentStatus('kind_assignments', id, 'accepted');
}

export function rejectKindAssignment(id: string): KindAssignmentRecord {
  return updateAssignmentStatus('kind_assignments', id, 'rejected');
}

export function supersedeKindAssignment(id: string): KindAssignmentRecord {
  return updateAssignmentStatus('kind_assignments', id, 'superseded');
}

export function createPropertyValue(data: Partial<PropertyValueRecord> & Pick<PropertyValueRecord, 'instance_id' | 'property_id'>): PropertyValueRecord {
  assertPropertyCompatibleWithInstance(data.instance_id, data.property_id);
  return insertRecord('property_values', {
    instance_id: data.instance_id,
    property_id: data.property_id,
    value_json: data.value_json ?? null,
    status: data.status ?? 'candidate',
    created_by: data.created_by ?? null,
    decided_at: data.decided_at ?? null,
  }, 'created');
}

export function listPropertyValues(instanceId: string): PropertyValueRecord[] {
  return listRecords('property_values', { instance_id: instanceId }, 'created_at');
}

export function getPropertyValue(id: string): PropertyValueRecord | null {
  return getRecord('property_values', id);
}

export function updatePropertyValue(id: string, data: Partial<Pick<PropertyValueRecord, 'value_json' | 'status' | 'created_by' | 'decided_at'>>): PropertyValueRecord {
  return updateRecord('property_values', id, data);
}

export const setPropertyValue = createPropertyValue;
export const archivePropertyValue = (id: string): PropertyValueRecord => updateAssignmentStatus('property_values', id, 'archived');
export const deletePropertyValue = (id: string): boolean => deleteRecord('property_values', id);
export const acceptPropertyValue = (id: string): PropertyValueRecord => updateAssignmentStatus('property_values', id, 'accepted');
export const rejectPropertyValue = (id: string): PropertyValueRecord => updateAssignmentStatus('property_values', id, 'rejected');
export const supersedePropertyValue = (id: string): PropertyValueRecord => updateAssignmentStatus('property_values', id, 'superseded');

export function listResources(rootId: string): ResourceRecord[] {
  return listRecords('resources', { root_id: rootId }, 'relative_path, created_at');
}

export function getResource(id: string): ResourceRecord | null {
  return getRecord('resources', id);
}

export function registerResource(data: Partial<ResourceRecord> & { root_id?: string; world_id?: string; kind?: string; uri?: string | null; path?: string | null }): ResourceRecord {
  const rootId = data.root_id ?? data.world_id;
  if (!rootId) throw new DomainValidationError('Resource root_id is required');
  requireWorld(rootId);
  return insertRecord('resources', {
    root_id: rootId,
    source_kind: data.source_kind ?? (data.kind === 'url' ? 'url' : data.kind === 'external' ? 'service-object' : 'file'),
    source_uri: data.source_uri ?? data.uri ?? null,
    relative_path: data.relative_path ?? data.path ?? null,
    parent_resource_id: data.parent_resource_id ?? null,
    locator: data.locator ?? null,
    handler_key: data.handler_key ?? null,
    fingerprint: data.fingerprint ?? null,
    observed_status: data.observed_status ?? 'observed',
    archived_at: null,
  });
}

export const createResource = registerResource;

export function createSubResource(data: Partial<ResourceRecord> & Pick<ResourceRecord, 'parent_resource_id'>): ResourceRecord {
  if (!data.parent_resource_id) throw new DomainValidationError('Sub-resource parent_resource_id is required');
  const parent = requireRecord('resources', data.parent_resource_id);
  return registerResource({
    ...data,
    root_id: parent.root_id,
    source_kind: 'sub-resource',
  });
}

export function updateResource(id: string, data: Partial<Omit<ResourceRecord, 'id' | 'created_at' | 'updated_at'>>): ResourceRecord {
  return updateRecord('resources', id, data);
}

export function updateResourceObservedStatus(id: string, observed_status: ResourceRecord['observed_status']): ResourceRecord {
  return updateResource(id, { observed_status });
}

export function updateResourceFingerprint(id: string, fingerprint: string | null): ResourceRecord {
  return updateResource(id, { fingerprint });
}

export function archiveResource(id: string): ResourceRecord {
  return updateRecord('resources', id, { observed_status: 'archived', archived_at: now() });
}

export const deleteResource = (id: string): boolean => deleteRecord('resources', id);

export function linkInstanceResource(data: Partial<InstanceResourceLinkRecord> & Pick<InstanceResourceLinkRecord, 'instance_id' | 'resource_id'>): InstanceResourceLinkRecord {
  const instance = requireRecord('instances', data.instance_id);
  const resource = requireRecord('resources', data.resource_id);
  if (rootIdForNode(instance.home_model_id) !== resource.root_id) {
    throw new DomainValidationError('Instance and resource must belong to the same world');
  }
  if (data.is_primary) clearPrimaryResourceLink(data.instance_id);
  return insertRecord('instance_resource_links', {
    instance_id: data.instance_id,
    resource_id: data.resource_id,
    is_primary: truthy(data.is_primary),
  }, 'created');
}

export const createInstanceResourceLink = linkInstanceResource;

export function unlinkInstanceResource(id: string): boolean {
  return deleteRecord('instance_resource_links', id);
}

export const deleteInstanceResourceLink = unlinkInstanceResource;

export function setPrimaryResource(instanceId: string, resourceId: string): InstanceResourceLinkRecord {
  clearPrimaryResourceLink(instanceId);
  const existing = getDatabase()
    .prepare('SELECT * FROM instance_resource_links WHERE instance_id = ? AND resource_id = ?')
    .get(instanceId, resourceId) as InstanceResourceLinkRecord | undefined;
  if (existing) {
    return updateRecord('instance_resource_links', existing.id, { is_primary: 1 });
  }
  return linkInstanceResource({ instance_id: instanceId, resource_id: resourceId, is_primary: 1 });
}

export function listInstanceResources(instanceId: string): InstanceResourceLinkRecord[] {
  return listRecords('instance_resource_links', { instance_id: instanceId }, 'is_primary DESC, created_at');
}

export const listInstanceResourceLinks = listInstanceResources;

export function createRelation(data: Partial<RelationAssertionRecord> & Pick<RelationAssertionRecord, 'subject_instance_id' | 'relation_kind_id' | 'object_instance_id'>): RelationAssertionRecord {
  const subjectKindId = data.subject_kind_id;
  const objectKindId = data.object_kind_id;
  if (!subjectKindId) throw new DomainValidationError('Relation subject_kind_id is required');
  if (!objectKindId) throw new DomainValidationError('Relation object_kind_id is required');
  validateRelationEndpointKinds(data.subject_instance_id, subjectKindId, data.relation_kind_id, data.object_instance_id, objectKindId);
  return insertRecord('relation_assertions', {
    subject_instance_id: data.subject_instance_id,
    subject_kind_id: subjectKindId,
    relation_kind_id: data.relation_kind_id,
    object_instance_id: data.object_instance_id,
    object_kind_id: objectKindId,
    status: data.status ?? 'candidate',
    created_by: data.created_by ?? null,
    decided_at: data.decided_at ?? null,
  }, 'created');
}

export const createRelationAssertion = createRelation;

export function listRelations(modelIdOrInstanceId: string): RelationAssertionRecord[] {
  const instance = getInstance(modelIdOrInstanceId);
  if (instance) {
    return getDatabase()
      .prepare('SELECT * FROM relation_assertions WHERE subject_instance_id = ? OR object_instance_id = ? ORDER BY created_at')
      .all(instance.id, instance.id) as RelationAssertionRecord[];
  }
  const instanceIds = idsBy(getDatabase(), 'instances', 'home_model_id', [modelIdOrInstanceId]);
  if (instanceIds.length === 0) return [];
  const placeholders = instanceIds.map(() => '?').join(', ');
  return getDatabase()
    .prepare(`SELECT * FROM relation_assertions WHERE subject_instance_id IN (${placeholders}) OR object_instance_id IN (${placeholders}) ORDER BY created_at`)
    .all(...instanceIds, ...instanceIds) as RelationAssertionRecord[];
}

export const listRelationAssertions = listRelations;

export function getRelation(id: string): RelationAssertionRecord | null {
  return getRecord('relation_assertions', id);
}

export const getRelationAssertion = getRelation;
export const acceptRelation = (id: string): RelationAssertionRecord => updateAssignmentStatus('relation_assertions', id, 'accepted');
export const rejectRelation = (id: string): RelationAssertionRecord => updateAssignmentStatus('relation_assertions', id, 'rejected');
export const supersedeRelation = (id: string): RelationAssertionRecord => updateAssignmentStatus('relation_assertions', id, 'superseded');
export const archiveRelation = (id: string): RelationAssertionRecord => updateAssignmentStatus('relation_assertions', id, 'archived');
export const deleteRelationAssertion = (id: string): boolean => deleteRecord('relation_assertions', id);

export function createEvidence(data: Partial<EvidenceRecord> & Pick<EvidenceRecord, 'evidence_type'>): EvidenceRecord {
  if (data.resource_id) requireRecord('resources', data.resource_id);
  return insertRecord('evidence_records', {
    evidence_type: data.evidence_type,
    resource_id: data.resource_id ?? null,
    locator: data.locator ?? null,
    summary: data.summary ?? null,
    created_by: data.created_by ?? null,
    archived_at: null,
  }, 'created');
}

export function getEvidence(id: string): EvidenceRecord | null {
  return getRecord('evidence_records', id);
}

export function archiveEvidence(id: string): EvidenceRecord {
  return updateRecord('evidence_records', id, { archived_at: now() });
}

export const deleteEvidence = (id: string): boolean => deleteRecord('evidence_records', id);

export function linkEvidenceToTarget(data: Partial<EvidenceLinkRecord> & Pick<EvidenceLinkRecord, 'evidence_id' | 'target_type' | 'target_id'>): EvidenceLinkRecord {
  requireRecord('evidence_records', data.evidence_id);
  return insertRecord('evidence_links', {
    evidence_id: data.evidence_id,
    target_type: data.target_type,
    target_id: data.target_id,
    support_type: data.support_type ?? 'supports',
  }, 'none');
}

export function unlinkEvidenceFromTarget(id: string): boolean {
  return deleteRecord('evidence_links', id);
}

export function listEvidenceForTarget(targetType: string, targetId: string): EvidenceRecord[] {
  return getDatabase()
    .prepare(
      `SELECT evidence_records.*
         FROM evidence_records
         JOIN evidence_links ON evidence_links.evidence_id = evidence_records.id
        WHERE evidence_links.target_type = ? AND evidence_links.target_id = ?
        ORDER BY evidence_records.created_at`,
    )
    .all(targetType, targetId) as EvidenceRecord[];
}

export const listEvidence = listEvidenceForTarget;

export function recordDecision(data: Partial<DecisionRecord> & Pick<DecisionRecord, 'target_type' | 'target_id' | 'decision_type' | 'decided_status'>): DecisionRecord {
  return insertRecord('decisions', {
    target_type: data.target_type,
    target_id: data.target_id,
    decision_type: data.decision_type,
    decided_status: data.decided_status,
    reason: data.reason ?? null,
    created_by: data.created_by ?? null,
  }, 'created');
}

export function getDecision(id: string): DecisionRecord | null {
  return getRecord('decisions', id);
}

export function listDecisionsForTarget(targetType: string, targetId: string): DecisionRecord[] {
  return listRecords('decisions', { target_type: targetType, target_id: targetId }, 'created_at');
}

export function recordDomainEvent(data: Partial<DomainEventRecord> & Pick<DomainEventRecord, 'root_id' | 'event_type'>): DomainEventRecord {
  const revision = data.revision ?? nextDomainRevision(data.root_id);
  return insertRecord('domain_events', {
    root_id: data.root_id,
    model_id: data.model_id ?? null,
    event_type: data.event_type,
    target_type: data.target_type ?? null,
    target_id: data.target_id ?? null,
    payload_json: data.payload_json ?? null,
    created_by: data.created_by ?? null,
    revision,
  }, 'created');
}

export function getDomainEvent(id: string): DomainEventRecord | null {
  return getRecord('domain_events', id);
}

export function listDomainEvents(rootId: string): DomainEventRecord[] {
  return listRecords('domain_events', { root_id: rootId }, 'revision, created_at');
}

export function listDomainEventsByTarget(targetType: string, targetId: string): DomainEventRecord[] {
  return listRecords('domain_events', { target_type: targetType, target_id: targetId }, 'created_at');
}

export function createView(data: Partial<ViewRecord> & Pick<ViewRecord, 'owner_model_id' | 'type' | 'name'>): ViewRecord {
  requireWorldNode(data.owner_model_id);
  return insertRecord('views', {
    owner_model_id: data.owner_model_id,
    type: data.type,
    name: data.name,
    description: data.description ?? null,
    config_json: data.config_json ?? null,
    source_kind: data.source_kind ?? 'user',
    source_id: data.source_id ?? null,
    source_ref: data.source_ref ?? null,
    source_version: data.source_version ?? null,
    archived_at: null,
  });
}

export function ensureDefaultViewsForModel(modelId: string): ViewRecord[] {
  requireWorldNode(modelId);
  const existing = listRecords('views', { owner_model_id: modelId }, 'created_at');
  const existingTypes = new Set(existing.filter((view) => view.archived_at === null).map((view) => view.type));
  const views = [...existing];

  if (!existingTypes.has('explorer')) {
    views.push(createView({
      owner_model_id: modelId,
      type: 'explorer',
      name: 'Explorer',
      source_kind: 'system',
      source_ref: 'system.view.explorer',
    }));
  }

  if (!existingTypes.has('canvas')) {
    views.push(createView({
      owner_model_id: modelId,
      type: 'canvas',
      name: 'Canvas',
      source_kind: 'system',
      source_ref: 'system.view.canvas',
    }));
  }

  return views;
}

export function listViews(modelId: string): ViewRecord[] {
  return listRecords('views', { owner_model_id: modelId }, 'created_at');
}

export function getView(id: string): ViewRecord | null {
  return getRecord('views', id);
}

export function updateView(id: string, data: Partial<Omit<ViewRecord, 'id' | 'created_at' | 'updated_at'>>): ViewRecord {
  return updateRecord('views', id, data);
}

export function archiveView(id: string): ViewRecord {
  return updateRecord('views', id, { archived_at: now() });
}

export const deleteView = (id: string): boolean => deleteRecord('views', id);

export function createCanvasNodeType(data: Partial<CanvasNodeTypeRecord> & Pick<CanvasNodeTypeRecord, 'key' | 'name' | 'allowed_subjects_json' | 'renderer_key' | 'default_size_json'>): CanvasNodeTypeRecord {
  return insertRecord('canvas_node_types', {
    owner_model_id: data.owner_model_id ?? null,
    key: assertDomainKey(data.key, 'canvas node type key'),
    name: data.name,
    description: data.description ?? null,
    allowed_subjects_json: data.allowed_subjects_json,
    renderer_key: data.renderer_key,
    fields_json: data.fields_json ?? '[]',
    actions_json: data.actions_json ?? '[]',
    interactions_json: data.interactions_json ?? '[]',
    default_size_json: data.default_size_json,
    default_style_json: data.default_style_json ?? null,
    source_kind: data.source_kind ?? 'system',
    source_id: data.source_id ?? null,
    source_ref: data.source_ref ?? null,
    source_version: data.source_version ?? null,
  });
}

export function createCanvasEdgeType(data: Partial<CanvasEdgeTypeRecord> & Pick<CanvasEdgeTypeRecord, 'key' | 'name' | 'allowed_subjects_json' | 'renderer_key'>): CanvasEdgeTypeRecord {
  return insertRecord('canvas_edge_types', {
    owner_model_id: data.owner_model_id ?? null,
    key: assertDomainKey(data.key, 'canvas edge type key'),
    name: data.name,
    description: data.description ?? null,
    allowed_subjects_json: data.allowed_subjects_json,
    renderer_key: data.renderer_key,
    label_fields_json: data.label_fields_json ?? '[]',
    actions_json: data.actions_json ?? '[]',
    interactions_json: data.interactions_json ?? '[]',
    default_style_json: data.default_style_json ?? null,
    source_kind: data.source_kind ?? 'system',
    source_id: data.source_id ?? null,
    source_ref: data.source_ref ?? null,
    source_version: data.source_version ?? null,
  });
}

interface BuiltInCanvasNodeType {
  key: string;
  name: string;
  description: string;
  allowedSubjects: CanvasSubjectType[];
  rendererKey: string;
  defaultSize: { width: number; height: number };
}

interface BuiltInCanvasEdgeType {
  key: string;
  name: string;
  description: string;
  allowedSubjects: string[];
  rendererKey: string;
}

const BUILT_IN_CANVAS_NODE_TYPES: BuiltInCanvasNodeType[] = [
  {
    key: 'model_card',
    name: 'Model Card',
    description: 'Built-in card for world/model subjects.',
    allowedSubjects: ['world', 'model'],
    rendererKey: 'netior.model_card',
    defaultSize: { width: 176, height: 72 },
  },
  {
    key: 'kind_card',
    name: 'Kind Card',
    description: 'Built-in card for kind definitions.',
    allowedSubjects: ['kind'],
    rendererKey: 'netior.kind_card',
    defaultSize: { width: 168, height: 68 },
  },
  {
    key: 'relation_kind_card',
    name: 'Relation Kind Card',
    description: 'Built-in card for relation kind definitions.',
    allowedSubjects: ['relation_kind'],
    rendererKey: 'netior.relation_kind_card',
    defaultSize: { width: 184, height: 68 },
  },
  {
    key: 'instance_card',
    name: 'Instance Card',
    description: 'Built-in card for assigned instances.',
    allowedSubjects: ['instance'],
    rendererKey: 'netior.instance_card',
    defaultSize: { width: 168, height: 68 },
  },
  {
    key: 'resource_tile',
    name: 'Resource Tile',
    description: 'Built-in tile for external resources.',
    allowedSubjects: ['resource'],
    rendererKey: 'netior.resource_tile',
    defaultSize: { width: 184, height: 68 },
  },
  {
    key: 'note',
    name: 'Note',
    description: 'Built-in lightweight note node.',
    allowedSubjects: ['note'],
    rendererKey: 'netior.note',
    defaultSize: { width: 200, height: 120 },
  },
  {
    key: 'compact',
    name: 'Compact',
    description: 'Built-in compact label node.',
    allowedSubjects: ['world', 'model', 'kind', 'relation_kind', 'instance', 'resource'],
    rendererKey: 'netior.compact',
    defaultSize: { width: 132, height: 36 },
  },
];

const BUILT_IN_CANVAS_EDGE_TYPES: BuiltInCanvasEdgeType[] = [
  {
    key: 'relation_edge',
    name: 'Relation Edge',
    description: 'Built-in edge for relation assertions.',
    allowedSubjects: ['relation_assertion'],
    rendererKey: 'netior.relation_edge',
  },
  {
    key: 'kind_assignment_edge',
    name: 'Kind Assignment Edge',
    description: 'Built-in edge for instance-kind assignment.',
    allowedSubjects: ['kind_assignment'],
    rendererKey: 'netior.kind_assignment_edge',
  },
  {
    key: 'resource_mapping_edge',
    name: 'Resource Mapping Edge',
    description: 'Built-in edge for instance-resource mapping.',
    allowedSubjects: ['resource_mapping'],
    rendererKey: 'netior.resource_mapping_edge',
  },
  {
    key: 'model_parent_edge',
    name: 'Model Parent Edge',
    description: 'Built-in edge for model hierarchy.',
    allowedSubjects: ['model_parent'],
    rendererKey: 'netior.model_parent_edge',
  },
  {
    key: 'dashed_edge',
    name: 'Dashed Edge',
    description: 'Built-in dashed edge renderer.',
    allowedSubjects: ['relation_assertion', 'kind_assignment', 'resource_mapping', 'model_parent'],
    rendererKey: 'netior.dashed_edge',
  },
];

export function ensureBuiltInCanvasTypes(): { nodeTypes: CanvasNodeTypeRecord[]; edgeTypes: CanvasEdgeTypeRecord[] } {
  const nodeTypes = BUILT_IN_CANVAS_NODE_TYPES.map((type) => ensureBuiltInCanvasNodeType(type));
  const edgeTypes = BUILT_IN_CANVAS_EDGE_TYPES.map((type) => ensureBuiltInCanvasEdgeType(type));
  return { nodeTypes, edgeTypes };
}

function ensureBuiltInCanvasNodeType(type: BuiltInCanvasNodeType): CanvasNodeTypeRecord {
  const existing = getDatabase()
    .prepare('SELECT * FROM canvas_node_types WHERE owner_model_id IS NULL AND key = ? LIMIT 1')
    .get(type.key) as CanvasNodeTypeRecord | undefined;
  if (existing) return existing;

  return createCanvasNodeType({
    owner_model_id: null,
    key: type.key,
    name: type.name,
    description: type.description,
    allowed_subjects_json: JSON.stringify(type.allowedSubjects),
    renderer_key: type.rendererKey,
    fields_json: '[]',
    actions_json: JSON.stringify(defaultCanvasNodeActions()),
    interactions_json: JSON.stringify(defaultCanvasNodeInteractions()),
    default_size_json: JSON.stringify(type.defaultSize),
    source_kind: 'system',
    source_ref: `system.canvasNodeType.${type.key}`,
  });
}

function ensureBuiltInCanvasEdgeType(type: BuiltInCanvasEdgeType): CanvasEdgeTypeRecord {
  const existing = getDatabase()
    .prepare('SELECT * FROM canvas_edge_types WHERE owner_model_id IS NULL AND key = ? LIMIT 1')
    .get(type.key) as CanvasEdgeTypeRecord | undefined;
  if (existing) return existing;

  return createCanvasEdgeType({
    owner_model_id: null,
    key: type.key,
    name: type.name,
    description: type.description,
    allowed_subjects_json: JSON.stringify(type.allowedSubjects),
    renderer_key: type.rendererKey,
    label_fields_json: '[]',
    actions_json: JSON.stringify(defaultCanvasEdgeActions()),
    interactions_json: JSON.stringify(defaultCanvasEdgeInteractions()),
    default_style_json: null,
    source_kind: 'system',
    source_ref: `system.canvasEdgeType.${type.key}`,
  });
}

function defaultCanvasNodeActions(): unknown[] {
  return [
    { key: 'open_editor', label: 'Open in Editor', icon: 'PanelRightOpen', handler: 'open_editor' },
    { key: 'hide_from_canvas', label: 'Hide from Canvas', icon: 'EyeOff', handler: 'view_command' },
    { key: 'remove_from_canvas', label: 'Remove from Canvas', icon: 'Trash2', handler: 'view_command' },
  ];
}

function defaultCanvasNodeInteractions(): unknown[] {
  return [
    { event: 'click', mode: 'browse', actionKey: 'select', behavior: 'select' },
    { event: 'double_click', mode: 'browse', actionKey: 'open_editor', behavior: 'execute' },
    { event: 'context_menu', mode: 'browse', actionKey: 'open_menu', behavior: 'open_menu' },
    { event: 'click', mode: 'edit', actionKey: 'select', behavior: 'select' },
    { event: 'drag', mode: 'edit', actionKey: 'move_layout', behavior: 'execute' },
  ];
}

function defaultCanvasEdgeActions(): unknown[] {
  return [
    { key: 'hide_from_canvas', label: 'Hide from Canvas', icon: 'EyeOff', handler: 'view_command' },
    { key: 'remove_from_canvas', label: 'Remove from Canvas', icon: 'Trash2', handler: 'view_command' },
  ];
}

function defaultCanvasEdgeInteractions(): unknown[] {
  return [
    { event: 'click', mode: 'browse', actionKey: 'select', behavior: 'select' },
    { event: 'context_menu', mode: 'browse', actionKey: 'open_menu', behavior: 'open_menu' },
  ];
}

export function upsertViewItem(data: Partial<ViewItemRecord> & Pick<ViewItemRecord, 'view_id' | 'item_kind' | 'subject_type'>): ViewItemRecord {
  requireRecord('views', data.view_id);
  const values = {
    view_id: data.view_id,
    item_kind: data.item_kind,
    subject_type: data.subject_type,
    subject_id: data.subject_id ?? null,
    subject_model_id: data.subject_model_id ?? null,
    type_id: data.type_id ?? null,
    parent_item_id: data.parent_item_id ?? null,
    layout_json: data.layout_json ?? null,
    state_json: data.state_json ?? null,
    overrides_json: data.overrides_json ?? null,
  };
  return data.id ? updateRecord('view_items', data.id, values) : insertRecord('view_items', values);
}

export function listViewItems(viewId: string): ViewItemRecord[] {
  return listRecords('view_items', { view_id: viewId }, 'created_at');
}

export function deleteViewItem(id: string): boolean {
  return deleteRecord('view_items', id);
}

export function saveViewLayout(viewId: string, items: Array<Pick<ViewItemRecord, 'id'> & Partial<Pick<ViewItemRecord, 'layout_json' | 'state_json' | 'overrides_json'>>>): ViewItemRecord[] {
  requireRecord('views', viewId);
  const database = getDatabase();
  database.transaction(() => {
    for (const item of items) {
      updateRecord('view_items', item.id, {
        layout_json: item.layout_json,
        state_json: item.state_json,
        overrides_json: item.overrides_json,
      });
    }
  })();
  return listViewItems(viewId);
}

export function getDomainSnapshot(filters?: { rootId?: string; worldId?: string; modelId?: string }): DomainSnapshot {
  const database = getDatabase();
  const rootIds = filters?.rootId || filters?.worldId
    ? [filters.rootId ?? filters.worldId as string]
    : idsWhere(database, 'world_nodes', "node_type = 'world'");
  const nodeIds = filters?.modelId
    ? [filters.modelId]
    : rootIds.length > 0
      ? idsBy(database, 'world_nodes', 'root_id', rootIds)
      : [];
  const modelIds = nodeIds.filter((id) => getWorldNode(id)?.node_type === 'model' || rootIds.includes(id));
  const kindIds = idsBy(database, 'kinds', 'model_id', modelIds);
  const relationKindIds = idsBy(database, 'relation_kinds', 'model_id', modelIds);
  const instanceIds = idsBy(database, 'instances', 'home_model_id', modelIds);
  const resourceIds = idsBy(database, 'resources', 'root_id', rootIds);
  const relationIds = relationIdsForInstances(database, instanceIds);
  const viewIds = idsBy(database, 'views', 'owner_model_id', modelIds);

  return {
    worldNodes: rowsByIds<WorldNodeRecord>(database, 'world_nodes', nodeIds),
    directoryBindings: rowsByIds<ModelDirectoryBindingRecord>(database, 'model_directory_bindings', idsBy(database, 'model_directory_bindings', 'model_id', modelIds)),
    kinds: rowsByIds<KindRecord>(database, 'kinds', kindIds),
    properties: rowsByIds<PropertyRecord>(database, 'properties', idsBy(database, 'properties', 'kind_id', kindIds)),
    relationKinds: rowsByIds<RelationKindRecord>(database, 'relation_kinds', relationKindIds),
    relationKindEndpointPairs: rowsByIds<RelationKindEndpointPairRecord>(database, 'relation_kind_endpoint_pairs', idsBy(database, 'relation_kind_endpoint_pairs', 'relation_kind_id', relationKindIds)),
    instances: rowsByIds<InstanceRecord>(database, 'instances', instanceIds),
    resources: rowsByIds<ResourceRecord>(database, 'resources', resourceIds),
    instanceResourceLinks: rowsByIds<InstanceResourceLinkRecord>(database, 'instance_resource_links', idsBy(database, 'instance_resource_links', 'instance_id', instanceIds)),
    kindAssignments: rowsByIds<KindAssignmentRecord>(database, 'kind_assignments', idsBy(database, 'kind_assignments', 'instance_id', instanceIds)),
    propertyValues: rowsByIds<PropertyValueRecord>(database, 'property_values', idsBy(database, 'property_values', 'instance_id', instanceIds)),
    relations: rowsByIds<RelationAssertionRecord>(database, 'relation_assertions', relationIds),
    evidence: rowsByIds<EvidenceRecord>(database, 'evidence_records', evidenceIdsForTargets(database, [
      ...idsBy(database, 'kind_assignments', 'instance_id', instanceIds),
      ...idsBy(database, 'property_values', 'instance_id', instanceIds),
      ...relationIds,
    ])),
    evidenceLinks: rowsByIds<EvidenceLinkRecord>(database, 'evidence_links', idsBy(database, 'evidence_links', 'evidence_id', ids(database, 'evidence_records'))),
    decisions: rowsByIds<DecisionRecord>(database, 'decisions', decisionIdsForTargets(database, [
      ...idsBy(database, 'kind_assignments', 'instance_id', instanceIds),
      ...idsBy(database, 'property_values', 'instance_id', instanceIds),
      ...relationIds,
    ])),
    domainEvents: rowsByIds<DomainEventRecord>(database, 'domain_events', idsBy(database, 'domain_events', 'root_id', rootIds)),
    views: rowsByIds<ViewRecord>(database, 'views', viewIds),
    canvasNodeTypes: rowsByIds<CanvasNodeTypeRecord>(database, 'canvas_node_types', ids(database, 'canvas_node_types')),
    canvasEdgeTypes: rowsByIds<CanvasEdgeTypeRecord>(database, 'canvas_edge_types', ids(database, 'canvas_edge_types')),
    viewItems: rowsByIds<ViewItemRecord>(database, 'view_items', idsBy(database, 'view_items', 'view_id', viewIds)),
  };
}

export function getSetting(key: string): unknown {
  const row = getDatabase()
    .prepare('SELECT value_json FROM app_settings WHERE key = ?')
    .get(key) as { value_json: string | null } | undefined;
  if (!row || row.value_json === null) return null;
  try {
    return JSON.parse(row.value_json) as unknown;
  } catch {
    return row.value_json;
  }
}

export function setSetting(key: string, value: unknown): boolean {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  getDatabase()
    .prepare(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    )
    .run(key, serialized, now());
  return true;
}

function listRecords<TTable extends TableName>(
  table: TTable,
  filters: Record<string, unknown> = {},
  orderBy = 'created_at',
): RecordForTable<TTable>[] {
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined);
  const where = entries.length > 0
    ? ` WHERE ${entries.map(([key]) => `${key} = ?`).join(' AND ')}`
    : '';
  return getDatabase()
    .prepare(`SELECT * FROM ${table}${where} ORDER BY ${orderBy}`)
    .all(...entries.map(([, value]) => value)) as RecordForTable<TTable>[];
}

function getRecord<TTable extends TableName>(table: TTable, id: string): RecordForTable<TTable> | null {
  return getDatabase().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as RecordForTable<TTable> | undefined ?? null;
}

function requireRecord<TTable extends TableName>(table: TTable, id: string): RecordForTable<TTable> {
  const record = getRecord(table, id);
  if (!record) throw new DomainNotFoundError(`${table} record not found: ${id}`);
  return record;
}

function insertRecord<TTable extends TableName>(
  table: TTable,
  data: Partial<Omit<RecordForTable<TTable>, 'id' | 'created_at' | 'updated_at'>>,
  timestamps: TimestampMode = 'both',
): RecordForTable<TTable> {
  const id = randomUUID();
  const timestamp = now();
  const row: Record<string, unknown> = { id, ...data };
  if (timestamps === 'both') {
    row.created_at = timestamp;
    row.updated_at = timestamp;
  } else if (timestamps === 'created') {
    row.created_at = timestamp;
  }
  const keys = Object.keys(row).filter((key) => row[key] !== undefined);
  getDatabase()
    .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
    .run(...keys.map((key) => row[key]));
  return requireRecord(table, id);
}

function updateRecord<TTable extends TableName>(
  table: TTable,
  id: string,
  data: Partial<Omit<RecordForTable<TTable>, 'id' | 'created_at' | 'updated_at'>>,
): RecordForTable<TTable> {
  requireRecord(table, id);
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return requireRecord(table, id);

  const hasUpdatedAt = tableHasColumn(table, 'updated_at');
  const assignments = [
    ...entries.map(([key]) => `${key} = ?`),
    ...(hasUpdatedAt ? ['updated_at = ?'] : []),
  ].join(', ');
  getDatabase()
    .prepare(`UPDATE ${table} SET ${assignments} WHERE id = ?`)
    .run(...entries.map(([, value]) => value), ...(hasUpdatedAt ? [now()] : []), id);
  return requireRecord(table, id);
}

function deleteRecord(table: TableName, id: string): boolean {
  const result = getDatabase().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return result.changes > 0;
}

function requireWorld(id: string): WorldRecord {
  const world = getWorld(id);
  if (!world) throw new DomainNotFoundError(`World not found: ${id}`);
  return world;
}

function requireModel(id: string): ModelRecord {
  const model = getModel(id);
  if (!model) throw new DomainNotFoundError(`Model not found: ${id}`);
  return model;
}

function requireWorldNode(id: string): WorldNodeRecord {
  const node = getWorldNode(id);
  if (!node) throw new DomainNotFoundError(`World node not found: ${id}`);
  return node;
}

function archiveWorldNode(id: string): WorldNodeRecord {
  requireWorldNode(id);
  return updateRecord('world_nodes', id, { status: 'archived', archived_at: now() });
}

function archiveRecord<TTable extends 'kinds' | 'properties' | 'relation_kinds' | 'instances'>(
  table: TTable,
  id: string,
): RecordForTable<TTable> {
  return updateRecord(table, id, { status: 'archived', archived_at: now() } as Partial<Omit<RecordForTable<TTable>, 'id' | 'created_at' | 'updated_at'>>);
}

function updateAssignmentStatus<TTable extends 'kind_assignments' | 'property_values' | 'relation_assertions'>(
  table: TTable,
  id: string,
  status: AssignmentStatus,
): RecordForTable<TTable> {
  return updateRecord(table, id, { status, decided_at: now() } as Partial<Omit<RecordForTable<TTable>, 'id' | 'created_at' | 'updated_at'>>);
}

function rootIdForNode(nodeId: string): string {
  return requireWorldNode(nodeId).root_id;
}

function visibleNodeIds(modelId: string): string[] {
  return [...getWorldNodeAncestors(modelId), requireWorldNode(modelId)].map((node) => node.id);
}

function assertKindVisibleToInstance(instanceId: string, kindId: string): void {
  const instance = requireRecord('instances', instanceId);
  const kind = requireRecord('kinds', kindId);
  if (!visibleNodeIds(instance.home_model_id).includes(kind.model_id)) {
    throw new DomainValidationError('Kind must be visible from the instance home model');
  }
}

function resolveRelationEndpointKind(
  relationKind: RelationKindRecord,
  kindId: string | undefined,
  kindKey: string | undefined,
  endpoint: 'subject' | 'object',
): string {
  if (kindId) {
    const kind = requireRecord('kinds', kindId);
    if (!visibleNodeIds(relationKind.model_id).includes(kind.model_id)) {
      throw new DomainValidationError(`${endpoint} kind must be visible from the relation kind model`);
    }
    return kind.id;
  }

  if (kindKey) {
    assertDomainKey(kindKey, `${endpoint} kind key`);
    const visibleModelIds = visibleNodeIds(relationKind.model_id);
    const placeholders = visibleModelIds.map(() => '?').join(', ');
    const kinds = getDatabase()
      .prepare(`SELECT * FROM kinds WHERE key = ? AND model_id IN (${placeholders}) AND status = 'active'`)
      .all(kindKey, ...visibleModelIds) as KindRecord[];
    if (kinds.length === 1) return kinds[0].id;
    if (kinds.length > 1) {
      throw new DomainValidationError(`${endpoint} kind key is ambiguous; use kind id`);
    }
  }

  throw new DomainValidationError(`${endpoint} kind id or key is required`);
}

function acceptedKindIdsForInstance(instanceId: string): Set<string> {
  return new Set(
    listKindAssignments(instanceId)
      .filter((assignment) => assignment.status === 'accepted')
      .map((assignment) => assignment.kind_id),
  );
}

function assertInstanceHasAcceptedKind(instanceId: string, kindId: string, endpoint: 'subject' | 'object'): void {
  if (!acceptedKindIdsForInstance(instanceId).has(kindId)) {
    throw new DomainValidationError(`Relation ${endpoint} kind must be accepted on the ${endpoint} instance`);
  }
}

function relationEndpointPairAllowed(
  relationKind: RelationKindRecord,
  subjectKindId: string,
  objectKindId: string,
): boolean {
  const pairs = listRecords('relation_kind_endpoint_pairs', { relation_kind_id: relationKind.id }, 'created_at');
  if (pairs.length === 0) return true;

  for (const pair of pairs) {
    if (pair.subject_kind_id === subjectKindId && pair.object_kind_id === objectKindId) return true;
    if (!truthy(relationKind.directed) && pair.subject_kind_id === objectKindId && pair.object_kind_id === subjectKindId) return true;
  }
  return false;
}

function assertPropertyCompatibleWithInstance(instanceId: string, propertyId: string): void {
  const property = requireRecord('properties', propertyId);
  assertKindVisibleToInstance(instanceId, property.kind_id);
}

function validateInstanceAssignmentsVisible(instanceId: string, homeModelId: string): void {
  const visible = new Set(visibleNodeIds(homeModelId));
  for (const assignment of listKindAssignments(instanceId)) {
    const kind = requireRecord('kinds', assignment.kind_id);
    if (!visible.has(kind.model_id)) {
      throw new DomainValidationError('Existing kind assignment is not visible from the new home model');
    }
  }
}

function validateRelationEndpointKinds(
  subjectId: string,
  subjectKindId: string,
  relationKindId: string,
  objectId: string,
  objectKindId: string,
): void {
  const subject = requireRecord('instances', subjectId);
  const object = requireRecord('instances', objectId);
  const subjectKind = requireRecord('kinds', subjectKindId);
  const objectKind = requireRecord('kinds', objectKindId);
  const relationKind = requireRecord('relation_kinds', relationKindId);
  if (rootIdForNode(subject.home_model_id) !== rootIdForNode(object.home_model_id)) {
    throw new DomainValidationError('Relation endpoints must belong to the same world');
  }
  if (!visibleNodeIds(subject.home_model_id).includes(relationKind.model_id)) {
    throw new DomainValidationError('Relation kind must be visible from the subject home model');
  }
  if (!visibleNodeIds(subject.home_model_id).includes(subjectKind.model_id)) {
    throw new DomainValidationError('Relation subject kind must be visible from the subject home model');
  }
  if (!visibleNodeIds(object.home_model_id).includes(objectKind.model_id)) {
    throw new DomainValidationError('Relation object kind must be visible from the object home model');
  }
  assertInstanceHasAcceptedKind(subject.id, subjectKind.id, 'subject');
  assertInstanceHasAcceptedKind(object.id, objectKind.id, 'object');
  if (!relationEndpointPairAllowed(relationKind, subjectKind.id, objectKind.id)) {
    throw new DomainValidationError('Relation endpoints do not match the relation kind endpoint pair policy');
  }
}

function clearPrimaryResourceLink(instanceId: string): void {
  getDatabase()
    .prepare('UPDATE instance_resource_links SET is_primary = 0 WHERE instance_id = ?')
    .run(instanceId);
}

function updateSortOrder(table: 'properties', parentColumn: string, parentId: string, orderedIds: string[]): void {
  const database = getDatabase();
  const timestamp = now();
  database.transaction(() => {
    orderedIds.forEach((id, index) => {
      database
        .prepare(`UPDATE ${table} SET sort_order = ?, updated_at = ? WHERE id = ? AND ${parentColumn} = ?`)
        .run(index, timestamp, id, parentId);
    });
  })();
}

function nextSortOrder(parentId: string): number {
  const row = getDatabase()
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM world_nodes WHERE parent_id = ?')
    .get(parentId) as { next_order: number } | undefined;
  return row?.next_order ?? 0;
}

function nextDomainRevision(rootId: string): number {
  const row = getDatabase()
    .prepare('SELECT COALESCE(MAX(revision), 0) + 1 AS next_revision FROM domain_events WHERE root_id = ?')
    .get(rootId) as { next_revision: number } | undefined;
  return row?.next_revision ?? 1;
}

function normalizeBooleanFields<T extends Record<string, unknown>>(data: T, fields: string[]): T {
  const normalized = { ...data };
  for (const field of fields) {
    if (field in normalized && normalized[field] !== undefined) {
      normalized[field as keyof T] = truthy(normalized[field]) as T[keyof T];
    }
  }
  return normalized;
}

function truthy(value: unknown): number {
  return value ? 1 : 0;
}

function now(): string {
  return new Date().toISOString();
}

function slugKey(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || randomUUID();
}

function uniqueWorldNodeKey(rootId: string, parentId: string, baseKey: string): string {
  const base = slugKey(baseKey);
  const exists = getDatabase().prepare('SELECT 1 FROM world_nodes WHERE root_id = ? AND parent_id = ? AND key = ? LIMIT 1');
  if (!exists.get(rootId, parentId, base)) return base;

  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!exists.get(rootId, parentId, candidate)) return candidate;
  }
  return `${base}-${randomUUID()}`;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function pathsOverlap(left: string, right: string): boolean {
  const normalizedLeft = `${normalizeRelativePath(left)}/`;
  const normalizedRight = `${normalizeRelativePath(right)}/`;
  return normalizedLeft.startsWith(normalizedRight) || normalizedRight.startsWith(normalizedLeft);
}

function tableHasColumn(table: TableName, column: string): boolean {
  return (getDatabase().pragma(`table_info(${table})`) as { name: string }[]).some((entry) => entry.name === column);
}

function ids(database: Database.Database, table: string): string[] {
  return (database.prepare(`SELECT id FROM ${table}`).all() as { id: string }[]).map((row) => row.id);
}

function idsWhere(database: Database.Database, table: string, where: string): string[] {
  return (database.prepare(`SELECT id FROM ${table} WHERE ${where}`).all() as { id: string }[]).map((row) => row.id);
}

function idsBy(database: Database.Database, table: string, column: string, values: string[]): string[] {
  if (values.length === 0) return [];
  const placeholders = values.map(() => '?').join(', ');
  return (
    database
      .prepare(`SELECT id FROM ${table} WHERE ${column} IN (${placeholders})`)
      .all(...values) as { id: string }[]
  ).map((row) => row.id);
}

function rowsByIds<T>(database: Database.Database, table: string, values: string[], idColumn = 'id'): T[] {
  if (values.length === 0) return [];
  const placeholders = values.map(() => '?').join(', ');
  return database.prepare(`SELECT * FROM ${table} WHERE ${idColumn} IN (${placeholders})`).all(...values) as T[];
}

function rowsWhereIn<T>(table: string, column: string, values: string[], extraWhere: string, orderBy: string): T[] {
  if (values.length === 0) return [];
  const placeholders = values.map(() => '?').join(', ');
  return getDatabase()
    .prepare(`SELECT * FROM ${table} WHERE ${column} IN (${placeholders}) AND ${extraWhere} ORDER BY ${orderBy}`)
    .all(...values) as T[];
}

function relationIdsForInstances(database: Database.Database, instanceIds: string[]): string[] {
  if (instanceIds.length === 0) return [];
  const placeholders = instanceIds.map(() => '?').join(', ');
  return (
    database
      .prepare(`SELECT id FROM relation_assertions WHERE subject_instance_id IN (${placeholders}) OR object_instance_id IN (${placeholders})`)
      .all(...instanceIds, ...instanceIds) as { id: string }[]
  ).map((row) => row.id);
}

function evidenceIdsForTargets(database: Database.Database, targetIds: string[]): string[] {
  if (targetIds.length === 0) return [];
  const placeholders = targetIds.map(() => '?').join(', ');
  return (
    database
      .prepare(`SELECT DISTINCT evidence_id AS id FROM evidence_links WHERE target_id IN (${placeholders})`)
      .all(...targetIds) as { id: string }[]
  ).map((row) => row.id);
}

function decisionIdsForTargets(database: Database.Database, targetIds: string[]): string[] {
  if (targetIds.length === 0) return [];
  const placeholders = targetIds.map(() => '?').join(', ');
  return (
    database
      .prepare(`SELECT id FROM decisions WHERE target_id IN (${placeholders})`)
      .all(...targetIds) as { id: string }[]
  ).map((row) => row.id);
}
