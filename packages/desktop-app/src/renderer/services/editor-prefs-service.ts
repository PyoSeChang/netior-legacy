import type { InstanceEditorPrefs, InstanceEditorPrefsUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function getEditorPrefs(instanceId: string): Promise<InstanceEditorPrefs | undefined> {
  return unwrapIpc(await window.electron.editorPrefs.get(instanceId));
}

export async function upsertEditorPrefs(
  instanceId: string,
  data: InstanceEditorPrefsUpdate,
): Promise<InstanceEditorPrefs> {
  return unwrapIpc(await window.electron.editorPrefs.upsert(instanceId, data as Record<string, unknown>));
}

export const editorPrefsService = {
  get: getEditorPrefs,
  upsert: upsertEditorPrefs,
};
