import { NETIOR_SERVICE_ROUTES, type JsonRpcResponse, type NetiorServiceEvent } from '@netior/shared';
import { request as httpRequest } from 'http';
import { getNetiorServiceBaseUrl } from '../process/netior-service-manager';

export interface ResourceContentPayload {
  contentType: string | null;
  base64: string;
  byteLength: number;
}

export interface ResourceContentWriteInput {
  base64?: string;
  text?: string;
  contentType?: string;
}

export async function callNetiorRpc<T = unknown>(method: string, params?: unknown): Promise<T> {
  const baseUrl = getNetiorServiceBaseUrl();
  if (!baseUrl) {
    throw new Error('Netior service is not running');
  }

  const response = await fetch(`${baseUrl}${NETIOR_SERVICE_ROUTES.rpc}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${Date.now()}:${Math.random().toString(16).slice(2)}`,
      method,
      params: params ?? {},
    }),
  });

  let payload: JsonRpcResponse<T>;
  try {
    payload = await response.json() as JsonRpcResponse<T>;
  } catch (error) {
    throw new Error(`Invalid JSON-RPC response from Netior service: ${(error as Error).message}`);
  }

  if (!response.ok) {
    throw new Error(`Netior service RPC failed: ${response.status}`);
  }

  if ('error' in payload && payload.error) {
    throw new Error(payload.error.message);
  }

  if ('result' in payload) {
    return payload.result;
  }

  throw new Error('Invalid JSON-RPC response from Netior service: missing result');
}

export async function readRemoteResourceContent(resourceId: string): Promise<ResourceContentPayload> {
  const baseUrl = getNetiorServiceBaseUrl();
  if (!baseUrl) {
    throw new Error('Netior service is not running');
  }

  const response = await fetch(`${baseUrl}/resources/${encodeURIComponent(resourceId)}/content`);
  if (!response.ok) {
    throw new Error(`Resource content read failed: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    contentType: response.headers.get('content-type'),
    base64: bytes.toString('base64'),
    byteLength: bytes.byteLength,
  };
}

export async function writeRemoteResourceContent(resourceId: string, input: ResourceContentWriteInput): Promise<unknown> {
  const baseUrl = getNetiorServiceBaseUrl();
  if (!baseUrl) {
    throw new Error('Netior service is not running');
  }

  const body = input.base64 !== undefined
    ? Buffer.from(input.base64, 'base64')
    : Buffer.from(input.text ?? '', 'utf8');

  const response = await fetch(`${baseUrl}/resources/${encodeURIComponent(resourceId)}/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': input.contentType ?? 'application/octet-stream',
    },
    body,
  });

  const payload = await response.json().catch(() => null) as { ok?: boolean; data?: unknown; error?: string } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Resource content write failed: ${response.status}`);
  }

  return payload.data;
}

export async function deleteRemoteResourceContent(resourceId: string): Promise<unknown> {
  const baseUrl = getNetiorServiceBaseUrl();
  if (!baseUrl) {
    throw new Error('Netior service is not running');
  }

  const response = await fetch(`${baseUrl}/resources/${encodeURIComponent(resourceId)}/content`, {
    method: 'DELETE',
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; data?: unknown; error?: string } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Resource content delete failed: ${response.status}`);
  }

  return payload.data;
}

export function subscribeRemoteEvents(
  onEvent: (event: NetiorServiceEvent) => void,
  onError?: (error: Error) => void,
): () => void {
  const baseUrl = getNetiorServiceBaseUrl();
  if (!baseUrl) {
    onError?.(new Error('Netior service is not running'));
    return () => {};
  }

  const eventsUrl = new URL(NETIOR_SERVICE_ROUTES.events, baseUrl);
  const req = httpRequest(eventsUrl, { method: 'GET' }, (res) => {
    res.setEncoding('utf8');
    let buffer = '';

    res.on('data', (chunk: string) => {
      buffer += chunk;
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const dataLines = part
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart());
        if (dataLines.length === 0) continue;
        try {
          onEvent(JSON.parse(dataLines.join('\n')) as NetiorServiceEvent);
        } catch (error) {
          onError?.(error as Error);
        }
      }
    });
  });

  req.on('error', (error) => onError?.(error));
  req.end();

  return () => {
    req.destroy();
  };
}
