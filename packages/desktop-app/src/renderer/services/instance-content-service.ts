import type { Instance } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function syncToAgent(instanceId: string): Promise<Instance> {
  return unwrapIpc(await window.electron.instanceContent.syncToAgent(instanceId));
}

export async function syncFromAgent(instanceId: string, agentContent: string): Promise<Instance> {
  return unwrapIpc(await window.electron.instanceContent.syncFromAgent(instanceId, agentContent));
}

export const instanceContentService = { syncToAgent, syncFromAgent };
