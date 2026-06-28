import { publishDomainChange } from '../events/event-bus';

export function changed<T extends { id: string }>(
  operationId: string | null,
  entity: string,
  action: string,
  result: T,
): T {
  publishDomainChange({ operationId, entity, action, id: result.id, payload: result });
  return result;
}

export function changedWithId<T>(
  operationId: string | null,
  entity: string,
  action: string,
  id: string,
  result: T,
): T {
  publishDomainChange({ operationId, entity, action, id, payload: result });
  return result;
}

export function changedBoolean(
  operationId: string | null,
  entity: string,
  action: string,
  id: string,
  result: boolean,
): boolean {
  if (result) publishDomainChange({ operationId, entity, action, id });
  return result;
}
