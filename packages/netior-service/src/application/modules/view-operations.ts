import * as domain from '@netior/core';
import { changed, changedBoolean, changedWithId } from '../change-events';
import { optionalJson, optionalString, requireString } from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerViewOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'view.create', ({ operationId, params }) => changed(operationId, 'view', 'created', domain.createView({
    owner_model_id: requireString(params.owner_model_id ?? params.ownerModelId ?? params.model_id ?? params.modelId, 'owner_model_id'),
    type: requireString(params.type, 'type') as never,
    name: requireString(params.name, 'name'),
    description: optionalString(params.description),
    config_json: optionalJson(params.config_json ?? params.config),
    source_kind: optionalString(params.source_kind ?? params.sourceKind) as never,
    source_id: optionalString(params.source_id ?? params.sourceId),
    source_ref: optionalString(params.source_ref ?? params.sourceRef),
    source_version: optionalString(params.source_version ?? params.sourceVersion),
  })));

  registerOperation(registry, 'view.project', ({ params }) => {
    const viewId = requireString(params.view_id ?? params.viewId ?? params.id, 'view_id');
    const view = domain.getView(viewId);
    return {
      view,
      items: view ? domain.listViewItems(view.id) : [],
    };
  });

  registerOperation(registry, 'view.saveLayout', ({ operationId, params }) => {
    const viewId = requireString(params.view_id ?? params.viewId ?? params.id, 'view_id');
    const items = params.items;
    if (!Array.isArray(items)) {
      throw new Error('items must be an array');
    }
    return changedWithId(operationId, 'view', 'layoutSaved', viewId, domain.saveViewLayout(viewId, items as never));
  });

  registerOperation(registry, 'view.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'view',
    'archived',
    requireString(params.id ?? params.viewId, 'id'),
    Boolean(domain.archiveView(requireString(params.id ?? params.viewId, 'id'))),
  ));
  registerOperation(registry, 'view.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'view',
    'deleted',
    requireString(params.id ?? params.viewId, 'id'),
    domain.deleteView(requireString(params.id ?? params.viewId, 'id')),
  ));
}
