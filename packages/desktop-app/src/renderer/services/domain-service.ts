import {
  NETIOR_RPC_METHODS,
  type DomainSnapshot,
  type ViewItemRecord,
  type ViewRecord,
  type JsonRpcFailure,
  type JsonRpcResponse,
  type NetiorRpcMethod,
} from '@netior/shared';
import { unwrapIpc } from './ipc';

type IpcResult<T> = { success: true; data: T } | { success: false; error: string };

interface DomainBridge {
  domain?: {
    rpc?: <TResult = unknown>(method: string, params?: unknown) => Promise<IpcResult<TResult> | TResult>;
  };
  netior?: {
    rpc?: {
      call?: <TResult = unknown>(method: string, params?: unknown) => Promise<IpcResult<TResult> | TResult>;
    } | (<TResult = unknown>(method: string, params?: unknown) => Promise<IpcResult<TResult> | TResult>);
  };
}

type DomainRpc = <TResult = unknown>(method: string, params?: unknown) => Promise<IpcResult<TResult> | TResult>;

const DEFAULT_SERVICE_URL = 'http://127.0.0.1:3201';

function getServiceUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_SERVICE_URL;
  }
  return window.localStorage?.getItem('netior:serviceUrl') ?? DEFAULT_SERVICE_URL;
}

function getBridgeRpc(): DomainRpc | undefined {
  const bridge = window.electron as unknown as DomainBridge | undefined;
  if (typeof bridge?.domain?.rpc === 'function') return bridge.domain.rpc;
  if (typeof bridge?.netior?.rpc === 'function') return bridge.netior.rpc;
  if (typeof bridge?.netior?.rpc?.call === 'function') return bridge.netior.rpc.call;
  return undefined;
}

function isJsonRpcFailure(response: JsonRpcResponse<unknown>): response is JsonRpcFailure {
  return 'error' in response;
}

async function requestRpc<TResult>(method: NetiorRpcMethod, params?: unknown): Promise<TResult> {
  const bridgeRpc = getBridgeRpc();
  if (bridgeRpc) {
    const result = await bridgeRpc<TResult>(method, params);
    if (result && typeof result === 'object' && 'success' in result) {
      return unwrapIpc(result as IpcResult<TResult>);
    }
    return result as TResult;
  }

  const response = await fetch(`${getServiceUrl()}/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Netior RPC failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json() as JsonRpcResponse<TResult>;
  if (isJsonRpcFailure(body)) {
    throw new Error(body.error.message);
  }
  return body.result;
}

export async function getDomainSnapshot(rootId?: string | null): Promise<DomainSnapshot> {
  return requestRpc<DomainSnapshot>(NETIOR_RPC_METHODS.domainSnapshot, rootId ? { rootId, worldId: rootId } : undefined);
}

export interface ViewProjection {
  view: ViewRecord | null;
  items: ViewItemRecord[];
}

export async function projectView(viewId: string): Promise<ViewProjection> {
  return requestRpc<ViewProjection>(NETIOR_RPC_METHODS.viewProject, { viewId });
}

export async function saveViewLayout(
  viewId: string,
  items: Array<Pick<ViewItemRecord, 'id'> & Partial<Pick<ViewItemRecord, 'layout_json' | 'state_json' | 'overrides_json'>>>,
): Promise<ViewItemRecord[]> {
  return requestRpc<ViewItemRecord[]>(NETIOR_RPC_METHODS.viewSaveLayout, { viewId, items });
}

export const domainService = {
  rpc: requestRpc,
  getSnapshot: getDomainSnapshot,
  projectView,
  saveViewLayout,
};
