import { create } from 'zustand';
import type { Meaning, MeaningCreate, MeaningUpdate } from '@netior/shared/types';
import { meaningService } from '../services/meaning-service';

function normalizeModels(value: unknown): Meaning[] {
  return Array.isArray(value) ? value.filter((item): item is Meaning => !!item && typeof item === 'object') : [];
}

interface ModelStore {
  meanings: Meaning[];
  loading: boolean;

  loadByProject: (projectId: string) => Promise<void>;
  createMeaning: (data: MeaningCreate) => Promise<Meaning>;
  updateMeaning: (id: string, data: MeaningUpdate) => Promise<void>;
  deleteMeaning: (id: string) => Promise<void>;
  clear: () => void;
}

export const useMeaningStore = create<ModelStore>((set) => ({
  meanings: [],
  loading: false,

  loadByProject: async (projectId) => {
    set({ loading: true });
    try {
      const meanings = normalizeModels(await meaningService.list(projectId));
      set({ meanings, loading: false });
    } catch (error) {
      console.error('[ModelStore] Failed to load meanings:', error);
      set({ loading: false });
    }
  },

  createMeaning: async (data) => {
    const created = await meaningService.create(data);
    set((s) => ({ meanings: [...normalizeModels(s.meanings), created] }));
    return created;
  },

  updateMeaning: async (id, data) => {
    const updated = await meaningService.update(id, data);
    set((s) => ({
      meanings: normalizeModels(s.meanings).map((meaning) => (meaning.id === id ? updated : meaning)),
    }));
  },

  deleteMeaning: async (id) => {
    console.info('[ModelDelete][renderer-store] start', { id });
    const deleted = await meaningService.delete(id);
    console.info('[ModelDelete][renderer-store] result', { id, deleted });
    set((s) => ({
      meanings: normalizeModels(s.meanings).filter((meaning) => meaning.id !== id),
    }));
  },

  clear: () => set({ meanings: [], loading: false }),
}));
