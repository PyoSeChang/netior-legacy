import * as domain from '@netior/core';
import { requireString } from '../params';
import type { DomainOperationRegistry } from '../types';
import { registerOperation } from '../types';

export function registerQueryOperations(registry: DomainOperationRegistry): void {
  registerOperation(registry, 'domain.snapshot', ({ params }) => domain.getDomainSnapshot({
    rootId: params.root_id as string | undefined ?? params.rootId as string | undefined,
    worldId: params.world_id as string | undefined ?? params.worldId as string | undefined,
    modelId: params.model_id as string | undefined ?? params.modelId as string | undefined,
  }));

  registerOperation(registry, 'model.summary', ({ params }) => {
    const modelId = requireString(params.model_id ?? params.modelId, 'model_id');
    const model = domain.getModel(modelId);
    if (!model) return null;
    return {
      model,
      definitions: {
        kinds: domain.listKinds(modelId),
        relationKinds: domain.listRelationKinds(modelId),
      },
      instances: domain.listInstances(modelId),
      relations: domain.listRelationAssertions(modelId),
    };
  });
  registerOperation(registry, 'model.listDefinitions', ({ params }) => {
    const modelId = requireString(params.model_id ?? params.modelId, 'model_id');
    const kinds = domain.listKinds(modelId);
    return {
      kinds,
      properties: kinds.flatMap((kind) => domain.listProperties(kind.id)),
      relationKinds: domain.listRelationKinds(modelId),
    };
  });
  registerOperation(registry, 'model.listInstances', ({ params }) => domain.listInstances(requireString(params.model_id ?? params.modelId, 'model_id')));
  registerOperation(registry, 'model.listResources', ({ params }) => {
    const model = domain.getModel(requireString(params.model_id ?? params.modelId, 'model_id'));
    return model ? domain.listResources(model.root_id) : [];
  });
  registerOperation(registry, 'model.listRelations', ({ params }) => domain.listRelationAssertions(requireString(params.model_id ?? params.modelId, 'model_id')));
  registerOperation(registry, 'model.listUnassignedResources', ({ params }) => {
    const model = domain.getModel(requireString(params.model_id ?? params.modelId, 'model_id'));
    if (!model) return [];
    const resources = domain.listResources(model.root_id);
    const linkedResourceIds = new Set(
      domain.listInstances(model.id)
        .flatMap((instance) => domain.listInstanceResourceLinks(instance.id))
        .map((link) => link.resource_id),
    );
    return resources.filter((resource) => !linkedResourceIds.has(resource.id));
  });
  registerOperation(registry, 'instance.neighborhood', ({ params }) => {
    const instanceId = requireString(params.instance_id ?? params.instanceId, 'instance_id');
    const instance = domain.getInstance(instanceId);
    if (!instance) return null;
    return {
      instance,
      kindAssignments: domain.listKindAssignments(instance.id),
      propertyValues: domain.listPropertyValues(instance.id),
      resources: domain.listInstanceResourceLinks(instance.id),
      relations: domain.listRelationAssertions(instance.home_model_id),
    };
  });
  registerOperation(registry, 'worldState.getRevision', () => ({ revision: null }));
  registerOperation(registry, 'worldState.listEvents', ({ params }) => domain.listDomainEvents(requireString(params.root_id ?? params.rootId ?? params.world_id ?? params.worldId, 'root_id')));
}
