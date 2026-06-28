import * as domain from '@netior/core';
import { changed, changedBoolean, changedWithId } from '../change-events';
import { JsonRpcProtocolError } from '../../errors';
import {
  optionalBooleanNumber,
  optionalString,
  requireString,
} from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerDefinitionOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'kind.create', ({ operationId, params }) => changed(operationId, 'kind', 'created', domain.createKind({
    model_id: requireString(params.model_id ?? params.modelId, 'model_id'),
    key: domain.assertDomainKey(requireString(params.key, 'key'), 'kind key'),
    name: requireString(params.name, 'name'),
    description: optionalString(params.description),
    icon_type: optionalString(params.icon_type ?? params.iconType) as never,
    icon_key: optionalString(params.icon_key ?? params.iconKey ?? params.icon),
  })));
  registerOperation(registry, 'kind.get', ({ params }) => domain.getKind(requireString(params.id ?? params.kindId, 'id')));
  registerOperation(registry, 'kind.list', ({ params }) => domain.listKinds(requireString(params.model_id ?? params.modelId, 'model_id')));
  registerOperation(registry, 'kind.listVisible', ({ params }) => domain.listKinds(requireString(params.model_id ?? params.modelId, 'model_id')));
  registerOperation(registry, 'kind.rename', ({ operationId, params }) => changed(operationId, 'kind', 'renamed', domain.updateKind(
    requireString(params.id ?? params.kindId, 'id'),
    { name: requireString(params.name, 'name') },
  )));
  registerOperation(registry, 'kind.updateKey', ({ operationId, params }) => changed(operationId, 'kind', 'keyUpdated', domain.updateKind(
    requireString(params.id ?? params.kindId, 'id'),
    { key: domain.assertDomainKey(requireString(params.key, 'key'), 'kind key') },
  )));
  registerOperation(registry, 'kind.updateDescription', ({ operationId, params }) => changed(operationId, 'kind', 'descriptionUpdated', domain.updateKind(
    requireString(params.id ?? params.kindId, 'id'),
    { description: optionalString(params.description) },
  )));
  registerOperation(registry, 'kind.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'kind',
    'archived',
    requireString(params.id ?? params.kindId, 'id'),
    Boolean(domain.archiveKind(requireString(params.id ?? params.kindId, 'id'))),
  ));
  registerOperation(registry, 'kind.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'kind',
    'deleted',
    requireString(params.id ?? params.kindId, 'id'),
    domain.deleteKind(requireString(params.id ?? params.kindId, 'id')),
  ));

  registerOperation(registry, 'property.create', ({ operationId, params }) => changed(operationId, 'property', 'created', domain.createProperty({
    kind_id: requireString(params.kind_id ?? params.kindId, 'kind_id'),
    key: domain.assertDomainKey(requireString(params.key, 'key'), 'property key'),
    name: requireString(params.name, 'name'),
    value_type: requireString(params.value_type ?? params.valueType, 'value_type') as never,
    cardinality: optionalString(params.cardinality) as never,
    required_policy: optionalString(params.required_policy ?? params.requiredPolicy) as never,
    sort_order: typeof params.sort_order === 'number' ? params.sort_order : typeof params.sortOrder === 'number' ? params.sortOrder : 0,
  })));
  registerOperation(registry, 'property.get', ({ params }) => domain.getProperty(requireString(params.id ?? params.propertyId, 'id')));
  registerOperation(registry, 'property.list', ({ params }) => domain.listProperties(requireString(params.kind_id ?? params.kindId, 'kind_id')));
  registerOperation(registry, 'property.rename', ({ operationId, params }) => changed(operationId, 'property', 'renamed', domain.updateProperty(
    requireString(params.id ?? params.propertyId, 'id'),
    { name: requireString(params.name, 'name') },
  )));
  registerOperation(registry, 'property.updateKey', ({ operationId, params }) => changed(operationId, 'property', 'keyUpdated', domain.updateProperty(
    requireString(params.id ?? params.propertyId, 'id'),
    { key: domain.assertDomainKey(requireString(params.key, 'key'), 'property key') },
  )));
  registerOperation(registry, 'property.updateDescription', ({ operationId, params }) => changed(operationId, 'property', 'descriptionUpdated', domain.updateProperty(
    requireString(params.id ?? params.propertyId, 'id'),
    { description: optionalString(params.description) },
  )));
  registerOperation(registry, 'property.updateValueType', ({ operationId, params }) => changed(operationId, 'property', 'valueTypeUpdated', domain.updateProperty(
    requireString(params.id ?? params.propertyId, 'id'),
    { value_type: requireString(params.value_type ?? params.valueType, 'value_type') as never },
  )));
  registerOperation(registry, 'property.updateCardinality', ({ operationId, params }) => changed(operationId, 'property', 'cardinalityUpdated', domain.updateProperty(
    requireString(params.id ?? params.propertyId, 'id'),
    { cardinality: requireString(params.cardinality, 'cardinality') as never },
  )));
  registerOperation(registry, 'property.updateRequiredPolicy', ({ operationId, params }) => changed(operationId, 'property', 'requiredPolicyUpdated', domain.updateProperty(
    requireString(params.id ?? params.propertyId, 'id'),
    { required_policy: requireString(params.required_policy ?? params.requiredPolicy, 'required_policy') as never },
  )));
  registerOperation(registry, 'property.reorder', ({ operationId, params }) => changed(operationId, 'property', 'reordered', domain.updateProperty(
    requireString(params.id ?? params.propertyId, 'id'),
    { sort_order: typeof params.sort_order === 'number' ? params.sort_order : typeof params.sortOrder === 'number' ? params.sortOrder : 0 },
  )));
  registerOperation(registry, 'property.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'property',
    'archived',
    requireString(params.id ?? params.propertyId, 'id'),
    Boolean(domain.archiveProperty(requireString(params.id ?? params.propertyId, 'id'))),
  ));
  registerOperation(registry, 'property.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'property',
    'deleted',
    requireString(params.id ?? params.propertyId, 'id'),
    domain.deleteProperty(requireString(params.id ?? params.propertyId, 'id')),
  ));

  registerOperation(registry, 'relationKind.create', ({ operationId, params }) => changed(operationId, 'relationKind', 'created', domain.createRelationKind({
    model_id: requireString(params.model_id ?? params.modelId, 'model_id'),
    key: domain.assertDomainKey(requireString(params.key, 'key'), 'relation kind key'),
    name: requireString(params.name, 'name'),
    description: optionalString(params.description),
    directed: optionalBooleanNumber(params.directed),
    icon_type: optionalString(params.icon_type ?? params.iconType) as never,
    icon_key: optionalString(params.icon_key ?? params.iconKey ?? params.icon),
    subject_kind_policy: optionalString(params.subject_kind_policy ?? params.subjectKindPolicy),
    object_kind_policy: optionalString(params.object_kind_policy ?? params.objectKindPolicy),
    cardinality_policy: optionalString(params.cardinality_policy ?? params.cardinalityPolicy),
    endpoint_policy_shape: optionalString(params.endpoint_policy_shape ?? params.endpointPolicyShape ?? params.shape) as never,
  })));
  registerOperation(registry, 'relationKind.get', ({ params }) => domain.getRelationKind(requireString(params.id ?? params.relationKindId, 'id')));
  registerOperation(registry, 'relationKind.list', ({ params }) => domain.listRelationKinds(requireString(params.model_id ?? params.modelId, 'model_id')));
  registerOperation(registry, 'relationKind.listVisible', ({ params }) => domain.listRelationKinds(requireString(params.model_id ?? params.modelId, 'model_id')));
  registerOperation(registry, 'relationKind.rename', ({ operationId, params }) => changed(operationId, 'relationKind', 'renamed', domain.updateRelationKind(
    requireString(params.id ?? params.relationKindId, 'id'),
    { name: requireString(params.name, 'name') },
  )));
  registerOperation(registry, 'relationKind.updateKey', ({ operationId, params }) => changed(operationId, 'relationKind', 'keyUpdated', domain.updateRelationKind(
    requireString(params.id ?? params.relationKindId, 'id'),
    { key: domain.assertDomainKey(requireString(params.key, 'key'), 'relation kind key') },
  )));
  registerOperation(registry, 'relationKind.updateDescription', ({ operationId, params }) => changed(operationId, 'relationKind', 'descriptionUpdated', domain.updateRelationKind(
    requireString(params.id ?? params.relationKindId, 'id'),
    { description: optionalString(params.description) },
  )));
  registerOperation(registry, 'relationKind.updateDirected', ({ operationId, params }) => changed(operationId, 'relationKind', 'directedUpdated', domain.updateRelationKind(
    requireString(params.id ?? params.relationKindId, 'id'),
    { directed: optionalBooleanNumber(params.directed) },
  )));
  registerOperation(registry, 'relationKind.updateEndpointPolicy', ({ operationId, params }) => changed(operationId, 'relationKind', 'endpointPolicyUpdated', domain.updateRelationKind(
    requireString(params.id ?? params.relationKindId, 'id'),
    {
      subject_kind_policy: optionalString(params.subject_kind_policy ?? params.subjectKindPolicy ?? params.policy),
      object_kind_policy: optionalString(params.object_kind_policy ?? params.objectKindPolicy ?? params.policy),
    },
  )));
  registerOperation(registry, 'relationKind.updateEndpointPolicyShape', ({ operationId, params }) => changed(operationId, 'relationKind', 'endpointPolicyShapeUpdated', domain.updateRelationKind(
    requireString(params.id ?? params.relationKindId, 'id'),
    { endpoint_policy_shape: requireString(params.endpoint_policy_shape ?? params.endpointPolicyShape ?? params.shape, 'endpoint_policy_shape') as never },
  )));
  registerOperation(registry, 'relationKind.listEndpointPairs', ({ params }) => domain.listRelationKindEndpointPairs(
    requireString(params.id ?? params.relationKindId, 'id'),
  ));
  registerOperation(registry, 'relationKind.setEndpointPairs', ({ operationId, params }) => {
    const relationKindId = requireString(params.id ?? params.relationKindId, 'id');
    return changedWithId(
      operationId,
      'relationKindEndpointPair',
      'set',
      relationKindId,
      domain.setRelationKindEndpointPairs(relationKindId, requireEndpointPairs(params.pairs ?? params.endpointPairs)),
    );
  });
  registerOperation(registry, 'relationKind.updateCardinalityPolicy', ({ operationId, params }) => changed(operationId, 'relationKind', 'cardinalityPolicyUpdated', domain.updateRelationKind(
    requireString(params.id ?? params.relationKindId, 'id'),
    { cardinality_policy: optionalString(params.cardinality_policy ?? params.cardinalityPolicy ?? params.policy) },
  )));
  registerOperation(registry, 'relationKind.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'relationKind',
    'archived',
    requireString(params.id ?? params.relationKindId, 'id'),
    Boolean(domain.archiveRelationKind(requireString(params.id ?? params.relationKindId, 'id'))),
  ));
  registerOperation(registry, 'relationKind.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'relationKind',
    'deleted',
    requireString(params.id ?? params.relationKindId, 'id'),
    domain.deleteRelationKind(requireString(params.id ?? params.relationKindId, 'id')),
  ));

}

function requireEndpointPairs(value: unknown): domain.RelationKindEndpointPairInput[] {
  if (!Array.isArray(value)) {
    throw new JsonRpcProtocolError(-32602, 'pairs must be an array');
  }
  return value.map((pair) => {
    if (pair === null || typeof pair !== 'object' || Array.isArray(pair)) {
      throw new JsonRpcProtocolError(-32602, 'pairs must contain objects');
    }
    return pair as domain.RelationKindEndpointPairInput;
  });
}
