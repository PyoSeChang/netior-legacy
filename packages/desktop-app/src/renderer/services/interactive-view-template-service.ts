import type {
  InteractiveViewPreference,
  InteractiveViewPreferenceUpsert,
  InteractiveViewSchemaPreference,
  InteractiveViewSchemaPreferenceUpsert,
  InteractiveViewTemplate,
  InteractiveViewTemplateCreate,
  InteractiveViewTemplateListQuery,
  InteractiveViewTemplateUpdate,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function listInteractiveViewTemplates(
  query: InteractiveViewTemplateListQuery,
): Promise<InteractiveViewTemplate[]> {
  return unwrapIpc(await window.electron.interactiveViewTemplate.list(query as unknown as Record<string, unknown>));
}

export async function getInteractiveViewTemplate(id: string): Promise<InteractiveViewTemplate | null> {
  return unwrapIpc(await window.electron.interactiveViewTemplate.get(id));
}

export async function createInteractiveViewTemplate(
  data: InteractiveViewTemplateCreate,
): Promise<InteractiveViewTemplate> {
  return unwrapIpc(await window.electron.interactiveViewTemplate.create(data as unknown as Record<string, unknown>));
}

export async function updateInteractiveViewTemplate(
  id: string,
  data: InteractiveViewTemplateUpdate,
): Promise<InteractiveViewTemplate | null> {
  return unwrapIpc(await window.electron.interactiveViewTemplate.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteInteractiveViewTemplate(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.interactiveViewTemplate.delete(id));
}

export async function getInteractiveViewPreference(instanceId: string): Promise<InteractiveViewPreference | null> {
  return unwrapIpc(await window.electron.interactiveViewPreference.get(instanceId));
}

export async function upsertInteractiveViewPreference(
  data: InteractiveViewPreferenceUpsert,
): Promise<InteractiveViewPreference> {
  return unwrapIpc(await window.electron.interactiveViewPreference.upsert(data as unknown as Record<string, unknown>));
}

export async function getInteractiveViewSchemaPreference(
  schemaId: string,
): Promise<InteractiveViewSchemaPreference | null> {
  return unwrapIpc(await window.electron.interactiveViewSchemaPreference.get(schemaId));
}

export async function upsertInteractiveViewSchemaPreference(
  data: InteractiveViewSchemaPreferenceUpsert,
): Promise<InteractiveViewSchemaPreference> {
  return unwrapIpc(await window.electron.interactiveViewSchemaPreference.upsert(data as unknown as Record<string, unknown>));
}

export const interactiveViewTemplateService = {
  list: listInteractiveViewTemplates,
  get: getInteractiveViewTemplate,
  create: createInteractiveViewTemplate,
  update: updateInteractiveViewTemplate,
  delete: deleteInteractiveViewTemplate,
  getPreference: getInteractiveViewPreference,
  upsertPreference: upsertInteractiveViewPreference,
  getSchemaPreference: getInteractiveViewSchemaPreference,
  upsertSchemaPreference: upsertInteractiveViewSchemaPreference,
};
