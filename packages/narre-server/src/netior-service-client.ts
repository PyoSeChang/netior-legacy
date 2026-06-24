import type {
  NetiorServiceResponse,
  Network,
  NetworkType,
  NetworkTreeNode,
  World,
  Instance,
  Meaning,
  Schema,
  SchemaField,
  SchemaMeaning,
} from '@netior/shared/types';

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

export function getNetiorServiceUrl(): string {
  return process.env.NETIOR_SERVICE_URL ?? `http://127.0.0.1:${process.env.NETIOR_SERVICE_PORT ?? '3201'}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getNetiorServiceUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let payload: NetiorServiceResponse<T>;
  try {
    payload = await response.json() as NetiorServiceResponse<T>;
  } catch (error) {
    throw new Error(`Invalid JSON from Netior service: ${(error as Error).message}`);
  }

  if (!response.ok) {
    if (!payload.ok) {
      throw new Error(payload.error);
    }
    throw new Error(`Netior service request failed: ${response.status}`);
  }

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

export async function getWorldById(rootNetworkId: string): Promise<World | null> {
  return requestJson<World | null>(`/worlds/${encodeURIComponent(rootNetworkId)}`);
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

export async function listMeanings(rootNetworkId: string): Promise<Meaning[]> {
  return requestJson<Meaning[]>(`/meanings${toQueryString({ rootNetworkId })}`);
}

export async function listMeaningCategories(rootNetworkId: string): Promise<Instance[]> {
  return requestJson<Instance[]>(`/meaning-categories${toQueryString({ rootNetworkId })}`);
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

export async function listNetworkTypes(rootNetworkId: string): Promise<NetworkType[]> {
  return requestJson<NetworkType[]>(`/network-types${toQueryString({ rootNetworkId })}`);
}
