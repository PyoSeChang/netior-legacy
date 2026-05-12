import type { InteractiveViewState, InteractiveViewStateUpsert } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function getInteractiveViewState(
  instanceId: string,
  viewTemplateId: string,
): Promise<InteractiveViewState | null> {
  return unwrapIpc(await window.electron.interactiveViewState.get(instanceId, viewTemplateId));
}

export async function upsertInteractiveViewState(
  data: InteractiveViewStateUpsert,
): Promise<InteractiveViewState> {
  return unwrapIpc(await window.electron.interactiveViewState.upsert(data as unknown as Record<string, unknown>));
}

export const interactiveViewStateService = {
  get: getInteractiveViewState,
  upsert: upsertInteractiveViewState,
};
