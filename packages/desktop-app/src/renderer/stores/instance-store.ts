import { create } from 'zustand';
import type { Instance, InstanceCreate, InstanceUpdate } from '@netior/shared/types';
import { instanceService } from '../services/instance-service';

interface InstanceStore {
  instances: Instance[];
  loading: boolean;
  properties: Record<string, unknown[]>;

  loadByModel: (modelId: string) => Promise<void>;
  createInstance: (data: InstanceCreate) => Promise<Instance>;
  updateInstance: (id: string, data: InstanceUpdate) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
  clear: () => void;
}

export const useInstanceStore = create<InstanceStore>((set) => ({
  instances: [],
  loading: false,
  properties: {},

  loadByModel: async (modelId) => {
    set({ loading: true });
    try {
      const instances = await instanceService.getByModel(modelId);
      set({ instances });
    } finally {
      set({ loading: false });
    }
  },

  createInstance: async (data) => {
    const instance = await instanceService.create(data);
    set((state) => ({ instances: [...state.instances, instance] }));
    return instance;
  },

  updateInstance: async (id, data) => {
    const updated = await instanceService.update(id, data);
    set((state) => ({
      instances: state.instances.map((instance) => (instance.id === id ? updated : instance)),
    }));
  },

  deleteInstance: async (id) => {
    await instanceService.delete(id);
    set((state) => ({ instances: state.instances.filter((instance) => instance.id !== id) }));
  },

  clear: () => set({ instances: [], properties: {} }),
}));
