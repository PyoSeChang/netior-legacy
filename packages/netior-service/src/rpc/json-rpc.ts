import type { IncomingMessage, ServerResponse } from 'http';
import type { JsonRpcRequest, JsonRpcResponse } from '@netior/shared';
import { readJsonBody, sendJson } from '../http/json';
import { JsonRpcProtocolError, jsonRpcErrorCode, jsonRpcErrorMessage } from '../errors';
import { dispatchDomainOperation } from '../application/domain-service';

export async function handleJsonRpcRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let id: string | number | null = null;
  try {
    const request = await readJsonBody<JsonRpcRequest>(req);
    validateJsonRpcRequest(request);
    id = request.id ?? null;
    const result = dispatchDomainOperation(request.method, request.params, id);
    sendJson(res, 200, {
      jsonrpc: '2.0',
      id,
      result,
    } satisfies JsonRpcResponse);
  } catch (error) {
    const code = jsonRpcErrorCode(error);
    sendJson(res, 200, {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message: jsonRpcErrorMessage(error),
      },
    } satisfies JsonRpcResponse);
  }
}

function validateJsonRpcRequest(request: JsonRpcRequest): void {
  if (!request || typeof request !== 'object') {
    throw new JsonRpcProtocolError(-32600, 'Invalid JSON-RPC request');
  }
  if (request.jsonrpc !== '2.0') {
    throw new JsonRpcProtocolError(-32600, 'Invalid JSON-RPC version');
  }
  if (typeof request.method !== 'string' || request.method.length === 0) {
    throw new JsonRpcProtocolError(-32600, 'JSON-RPC method is required');
  }
}
