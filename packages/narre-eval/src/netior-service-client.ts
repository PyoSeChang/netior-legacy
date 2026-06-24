import type {
  Schema,
  SchemaCreate,
  FileEntity,
  FileEntityCreate,
  Module,
  ModuleCreate,
  World,
  WorldCreate,
  Meaning,
  MeaningCreate,
  NetiorServiceResponse,
  Instance,
  InstanceCreate,
  InstanceProperty,
  InstancePropertyUpsert,
  SchemaField,
  SchemaFieldCreate,
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

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
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

export async function createWorld(baseUrl: string, data: WorldCreate): Promise<World> {
  return requestJson<World>(baseUrl, '/worlds', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWorldById(baseUrl: string, rootNetworkId: string): Promise<World | null> {
  return requestJson<World | null>(baseUrl, `/worlds/${encodeURIComponent(rootNetworkId)}`);
}

export async function createSchema(baseUrl: string, data: SchemaCreate): Promise<Schema> {
  return requestJson<Schema>(baseUrl, '/schemas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listSchemas(baseUrl: string, rootNetworkId: string): Promise<Schema[]> {
  return requestJson<Schema[]>(baseUrl, `/schemas${toQueryString({ rootNetworkId })}`);
}

export async function createMeaning(baseUrl: string, data: MeaningCreate): Promise<Meaning> {
  return requestJson<Meaning>(baseUrl, '/meanings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listMeanings(baseUrl: string, rootNetworkId: string): Promise<Meaning[]> {
  return requestJson<Meaning[]>(baseUrl, `/meanings${toQueryString({ rootNetworkId })}`);
}


export async function createInstance(baseUrl: string, data: InstanceCreate): Promise<Instance> {
  return requestJson<Instance>(baseUrl, '/instances', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createSchemaField(baseUrl: string, data: SchemaFieldCreate): Promise<SchemaField> {
  return requestJson<SchemaField>(baseUrl, '/schema-fields', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function upsertInstanceProperty(
  baseUrl: string,
  data: InstancePropertyUpsert,
): Promise<InstanceProperty> {
  return requestJson<InstanceProperty>(baseUrl, '/instance-properties', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createModule(baseUrl: string, data: ModuleCreate): Promise<Module> {
  return requestJson<Module>(baseUrl, '/modules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createFileEntity(baseUrl: string, data: FileEntityCreate): Promise<FileEntity> {
  return requestJson<FileEntity>(baseUrl, '/files', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function evalQuery<T extends Record<string, unknown>>(
  baseUrl: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return requestJson<T[]>(baseUrl, '/eval/query', {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  });
}
