import * as domain from '@netior/core';
import { changed, changedBoolean } from '../change-events';
import { optionalString, requireString } from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerResourceOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'resource.register', ({ operationId, params }) => changed(operationId, 'resource', 'registered', domain.createResource({
    root_id: requireString(params.root_id ?? params.rootId ?? params.world_id ?? params.worldId, 'root_id'),
    source_kind: requireString(params.source_kind ?? params.sourceKind ?? params.kind, 'source_kind') as never,
    source_uri: optionalString(params.source_uri ?? params.sourceUri ?? params.uri),
    relative_path: optionalString(params.relative_path ?? params.relativePath ?? params.path),
    parent_resource_id: optionalString(params.parent_resource_id ?? params.parentResourceId),
    locator: optionalString(params.locator),
    handler_key: optionalString(params.handler_key ?? params.handlerKey),
    fingerprint: optionalString(params.fingerprint),
    observed_status: optionalString(params.observed_status ?? params.observedStatus) as never,
  })));
  registerOperation(registry, 'resource.get', ({ params }) => domain.getResource(requireString(params.id ?? params.resourceId, 'id')));
  registerOperation(registry, 'resource.list', ({ params }) => domain.listResources(requireString(params.root_id ?? params.rootId ?? params.world_id ?? params.worldId, 'root_id')));
  registerOperation(registry, 'resource.createSubResource', ({ operationId, params }) => changed(operationId, 'resource', 'subResourceCreated', domain.createSubResource({
    parent_resource_id: requireString(params.parent_resource_id ?? params.parentResourceId, 'parent_resource_id'),
    source_kind: requireString(params.source_kind ?? params.sourceKind ?? 'sub-resource', 'source_kind') as never,
    source_uri: optionalString(params.source_uri ?? params.sourceUri ?? params.uri),
    relative_path: optionalString(params.relative_path ?? params.relativePath ?? params.path),
    locator: optionalString(params.locator),
    handler_key: optionalString(params.handler_key ?? params.handlerKey),
    fingerprint: optionalString(params.fingerprint),
    observed_status: optionalString(params.observed_status ?? params.observedStatus) as never,
  })));
  registerOperation(registry, 'resource.updateObservedStatus', ({ operationId, params }) => changed(operationId, 'resource', 'observedStatusUpdated', domain.updateResourceObservedStatus(
    requireString(params.id ?? params.resourceId, 'id'),
    requireString(params.observed_status ?? params.observedStatus, 'observed_status') as never,
  )));
  registerOperation(registry, 'resource.updateFingerprint', ({ operationId, params }) => changed(operationId, 'resource', 'fingerprintUpdated', domain.updateResourceFingerprint(
    requireString(params.id ?? params.resourceId, 'id'),
    optionalString(params.fingerprint) ?? null,
  )));
  registerOperation(registry, 'resource.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'resource',
    'archived',
    requireString(params.id ?? params.resourceId, 'id'),
    Boolean(domain.archiveResource(requireString(params.id ?? params.resourceId, 'id'))),
  ));
  registerOperation(registry, 'resource.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'resource',
    'deleted',
    requireString(params.id ?? params.resourceId, 'id'),
    domain.deleteResource(requireString(params.id ?? params.resourceId, 'id')),
  ));

  registerOperation(registry, 'instance.linkResource', ({ operationId, params }) => changed(operationId, 'instanceResourceLink', 'created', domain.createInstanceResourceLink({
    instance_id: requireString(params.instance_id ?? params.instanceId, 'instance_id'),
    resource_id: requireString(params.resource_id ?? params.resourceId, 'resource_id'),
    is_primary: params.is_primary === true || params.isPrimary === true ? 1 : 0,
  })));
  registerOperation(registry, 'instance.unlinkResource', ({ operationId, params }) => changedBoolean(
    operationId,
    'instanceResourceLink',
    'deleted',
    requireString(params.id ?? params.linkId, 'id'),
    domain.deleteInstanceResourceLink(requireString(params.id ?? params.linkId, 'id')),
  ));
  registerOperation(registry, 'instance.setPrimaryResource', ({ operationId, params }) => changed(operationId, 'instanceResourceLink', 'primarySet', domain.setPrimaryResource(
    requireString(params.instance_id ?? params.instanceId, 'instance_id'),
    requireString(params.resource_id ?? params.resourceId, 'resource_id'),
  )));
  registerOperation(registry, 'instance.listResources', ({ params }) => domain.listInstanceResourceLinks(requireString(params.instance_id ?? params.instanceId, 'instance_id')));
}
