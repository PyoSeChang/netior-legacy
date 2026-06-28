import * as domain from '@netior/core';
import { changed, changedBoolean } from '../change-events';
import { optionalString, requireString } from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerRelationOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'relation.create', ({ operationId, params }) => changed(operationId, 'relation', 'created', domain.createRelationAssertion({
    subject_instance_id: requireString(params.subject_instance_id ?? params.subjectInstanceId, 'subject_instance_id'),
    subject_kind_id: requireString(params.subject_kind_id ?? params.subjectKindId, 'subject_kind_id'),
    relation_kind_id: requireString(params.relation_kind_id ?? params.relationKindId, 'relation_kind_id'),
    object_instance_id: requireString(params.object_instance_id ?? params.objectInstanceId, 'object_instance_id'),
    object_kind_id: requireString(params.object_kind_id ?? params.objectKindId, 'object_kind_id'),
    status: optionalString(params.status) as never,
    created_by: optionalString(params.created_by ?? params.createdBy),
  })));
  registerOperation(registry, 'relation.get', ({ params }) => domain.getRelationAssertion(requireString(params.id ?? params.relationId, 'id')));
  registerOperation(registry, 'relation.list', ({ params }) => domain.listRelationAssertions(requireString(params.model_id ?? params.modelId ?? params.instance_id ?? params.instanceId, 'model_id')));
  registerOperation(registry, 'relation.accept', ({ operationId, params }) => changed(operationId, 'relation', 'accepted', domain.acceptRelation(requireString(params.id ?? params.relationId, 'id'))));
  registerOperation(registry, 'relation.reject', ({ operationId, params }) => changed(operationId, 'relation', 'rejected', domain.rejectRelation(requireString(params.id ?? params.relationId, 'id'))));
  registerOperation(registry, 'relation.supersede', ({ operationId, params }) => changed(operationId, 'relation', 'superseded', domain.supersedeRelation(requireString(params.id ?? params.relationId, 'id'))));
  registerOperation(registry, 'relation.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'relation',
    'archived',
    requireString(params.id ?? params.relationId, 'id'),
    Boolean(domain.archiveRelation(requireString(params.id ?? params.relationId, 'id'))),
  ));
  registerOperation(registry, 'relation.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'relation',
    'deleted',
    requireString(params.id ?? params.relationId, 'id'),
    domain.deleteRelationAssertion(requireString(params.id ?? params.relationId, 'id')),
  ));
}
