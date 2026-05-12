import { ipcMain } from 'electron';
import type {
  IpcResult,
  InteractiveViewPreferenceUpsert,
  InteractiveViewSchemaPreferenceUpsert,
  InteractiveViewStateUpsert,
  InteractiveViewTemplateCreate,
  InteractiveViewTemplateListQuery,
  InteractiveViewTemplateUpdate,
} from '@netior/shared/types';
import {
  createRemoteInteractiveViewTemplate,
  deleteRemoteInteractiveViewTemplate,
  getRemoteInteractiveViewPreference,
  getRemoteInteractiveViewSchemaPreference,
  getRemoteInteractiveViewState,
  getRemoteInteractiveViewTemplate,
  listRemoteInteractiveViewTemplates,
  updateRemoteInteractiveViewTemplate,
  upsertRemoteInteractiveViewPreference,
  upsertRemoteInteractiveViewSchemaPreference,
  upsertRemoteInteractiveViewState,
} from '../netior-service/netior-service-client';

export function registerInteractiveViewStateIpc(): void {
  ipcMain.handle(
    'interactiveViewState:get',
    async (_e, instanceId: string, viewTemplateId: string): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await getRemoteInteractiveViewState(instanceId, viewTemplateId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    'interactiveViewState:upsert',
    async (_e, data: InteractiveViewStateUpsert): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await upsertRemoteInteractiveViewState(data) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    'interactiveViewTemplate:list',
    async (_e, query: InteractiveViewTemplateListQuery): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await listRemoteInteractiveViewTemplates(query) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle('interactiveViewTemplate:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteInteractiveViewTemplate(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    'interactiveViewTemplate:create',
    async (_e, data: InteractiveViewTemplateCreate): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await createRemoteInteractiveViewTemplate(data) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    'interactiveViewTemplate:update',
    async (_e, id: string, data: InteractiveViewTemplateUpdate): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await updateRemoteInteractiveViewTemplate(id, data) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle('interactiveViewTemplate:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await deleteRemoteInteractiveViewTemplate(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('interactiveViewPreference:get', async (_e, instanceId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteInteractiveViewPreference(instanceId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    'interactiveViewPreference:upsert',
    async (_e, data: InteractiveViewPreferenceUpsert): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await upsertRemoteInteractiveViewPreference(data) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle('interactiveViewSchemaPreference:get', async (_e, schemaId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteInteractiveViewSchemaPreference(schemaId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    'interactiveViewSchemaPreference:upsert',
    async (_e, data: InteractiveViewSchemaPreferenceUpsert): Promise<IpcResult<unknown>> => {
      try {
        return { success: true, data: await upsertRemoteInteractiveViewSchemaPreference(data) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}
