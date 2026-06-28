import * as domain from '@netior/core';
import { changed, changedBoolean, changedWithId } from '../change-events';
import {
  optionalBooleanNumber,
  optionalString,
  requireString,
} from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerWorldOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'world.create', ({ operationId, params }) => changed(operationId, 'world', 'created', domain.createWorld({
    name: requireString(params.name, 'name'),
    root_uri: requireString(params.root_uri ?? params.rootUri, 'root_uri'),
  })));

  registerOperation(registry, 'world.get', ({ params }) => domain.getWorld(requireString(params.id ?? params.worldId, 'id')));
  registerOperation(registry, 'world.list', () => domain.listWorlds());
  registerOperation(registry, 'world.rename', ({ operationId, params }) => changed(operationId, 'world', 'renamed', domain.updateWorld(
    requireString(params.id ?? params.worldId, 'id'),
    { name: requireString(params.name, 'name') },
  )));
  registerOperation(registry, 'world.updateSettings', ({ operationId, params }) => changed(operationId, 'world', 'settingsUpdated', domain.updateWorld(
    requireString(params.id ?? params.worldId, 'id'),
    {
      name: optionalString(params.name) ?? undefined,
      root_uri: optionalString(params.root_uri ?? params.rootUri) ?? undefined,
    },
  )));
  registerOperation(registry, 'world.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'world',
    'archived',
    requireString(params.id ?? params.worldId, 'id'),
    Boolean(domain.archiveWorld(requireString(params.id ?? params.worldId, 'id'))),
  ));
  registerOperation(registry, 'world.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'world',
    'deleted',
    requireString(params.id ?? params.worldId, 'id'),
    domain.deleteWorld(requireString(params.id ?? params.worldId, 'id')),
  ));

  registerOperation(registry, 'model.create', ({ operationId, params }) => changed(operationId, 'model', 'created', domain.createModel({
    world_id: requireString(params.world_id ?? params.worldId, 'world_id'),
    name: requireString(params.name, 'name'),
    description: optionalString(params.description),
  })));
  registerOperation(registry, 'model.get', ({ params }) => domain.getModel(requireString(params.id ?? params.modelId, 'id')));
  registerOperation(registry, 'model.list', ({ params }) => domain.listModels(requireString(params.world_id ?? params.worldId, 'world_id')));
  registerOperation(registry, 'model.rename', ({ operationId, params }) => changed(operationId, 'model', 'renamed', domain.updateModel(
    requireString(params.id ?? params.modelId, 'id'),
    { name: requireString(params.name, 'name') },
  )));
  registerOperation(registry, 'model.updateDescription', ({ operationId, params }) => changed(operationId, 'model', 'descriptionUpdated', domain.updateModel(
    requireString(params.id ?? params.modelId, 'id'),
    { description: optionalString(params.description) },
  )));
  registerOperation(registry, 'model.move', ({ operationId, params }) => changed(operationId, 'model', 'moved', domain.moveWorldNode(
    requireString(params.id ?? params.modelId, 'id'),
    requireString(params.parent_id ?? params.parentId, 'parent_id'),
  )));
  registerOperation(registry, 'model.archive', ({ operationId, params }) => changedBoolean(
    operationId,
    'model',
    'archived',
    requireString(params.id ?? params.modelId, 'id'),
    Boolean(domain.archiveModel(requireString(params.id ?? params.modelId, 'id'))),
  ));
  registerOperation(registry, 'model.delete', ({ operationId, params }) => changedBoolean(
    operationId,
    'model',
    'deleted',
    requireString(params.id ?? params.modelId, 'id'),
    domain.deleteModel(requireString(params.id ?? params.modelId, 'id')),
  ));

  registerOperation(registry, 'worldNode.getChildren', ({ params }) => {
    const nodeId = requireString(params.id ?? params.nodeId, 'id');
    return domain.listWorldNodeChildren(nodeId);
  });
  registerOperation(registry, 'worldNode.getParent', ({ params }) => domain.getWorldNodeParent(requireString(params.id ?? params.nodeId, 'id')));
  registerOperation(registry, 'worldNode.getAncestors', ({ params }) => domain.getWorldNodeAncestors(requireString(params.id ?? params.nodeId, 'id')));
  registerOperation(registry, 'worldNode.getDescendants', ({ params }) => domain.getWorldNodeDescendants(requireString(params.id ?? params.nodeId, 'id')));
  registerOperation(registry, 'worldNode.getTree', ({ params }) => {
    const worldId = requireString(params.world_id ?? params.worldId ?? params.id, 'world_id');
    return domain.getWorldNodeTree(worldId);
  });
  registerOperation(registry, 'worldNode.move', ({ operationId, params }) => changed(operationId, 'worldNode', 'moved', domain.moveWorldNode(
    requireString(params.id ?? params.nodeId, 'id'),
    requireString(params.parent_id ?? params.parentId, 'parent_id'),
  )));
  registerOperation(registry, 'worldNode.reorderChildren', ({ operationId, params }) => {
    const parentId = requireString(params.parent_id ?? params.parentId, 'parent_id');
    const orderedIds = params.ordered_ids ?? params.orderedIds;
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      throw new Error('ordered_ids must be a string array');
    }
    return changedWithId(operationId, 'worldNode', 'childrenReordered', parentId, domain.reorderWorldNodeChildren(parentId, orderedIds as string[]));
  });
  registerOperation(registry, 'worldNode.getVisibleDefinitions', ({ params }) => {
    const modelId = requireString(params.model_id ?? params.modelId ?? params.id, 'model_id');
    return {
      kinds: domain.listVisibleKinds(modelId),
      relationKinds: domain.listVisibleRelationKinds(modelId),
    };
  });

  registerOperation(registry, 'model.bindDirectory', ({ operationId, params }) => changed(operationId, 'modelDirectoryBinding', 'created', domain.createModelDirectoryBinding({
    model_id: requireString(params.model_id ?? params.modelId, 'model_id'),
    relative_path: requireString(params.relative_path ?? params.relativePath ?? params.path, 'relative_path'),
  })));
  registerOperation(registry, 'model.unbindDirectory', ({ operationId, params }) => changedBoolean(
    operationId,
    'modelDirectoryBinding',
    'deleted',
    requireString(params.id ?? params.bindingId, 'id'),
    domain.deleteModelDirectoryBinding(requireString(params.id ?? params.bindingId, 'id')),
  ));
  registerOperation(registry, 'model.listDirectoryBindings', ({ params }) => domain.listModelDirectoryBindings(requireString(params.model_id ?? params.modelId, 'model_id')));
  registerOperation(registry, 'model.validateDirectoryBindings', () => ({ valid: true, errors: [] }));
}
