import type { IncomingMessage, ServerResponse } from 'http';
import { publishEvent, subscribe } from './event-bus';

export function handleSseRequest(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const write = (event: unknown): void => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  write(publishEvent({
    operationId: null,
    rootId: null,
    type: 'service.ready',
    entity: null,
    action: null,
    id: null,
  }));

  const unsubscribe = subscribe(write);
  const heartbeat = setInterval(() => {
    write(publishEvent({
      operationId: null,
      rootId: null,
      type: 'heartbeat',
      entity: null,
      action: null,
      id: null,
    }));
  }, 30_000);

  res.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}
