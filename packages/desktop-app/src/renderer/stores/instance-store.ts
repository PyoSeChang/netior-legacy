import { create } from 'zustand';
import type { Instance, InstanceCreate, InstanceUpdate, InstanceProperty, InstancePropertyUpsert } from '@netior/shared/types';
import { instanceService, instancePropertyService, instanceContentService } from '../services';

let syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncedSyncToAgent(instanceId: string) {
  if (syncTimers[instanceId]) clearTimeout(syncTimers[instanceId]);
  syncTimers[instanceId] = setTimeout(async () => {
    try {
      const updated = await instanceContentService.syncToAgent(instanceId);
      useInstanceStore.setState((s) => ({
        instances: s.instances.map((c) => (c.id === instanceId ? updated : c)),
      }));
    } catch (err) {
      console.error('[InstanceContent] Failed to sync to agent:', err);
    }
    delete syncTimers[instanceId];
  }, 300);
}

interface InstanceStore {
  instances: Instance[];
  loading: boolean;
  properties: Record<string, InstanceProperty[]>;

  loadByProject: (projectId: string) => Promise<void>;
  createInstance: (data: InstanceCreate) => Promise<Instance>;
  updateInstance: (id: string, data: InstanceUpdate) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;

  updateContent: (id: string, content: string | null) => Promise<void>;
  updateAgentContent: (id: string, agentContent: string) => Promise<void>;

  loadProperties: (instanceId: string) => Promise<void>;
  upsertProperty: (data: InstancePropertyUpsert) => Promise<void>;
  deleteProperty: (id: string, instanceId: string) => Promise<void>;

  clear: () => void;
}

export const useInstanceStore = create<InstanceStore>((set) => ({
  instances: [],
  loading: false,
  properties: {},

  loadByProject: async (projectId) => {
    set({ loading: true });
    try {
      const instances = await instanceService.getByProject(projectId);
      set({ instances });
    } finally {
      set({ loading: false });
    }
  },

  createInstance: async (data) => {
    const instance = await instanceService.create(data);
    set((s) => ({ instances: [...s.instances, instance] }));
    return instance;
  },

  updateInstance: async (id, data) => {
    const updated = await instanceService.update(id, data);
    set((s) => ({
      instances: s.instances.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteInstance: async (id) => {
    await instanceService.delete(id);
    set((s) => ({ instances: s.instances.filter((c) => c.id !== id) }));
  },

  updateContent: async (id, content) => {
    const updated = await instanceService.update(id, { content });
    set((s) => ({
      instances: s.instances.map((c) => (c.id === id ? updated : c)),
    }));
    debouncedSyncToAgent(id);
  },

  updateAgentContent: async (id, agentContent) => {
    try {
      const updated = await instanceContentService.syncFromAgent(id, agentContent);
      set((s) => ({
        instances: s.instances.map((c) => (c.id === id ? updated : c)),
      }));
    } catch (err) {
      console.error('[InstanceContent] Failed to sync from agent:', err);
    }
  },

  loadProperties: async (instanceId) => {
    const props = await instancePropertyService.getByInstance(instanceId);
    set((s) => ({ properties: { ...s.properties, [instanceId]: props } }));
  },

  upsertProperty: async (data) => {
    const prop = await instancePropertyService.upsert(data);
    set((s) => {
      const existing = s.properties[data.instance_id] ?? [];
      const updated = existing.some((p) => p.field_id === data.field_id)
        ? existing.map((p) => (p.field_id === data.field_id ? prop : p))
        : [...existing, prop];
      return { properties: { ...s.properties, [data.instance_id]: updated } };
    });
    debouncedSyncToAgent(data.instance_id);
  },

  deleteProperty: async (id, instanceId) => {
    await instancePropertyService.delete(id);
    set((s) => ({
      properties: {
        ...s.properties,
        [instanceId]: (s.properties[instanceId] ?? []).filter((p) => p.id !== id),
      },
    }));
  },

  clear: () => {
    Object.values(syncTimers).forEach(clearTimeout);
    syncTimers = {};
    set({ instances: [], properties: {} });
  },
}));
