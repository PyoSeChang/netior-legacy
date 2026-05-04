import { create } from 'zustand';
import type { Model, ModelCreate, ModelUpdate } from '@netior/shared/types';
import { modelService } from '../services/model-service';

function normalizeModels(value: unknown): Model[] {
  return Array.isArray(value) ? value.filter((item): item is Model => !!item && typeof item === 'object') : [];
}

interface ModelStore {
  models: Model[];
  loading: boolean;

  loadByProject: (projectId: string) => Promise<void>;
  createModel: (data: ModelCreate) => Promise<Model>;
  updateModel: (id: string, data: ModelUpdate) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  clear: () => void;
}

export const useModelStore = create<ModelStore>((set) => ({
  models: [],
  loading: false,

  loadByProject: async (projectId) => {
    set({ loading: true });
    try {
      const models = normalizeModels(await modelService.list(projectId));
      set({ models, loading: false });
    } catch (error) {
      console.error('[ModelStore] Failed to load models:', error);
      set({ loading: false });
    }
  },

  createModel: async (data) => {
    const created = await modelService.create(data);
    set((s) => ({ models: [...normalizeModels(s.models), created] }));
    return created;
  },

  updateModel: async (id, data) => {
    const updated = await modelService.update(id, data);
    set((s) => ({
      models: normalizeModels(s.models).map((model) => (model.id === id ? updated : model)),
    }));
  },

  deleteModel: async (id) => {
    console.info('[ModelDelete][renderer-store] start', { id });
    const deleted = await modelService.delete(id);
    console.info('[ModelDelete][renderer-store] result', { id, deleted });
    set((s) => ({
      models: normalizeModels(s.models).filter((model) => model.id !== id),
    }));
  },

  clear: () => set({ models: [], loading: false }),
}));
