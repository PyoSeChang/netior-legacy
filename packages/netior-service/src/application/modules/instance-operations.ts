import * as domain from '@netior/core';
import { changed, changedBoolean } from '../change-events';
import {
  optionalJson,
  optionalString,
  optionalStringOrUndefined,
  requireString,
} from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerInstanceOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'instance.create', ({ operationId, params }) => changed(operationId, 'instance', 'created', domain.createInstance({
    home_model_id: requireString(params.home_model_id ?? params.homeModelId ?? params.model_id ?? params.modelId, 'home_model_id'),
    display_name: requireString(params.display_name ?? params.displayName ?? params.title, 'display_name'),
    icon_type: optionalString(params.icon_type ?? params.iconType) as never,
    icon_key: optionalString(params.icon_key ?? params.iconKey ?? params.icon),
  })));
  registerOperation(registry, 'instance.get', ({ params }) => domain.getInstance(requireString(params.id ?? params.instanceId, 'id')));
  registerOperation(registry, 'instance.list', ({ params }) => domain.listInstances(requireString(params.model_id ?? params.modelId, 'model_id')));
  registerOperation(registry, 'instance.rename', ({ operationId, params }) => changed(operationId, 'instance', 'renamed', domain.updateInstance(
    requireString(params.id ?? params.instanceId, 'id'),
    { display_name: requireString(params.display_name ?? params.displayName ?? params.title, 'display_name') },
  )));
  registerOperation(registry, 'instance.updateDisplayName', ({ operationId, params }) => changed(operationId, 'instance', 'displayNameUpdated', domain.updateInstance(
    requireString(params.id ?? params.instanceId, 'id'),
    { display_name: requireString(params.display_name ?? params.displayName ?? params.title, 'display_name') },
  )));
  registerOperation(registry, 'instance.moveHomeModel', ({ operationId, params }) => changed(operationId, 'instance', 'homeModelMoved', domain.updateInstance(
    requireString(params.id ?? params.instanceId, 'id'),
    { home_model_id: requireString(params.home_model_id ?? params.homeModelId ?? params.model_id ?? params.modelId, 'home_model_id') },
  )));
  registerOperation(registry, 'instance.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'instance',
    'archived',
    requireString(params.id ?? params.instanceId, 'id'),
    Boolean(domain.archiveInstance(requireString(params.id ?? params.instanceId, 'id'))),
  ));
  registerOperation(registry, 'instance.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'instance',
    'deleted',
    requireString(params.id ?? params.instanceId, 'id'),
    domain.deleteInstance(requireString(params.id ?? params.instanceId, 'id')),
  ));
  registerOperation(registry, 'instance.restore', ({ operationId, params }) => changed(operationId, 'instance', 'restored', domain.restoreInstance(
    requireString(params.id ?? params.instanceId, 'id'),
  )));
  registerOperation(registry, 'instance.search', ({ params }) => domain.searchInstances(
    requireString(params.model_id ?? params.modelId, 'model_id'),
    requireString(params.query, 'query'),
  ));

  registerOperation(registry, 'instance.assignKind', ({ operationId, params }) => changed(operationId, 'kindAssignment', 'created', domain.createKindAssignment({
    instance_id: requireString(params.instance_id ?? params.instanceId, 'instance_id'),
    kind_id: requireString(params.kind_id ?? params.kindId, 'kind_id'),
    status: optionalString(params.status) as never,
    created_by: optionalString(params.created_by ?? params.createdBy),
  })));
  registerOperation(registry, 'instance.unassignKind', ({ operationId, params }) => changedBoolean(
    operationId,
    'kindAssignment',
    'deleted',
    requireString(params.id ?? params.assignmentId, 'id'),
    domain.deleteKindAssignment(requireString(params.id ?? params.assignmentId, 'id')),
  ));
  registerOperation(registry, 'instance.listKindAssignments', ({ params }) => domain.listKindAssignments(requireString(params.instance_id ?? params.instanceId, 'instance_id')));
  registerOperation(registry, 'kindAssignment.accept', ({ operationId, params }) => changed(operationId, 'kindAssignment', 'accepted', domain.acceptKindAssignment(requireString(params.id ?? params.assignmentId, 'id'))));
  registerOperation(registry, 'kindAssignment.reject', ({ operationId, params }) => changed(operationId, 'kindAssignment', 'rejected', domain.rejectKindAssignment(requireString(params.id ?? params.assignmentId, 'id'))));
  registerOperation(registry, 'kindAssignment.supersede', ({ operationId, params }) => changed(operationId, 'kindAssignment', 'superseded', domain.supersedeKindAssignment(requireString(params.id ?? params.assignmentId, 'id'))));

  registerOperation(registry, 'propertyValue.create', ({ operationId, params }) => changed(operationId, 'propertyValue', 'created', domain.setPropertyValue({
    id: optionalStringOrUndefined(params.id),
    instance_id: requireString(params.instance_id ?? params.instanceId, 'instance_id'),
    property_id: requireString(params.property_id ?? params.propertyId, 'property_id'),
    value_json: optionalJson(params.value_json ?? params.value),
    status: optionalString(params.status) as never,
    created_by: optionalString(params.created_by ?? params.createdBy),
  })));
  registerOperation(registry, 'propertyValue.get', ({ params }) => domain.getPropertyValue(requireString(params.id ?? params.propertyValueId, 'id')));
  registerOperation(registry, 'propertyValue.list', ({ params }) => domain.listPropertyValues(requireString(params.instance_id ?? params.instanceId, 'instance_id')));
  registerOperation(registry, 'propertyValue.update', ({ operationId, params }) => changed(operationId, 'propertyValue', 'updated', domain.updatePropertyValue(
    requireString(params.id ?? params.propertyValueId, 'id'),
    {
    value_json: optionalJson(params.value_json ?? params.value),
    status: optionalString(params.status) as never,
    created_by: optionalString(params.created_by ?? params.createdBy),
    },
  )));
  registerOperation(registry, 'propertyValue.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'propertyValue',
    'archived',
    requireString(params.id ?? params.propertyValueId, 'id'),
    Boolean(domain.archivePropertyValue(requireString(params.id ?? params.propertyValueId, 'id'))),
  ));
  registerOperation(registry, 'propertyValue.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'propertyValue',
    'deleted',
    requireString(params.id ?? params.propertyValueId, 'id'),
    domain.deletePropertyValue(requireString(params.id ?? params.propertyValueId, 'id')),
  ));
  registerOperation(registry, 'propertyValue.accept', ({ operationId, params }) => changed(operationId, 'propertyValue', 'accepted', domain.acceptPropertyValue(requireString(params.id ?? params.propertyValueId, 'id'))));
  registerOperation(registry, 'propertyValue.reject', ({ operationId, params }) => changed(operationId, 'propertyValue', 'rejected', domain.rejectPropertyValue(requireString(params.id ?? params.propertyValueId, 'id'))));
  registerOperation(registry, 'propertyValue.supersede', ({ operationId, params }) => changed(operationId, 'propertyValue', 'superseded', domain.supersedePropertyValue(requireString(params.id ?? params.propertyValueId, 'id'))));
}
