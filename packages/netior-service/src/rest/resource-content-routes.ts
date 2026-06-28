import { dirname, resolve, sep } from 'path';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import type { IncomingMessage, ServerResponse } from 'http';
import { getResource, getWorld } from '@netior/core';
import { readBufferBody, sendJson } from '../http/json';
import { publishEvent } from '../events/event-bus';

export async function handleResourceContentRequest(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const match = url.pathname.match(/^\/resources\/([^/]+)\/content$/);
  if (!match) {
    sendJson(res, 404, { ok: false, error: 'Resource content route not found' });
    return;
  }

  const resourceId = decodeURIComponent(match[1]);
  const method = req.method ?? 'GET';

  try {
    if (method === 'GET') {
      await handleGetResourceContent(res, resourceId);
      return;
    }
    if (method === 'PUT') {
      await handlePutResourceContent(req, res, resourceId);
      return;
    }
    if (method === 'DELETE') {
      await handleDeleteResourceContent(res, resourceId);
      return;
    }
    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed` });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: (error as Error).message });
  }
}

async function handleGetResourceContent(res: ServerResponse, resourceId: string): Promise<void> {
  const resourcePath = resolveResourcePath(resourceId);
  const content = await readFile(resourcePath.absolutePath);
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': content.byteLength,
  });
  res.end(content);
}

async function handlePutResourceContent(req: IncomingMessage, res: ServerResponse, resourceId: string): Promise<void> {
  const resourcePath = resolveResourcePath(resourceId);
  const content = await readBufferBody(req);
  await mkdir(dirname(resourcePath.absolutePath), { recursive: true });
  await writeFile(resourcePath.absolutePath, content);
  publishEvent({
    operationId: null,
    rootId: resourcePath.rootId,
    type: 'resource.content.changed',
    entity: 'resource',
    action: 'updated',
    id: resourceId,
  });
  sendJson(res, 200, { ok: true, data: { id: resourceId, bytes: content.byteLength } });
}

async function handleDeleteResourceContent(res: ServerResponse, resourceId: string): Promise<void> {
  const resourcePath = resolveResourcePath(resourceId);
  await rm(resourcePath.absolutePath, { force: true });
  publishEvent({
    operationId: null,
    rootId: resourcePath.rootId,
    type: 'resource.content.changed',
    entity: 'resource',
    action: 'deleted',
    id: resourceId,
  });
  sendJson(res, 200, { ok: true, data: true });
}

function resolveResourcePath(resourceId: string): { absolutePath: string; rootId: string } {
  const resource = getResource(resourceId);
  if (!resource) throw new Error('Resource not found');
  if (resource.source_kind !== 'file' && resource.source_kind !== 'folder') {
    throw new Error('Only file resources have local content');
  }
  if (!resource.relative_path) throw new Error('File resource relative_path is required');

  const world = getWorld(resource.root_id);
  if (!world) throw new Error('World not found');

  const root = resolve(world.root_uri);
  const absolutePath = resolve(root, resource.relative_path);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    throw new Error('Resource path is outside the world root');
  }

  return { absolutePath, rootId: world.id };
}
