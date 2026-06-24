import type {
  Schema,
  SchemaField,
  SchemaFieldCreate,
  SchemaFieldUpdate,
  SchemaMeaning,
  SchemaMeaningCreate,
  SchemaMeaningSlotBinding,
  SchemaMeaningSlotBindingUpdate,
  SchemaMeaningUpdate,
  SchemaCreate,
  SchemaUpdate,
  Instance,
  InstanceCreate,
  InstanceProperty,
  InstancePropertyUpsert,
  InstanceUpdate,
  InteractiveViewPreference,
  InteractiveViewPreferenceUpsert,
  InteractiveViewSchemaPreference,
  InteractiveViewSchemaPreferenceUpsert,
  InteractiveViewTemplate,
  InteractiveViewTemplateCreate,
  InteractiveViewTemplateListQuery,
  InteractiveViewTemplateUpdate,
  Edge,
  EdgeCreate,
  EdgeUpdate,
  FileEntity,
  FileEntityUpdate,
  Module,
  Network,
  NetworkBreadcrumbItem,
  NetworkCreate,
  NetworkType,
  NetworkTypeCreate,
  NetworkTypeUpdate,
  NetworkNodeType,
  NetworkNodeTypeCreate,
  NetworkNodeTypeUpdate,
  NetworkEdgeType,
  NetworkEdgeTypeCreate,
  NetworkEdgeTypeUpdate,
  NetworkFullData,
  NetworkNode,
  NetworkNodeCreate,
  NetworkNodeUpdate,
  NetworkTreeNode,
  NetworkUpdate,
  Relationship,
  RelationshipCreate,
  RelationshipUpdate,
  NetworkObjectType,
  ObjectRecord,
  World,
  Meaning,
  MeaningCreate,
  MeaningUpdate,
  NetiorServiceResponse,
} from '@netior/shared/types';
import type { NetiorDslEvaluateRequest, NetiorDslEvalResult } from '@netior/shared/dsl';

function getNetiorServiceBaseUrl(): string {
  return process.env.NETIOR_SERVICE_URL ?? `http://127.0.0.1:${process.env.NETIOR_SERVICE_PORT ?? '3201'}`;
}

function toQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getNetiorServiceBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  let payload: NetiorServiceResponse<T>;
  try {
    payload = await response.json() as NetiorServiceResponse<T>;
  } catch {
    throw new Error(`Netior service returned a non-JSON response for ${path}`);
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? `Netior service request failed for ${path}` : payload.error);
  }

  return payload.data;
}

export function getNetiorServiceUrl(): string {
  return getNetiorServiceBaseUrl();
}

export async function getWorldById(rootNetworkId: string): Promise<World | null> {
  return requestJson<World | null>(`/worlds/${encodeURIComponent(rootNetworkId)}`);
}

export async function listNetworks(rootNetworkId: string, rootOnly?: boolean): Promise<Network[]> {
  return requestJson<Network[]>(`/networks${toQueryString({
    rootNetworkId,
    rootOnly: rootOnly == null ? undefined : String(rootOnly),
  })}`);
}

export async function createNetwork(data: NetworkCreate): Promise<Network> {
  return requestJson<Network>('/networks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNetwork(id: string, data: NetworkUpdate): Promise<Network | null> {
  return requestJson<Network | null>(`/networks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteNetwork(id: string): Promise<boolean> {
  return requestJson<boolean>(`/networks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listSchemas(rootNetworkId: string): Promise<Schema[]> {
  return requestJson<Schema[]>(`/schemas${toQueryString({ rootNetworkId })}`);
}

export async function listSchemaFields(schemaId: string): Promise<SchemaField[]> {
  return requestJson<SchemaField[]>(`/schema-fields${toQueryString({ schemaId })}`);
}

export async function listSchemaMeanings(schemaId: string): Promise<SchemaMeaning[]> {
  return requestJson<SchemaMeaning[]>(`/schema-meanings${toQueryString({ schemaId })}`);
}

export async function ensureSchemaMeaning(data: SchemaMeaningCreate): Promise<SchemaMeaning | null> {
  return requestJson<SchemaMeaning | null>('/schema-meanings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSchemaMeaning(
  id: string,
  data: SchemaMeaningUpdate,
): Promise<SchemaMeaning | null> {
  return requestJson<SchemaMeaning | null>(`/schema-meanings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSchemaMeaning(id: string): Promise<boolean> {
  return requestJson<boolean>(`/schema-meanings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function updateSchemaMeaningSlotBinding(
  id: string,
  data: SchemaMeaningSlotBindingUpdate,
): Promise<SchemaMeaningSlotBinding | null> {
  return requestJson<SchemaMeaningSlotBinding | null>(`/schema-meaning-slots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function createSchemaField(data: SchemaFieldCreate): Promise<SchemaField> {
  return requestJson<SchemaField>('/schema-fields', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSchemaField(id: string, data: SchemaFieldUpdate): Promise<SchemaField | null> {
  return requestJson<SchemaField | null>(`/schema-fields/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSchemaField(id: string): Promise<boolean> {
  return requestJson<boolean>(`/schema-fields/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function reorderSchemaFields(schemaId: string, orderedIds: string[]): Promise<boolean> {
  return requestJson<boolean>('/schema-fields/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ schemaId, orderedIds }),
  });
}

export async function createSchema(data: SchemaCreate): Promise<Schema> {
  return requestJson<Schema>('/schemas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSchema(id: string, data: SchemaUpdate): Promise<Schema | null> {
  return requestJson<Schema | null>(`/schemas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSchema(id: string): Promise<boolean> {
  return requestJson<boolean>(`/schemas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listMeanings(rootNetworkId: string): Promise<Meaning[]> {
  return requestJson<Meaning[]>(`/meanings${toQueryString({ rootNetworkId })}`);
}

export async function evaluateDsl(data: NetiorDslEvaluateRequest): Promise<NetiorDslEvalResult> {
  return requestJson<NetiorDslEvalResult>('/dsl/evaluate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listMeaningCategories(rootNetworkId: string): Promise<Instance[]> {
  return requestJson<Instance[]>(`/meaning-categories${toQueryString({ rootNetworkId })}`);
}

export async function createMeaning(data: MeaningCreate): Promise<Meaning> {
  return requestJson<Meaning>('/meanings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMeaning(id: string): Promise<Meaning | null> {
  return requestJson<Meaning | null>(`/meanings/${encodeURIComponent(id)}`);
}

export async function updateMeaning(id: string, data: MeaningUpdate): Promise<Meaning | null> {
  return requestJson<Meaning | null>(`/meanings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteMeaning(id: string): Promise<boolean> {
  return requestJson<boolean>(`/meanings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getInstancesByWorld(rootNetworkId: string): Promise<Instance[]> {
  return requestJson<Instance[]>(`/instances${toQueryString({ rootNetworkId })}`);
}

export async function searchInstances(rootNetworkId: string, query: string): Promise<Instance[]> {
  return requestJson<Instance[]>(`/instances/search${toQueryString({ rootNetworkId, query })}`);
}

export async function createInstance(data: InstanceCreate): Promise<Instance> {
  return requestJson<Instance>('/instances', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateInstance(id: string, data: InstanceUpdate): Promise<Instance | null> {
  return requestJson<Instance | null>(`/instances/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteInstance(id: string): Promise<boolean> {
  return requestJson<boolean>(`/instances/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listModules(rootNetworkId: string): Promise<Module[]> {
  return requestJson<Module[]>(`/modules${toQueryString({ rootNetworkId })}`);
}

export async function getObject(id: string): Promise<ObjectRecord | null> {
  return requestJson<ObjectRecord | null>(`/objects/${encodeURIComponent(id)}`);
}

export async function getObjectByRef(objectType: NetworkObjectType, refId: string): Promise<ObjectRecord | null> {
  return requestJson<ObjectRecord | null>(`/objects/by-ref${toQueryString({ objectType, refId })}`);
}

export async function getUniverseNetwork(): Promise<Network | null> {
  return requestJson<Network | null>('/networks/universe');
}

export async function getRootNetwork(rootNetworkId: string): Promise<Network | null> {
  return requestJson<Network | null>(`/networks/root${toQueryString({ rootNetworkId })}`);
}

export async function getNetworkTree(rootNetworkId: string): Promise<NetworkTreeNode[]> {
  return requestJson<NetworkTreeNode[]>(`/networks/tree${toQueryString({ rootNetworkId })}`);
}

export async function getNetworkFull(networkId: string): Promise<NetworkFullData | null> {
  return requestJson<NetworkFullData | null>(`/networks/${encodeURIComponent(networkId)}/full`);
}

export async function getNetworkAncestors(networkId: string): Promise<NetworkBreadcrumbItem[]> {
  return requestJson<NetworkBreadcrumbItem[]>(`/networks/${encodeURIComponent(networkId)}/ancestors`);
}

export async function listNetworkTypes(rootNetworkId?: string | null): Promise<NetworkType[]> {
  return requestJson<NetworkType[]>(`/network-types${toQueryString({ rootNetworkId: rootNetworkId ?? undefined })}`);
}

export async function getNetworkType(id: string): Promise<NetworkType | null> {
  return requestJson<NetworkType | null>(`/network-types/${encodeURIComponent(id)}`);
}

export async function createNetworkType(data: NetworkTypeCreate): Promise<NetworkType> {
  return requestJson<NetworkType>('/network-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNetworkType(id: string, data: NetworkTypeUpdate): Promise<NetworkType | null> {
  return requestJson<NetworkType | null>(`/network-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteNetworkType(id: string): Promise<boolean> {
  return requestJson<boolean>(`/network-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listNodeTypes(networkTypeId: string): Promise<NetworkNodeType[]> {
  return requestJson<NetworkNodeType[]>(`/network-types/${encodeURIComponent(networkTypeId)}/node-types`);
}

export async function createNodeType(data: NetworkNodeTypeCreate): Promise<NetworkNodeType> {
  return requestJson<NetworkNodeType>('/node-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNodeType(id: string, data: NetworkNodeTypeUpdate): Promise<NetworkNodeType | null> {
  return requestJson<NetworkNodeType | null>(`/node-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteNodeType(id: string): Promise<boolean> {
  return requestJson<boolean>(`/node-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listEdgeTypes(networkTypeId: string): Promise<NetworkEdgeType[]> {
  return requestJson<NetworkEdgeType[]>(`/network-types/${encodeURIComponent(networkTypeId)}/edge-types`);
}

export async function createEdgeType(data: NetworkEdgeTypeCreate): Promise<NetworkEdgeType> {
  return requestJson<NetworkEdgeType>('/edge-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEdgeType(id: string, data: NetworkEdgeTypeUpdate): Promise<NetworkEdgeType | null> {
  return requestJson<NetworkEdgeType | null>(`/edge-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteEdgeType(id: string): Promise<boolean> {
  return requestJson<boolean>(`/edge-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function createNetworkNode(data: NetworkNodeCreate): Promise<NetworkNode> {
  return requestJson<NetworkNode>('/network-nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getNetworkNode(id: string): Promise<NetworkNode | null> {
  return requestJson<NetworkNode | null>(`/network-nodes/${encodeURIComponent(id)}`);
}

export async function updateNetworkNode(id: string, data: NetworkNodeUpdate): Promise<NetworkNode> {
  return requestJson<NetworkNode>(`/network-nodes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteNetworkNode(id: string): Promise<boolean> {
  return requestJson<boolean>(`/network-nodes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRelationships(query: {
  rootNetworkId: string;
  sourceObjectId?: string;
  targetObjectId?: string;
  meaningId?: string;
}): Promise<Relationship[]> {
  return requestJson<Relationship[]>(`/relationships${toQueryString(query)}`);
}

export async function createRelationship(data: RelationshipCreate): Promise<Relationship> {
  return requestJson<Relationship>('/relationships', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRelationship(id: string): Promise<Relationship | null> {
  return requestJson<Relationship | null>(`/relationships/${encodeURIComponent(id)}`);
}

export async function updateRelationship(id: string, data: RelationshipUpdate): Promise<Relationship | null> {
  return requestJson<Relationship | null>(`/relationships/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRelationship(id: string): Promise<boolean> {
  return requestJson<boolean>(`/relationships/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRelationshipOccurrences(relationshipId: string): Promise<unknown[]> {
  return requestJson<unknown[]>(`/relationships/${encodeURIComponent(relationshipId)}/occurrences`);
}

export async function createEdge(data: EdgeCreate): Promise<Edge> {
  return requestJson<Edge>('/edges', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getEdge(id: string): Promise<Edge | null> {
  return requestJson<Edge | null>(`/edges/${encodeURIComponent(id)}`);
}

export async function updateEdge(id: string, data: EdgeUpdate): Promise<Edge | null> {
  return requestJson<Edge | null>(`/edges/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteEdge(id: string): Promise<boolean> {
  return requestJson<boolean>(`/edges/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getFileEntity(fileId: string): Promise<FileEntity | null> {
  return requestJson<FileEntity | null>(`/files/${encodeURIComponent(fileId)}`);
}

export async function getInstanceProperties(instanceId: string): Promise<InstanceProperty[]> {
  return requestJson<InstanceProperty[]>(`/instance-properties${toQueryString({ instanceId })}`);
}

export async function upsertInstanceProperty(data: InstancePropertyUpsert): Promise<InstanceProperty> {
  return requestJson<InstanceProperty>('/instance-properties', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteInstanceProperty(id: string): Promise<boolean> {
  return requestJson<boolean>(`/instance-properties/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listInteractiveViewTemplates(
  query: InteractiveViewTemplateListQuery,
): Promise<InteractiveViewTemplate[]> {
  return requestJson<InteractiveViewTemplate[]>(`/interactive-view-templates${toQueryString({
    rootNetworkId: query.rootNetworkId,
    schemaId: query.schemaId ?? undefined,
    instanceId: query.instanceId ?? undefined,
  })}`);
}

export async function createInteractiveViewTemplate(
  data: InteractiveViewTemplateCreate,
): Promise<InteractiveViewTemplate> {
  return requestJson<InteractiveViewTemplate>('/interactive-view-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getInteractiveViewTemplate(
  id: string,
): Promise<InteractiveViewTemplate | null> {
  return requestJson<InteractiveViewTemplate | null>(`/interactive-view-templates/${encodeURIComponent(id)}`);
}

export async function updateInteractiveViewTemplate(
  id: string,
  data: InteractiveViewTemplateUpdate,
): Promise<InteractiveViewTemplate | null> {
  return requestJson<InteractiveViewTemplate | null>(`/interactive-view-templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function upsertInteractiveViewPreference(
  data: InteractiveViewPreferenceUpsert,
): Promise<InteractiveViewPreference> {
  return requestJson<InteractiveViewPreference>('/interactive-view-preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function upsertInteractiveViewSchemaPreference(
  data: InteractiveViewSchemaPreferenceUpsert,
): Promise<InteractiveViewSchemaPreference> {
  return requestJson<InteractiveViewSchemaPreference>('/interactive-view-schema-preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function updateFileEntity(id: string, data: FileEntityUpdate): Promise<FileEntity | null> {
  return requestJson<FileEntity | null>(`/files/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateFileMetadataField(
  fileId: string,
  field: string,
  value: unknown,
): Promise<FileEntity | null> {
  const entity = await getFileEntity(fileId);
  if (!entity) {
    return null;
  }

  const metadata = entity.metadata ? JSON.parse(entity.metadata) as Record<string, unknown> : {};
  metadata[field] = value;
  return updateFileEntity(fileId, { metadata: JSON.stringify(metadata) });
}
