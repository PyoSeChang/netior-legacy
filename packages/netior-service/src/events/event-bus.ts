import { randomUUID } from 'crypto';
import type { NetiorServiceEvent } from '@netior/shared';

type Listener = (event: NetiorServiceEvent) => void;

let revision = 0;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishEvent(input: Omit<NetiorServiceEvent, 'eventId' | 'revision' | 'timestamp'>): NetiorServiceEvent {
  const event: NetiorServiceEvent = {
    ...input,
    eventId: randomUUID(),
    revision: ++revision,
    timestamp: new Date().toISOString(),
  };
  for (const listener of listeners) {
    listener(event);
  }
  return event;
}

export function publishDomainChange(input: {
  operationId?: string | null;
  rootId?: string | null;
  entity: string;
  action: string;
  id?: string | null;
  payload?: unknown;
}): NetiorServiceEvent {
  return publishEvent({
    operationId: input.operationId ?? null,
    rootId: input.rootId ?? null,
    type: 'domain.changed',
    entity: input.entity,
    action: input.action,
    id: input.id ?? null,
    payload: input.payload,
  });
}
