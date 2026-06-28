import * as domain from '@netior/core';
import { changed } from '../change-events';
import { optionalJson, optionalString, requireString } from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerEventOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'decision.record', ({ operationId, params }) => changed(operationId, 'decision', 'recorded', domain.recordDecision({
    target_type: requireString(params.target_type ?? params.targetType, 'target_type') as never,
    target_id: requireString(params.target_id ?? params.targetId, 'target_id'),
    decision_type: requireString(params.decision_type ?? params.decisionType, 'decision_type') as never,
    decided_status: requireString(params.decided_status ?? params.decidedStatus, 'decided_status') as never,
    reason: optionalString(params.reason),
    created_by: optionalString(params.created_by ?? params.createdBy),
  })));
  registerOperation(registry, 'decision.get', ({ params }) => domain.getDecision(requireString(params.id ?? params.decisionId, 'id')));
  registerOperation(registry, 'decision.listForTarget', ({ params }) => domain.listDecisionsForTarget(
    requireString(params.target_type ?? params.targetType, 'target_type'),
    requireString(params.target_id ?? params.targetId, 'target_id'),
  ));

  registerOperation(registry, 'domainEvent.record', ({ operationId, params }) => changed(operationId, 'domainEvent', 'recorded', domain.recordDomainEvent({
    root_id: requireString(params.root_id ?? params.rootId ?? params.world_id ?? params.worldId, 'root_id'),
    model_id: optionalString(params.model_id ?? params.modelId),
    event_type: requireString(params.event_type ?? params.eventType, 'event_type'),
    target_type: optionalString(params.target_type ?? params.targetType),
    target_id: optionalString(params.target_id ?? params.targetId),
    payload_json: optionalJson(params.payload_json ?? params.payload),
    created_by: optionalString(params.created_by ?? params.createdBy),
  })));
  registerOperation(registry, 'domainEvent.get', ({ params }) => domain.getDomainEvent(requireString(params.id ?? params.eventId, 'id')));
  registerOperation(registry, 'domainEvent.list', ({ params }) => domain.listDomainEvents(requireString(params.root_id ?? params.rootId ?? params.world_id ?? params.worldId, 'root_id')));
  registerOperation(registry, 'domainEvent.listByTarget', ({ params }) => domain.listDomainEventsByTarget(
    requireString(params.target_type ?? params.targetType, 'target_type'),
    requireString(params.target_id ?? params.targetId, 'target_id'),
  ));
}
