import { NETIOR_RPC_METHODS, type Instance, type InstanceCreate, type InstanceUpdate } from '@netior/shared';
import { domainService } from './domain-service';

export async function createInstance(data: InstanceCreate): Promise<Instance> {
  return domainService.rpc<Instance>(NETIOR_RPC_METHODS.instanceCreate, data);
}

export async function getInstancesByModel(modelId: string): Promise<Instance[]> {
  return domainService.rpc<Instance[]>(NETIOR_RPC_METHODS.instanceList, { modelId });
}

export async function updateInstance(id: string, data: InstanceUpdate): Promise<Instance> {
  let current = await domainService.rpc<Instance>(NETIOR_RPC_METHODS.instanceGet, { id });

  if (data.home_model_id && data.home_model_id !== current.home_model_id) {
    current = await domainService.rpc<Instance>(NETIOR_RPC_METHODS.instanceMoveHomeModel, {
      id,
      homeModelId: data.home_model_id,
    });
  }

  if (data.display_name && data.display_name !== current.display_name) {
    current = await domainService.rpc<Instance>(NETIOR_RPC_METHODS.instanceUpdateDisplayName, {
      id,
      displayName: data.display_name,
    });
  }

  return current;
}

export async function deleteInstance(id: string): Promise<boolean> {
  await domainService.rpc<Instance>(NETIOR_RPC_METHODS.instanceArchive, { id });
  return true;
}

export const instanceService = {
  create: createInstance,
  getByModel: getInstancesByModel,
  update: updateInstance,
  delete: deleteInstance,
};
