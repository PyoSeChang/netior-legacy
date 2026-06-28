import * as domain from '@netior/core';
import { changed, changedBoolean } from '../change-events';
import { optionalString, requireString } from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerEvidenceOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'evidence.create', ({ operationId, params }) => changed(operationId, 'evidence', 'created', domain.createEvidence({
    evidence_type: requireString(params.evidence_type ?? params.evidenceType ?? 'user_input', 'evidence_type') as never,
    resource_id: optionalString(params.resource_id ?? params.resourceId),
    locator: optionalString(params.locator),
    summary: optionalString(params.summary ?? params.note ?? params.quote),
    created_by: optionalString(params.created_by ?? params.createdBy),
  })));
  registerOperation(registry, 'evidence.get', ({ params }) => domain.getEvidence(requireString(params.id ?? params.evidenceId, 'id')));
  registerOperation(registry, 'evidence.listForTarget', ({ params }) => domain.listEvidence(
    requireString(params.target_type ?? params.targetType, 'target_type'),
    requireString(params.target_id ?? params.targetId, 'target_id'),
  ));
  registerOperation(registry, 'evidence.linkToTarget', ({ operationId, params }) => changed(operationId, 'evidenceLink', 'created', domain.linkEvidenceToTarget({
    evidence_id: requireString(params.evidence_id ?? params.evidenceId ?? params.id, 'evidence_id'),
    target_type: requireString(params.target_type ?? params.targetType, 'target_type') as never,
    target_id: requireString(params.target_id ?? params.targetId, 'target_id'),
    support_type: optionalString(params.support_type ?? params.supportType) as never,
  })));
  registerOperation(registry, 'evidence.unlinkFromTarget', ({ operationId, params }) => changedBoolean(
    operationId,
    'evidenceLink',
    'deleted',
    requireString(params.id ?? params.linkId, 'id'),
    domain.unlinkEvidenceFromTarget(requireString(params.id ?? params.linkId, 'id')),
  ));
  registerOperation(registry, 'evidence.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'evidence',
    'archived',
    requireString(params.id ?? params.evidenceId, 'id'),
    Boolean(domain.archiveEvidence(requireString(params.id ?? params.evidenceId, 'id'))),
  ));
  registerOperation(registry, 'evidence.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'evidence',
    'deleted',
    requireString(params.id ?? params.evidenceId, 'id'),
    domain.deleteEvidence(requireString(params.id ?? params.evidenceId, 'id')),
  ));
}
