import type { IncomingMessage, ServerResponse } from 'http';
import { NETIOR_SERVICE_ROUTES } from '@netior/shared';
import { handleSseRequest } from './events/sse-routes';
import { sendJson } from './http/json';
import { handleResourceContentRequest } from './rest/resource-content-routes';
import { handleJsonRpcRequest } from './rpc/json-rpc';

export function createRequestHandler(): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      console.error('[netior-service] Unhandled request error:', error);
      sendJson(res, 500, { ok: false, error: (error as Error).message });
    }
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

  if (method === 'GET' && url.pathname === NETIOR_SERVICE_ROUTES.health) {
    sendJson(res, 200, {
      ok: true,
      data: {
        status: 'ok',
        pid: process.pid,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (method === 'POST' && url.pathname === NETIOR_SERVICE_ROUTES.rpc) {
    await handleJsonRpcRequest(req, res);
    return;
  }

  if (method === 'GET' && url.pathname === NETIOR_SERVICE_ROUTES.events) {
    handleSseRequest(req, res);
    return;
  }

  if (url.pathname.startsWith(`${NETIOR_SERVICE_ROUTES.resourceContentPrefix}/`)) {
    await handleResourceContentRequest(req, res, url);
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Route not found' });
}
