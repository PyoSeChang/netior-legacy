import { create } from 'zustand';
import type {
  Schema, SchemaCreate, SchemaUpdate,
  SchemaField, SchemaFieldCreate, SchemaFieldUpdate,
  SchemaMeaning, SchemaMeaningCreate, SchemaMeaningSlotBinding,
  SchemaMeaningSlotBindingUpdate, SchemaMeaningUpdate,
} from '@netior/shared/types';
import { schemaService } from '../services';

function normalizeSchemas(value: unknown): Schema[] {
  return Array.isArray(value) ? value.filter((item): item is Schema => !!item && typeof item === 'object') : [];
}

function normalizeFields(value: unknown): SchemaField[] {
  return Array.isArray(value) ? value.filter((item): item is SchemaField => !!item && typeof item === 'object') : [];
}

function normalizeMeanings(value: unknown): SchemaMeaning[] {
  return Array.isArray(value) ? value.filter((item): item is SchemaMeaning => !!item && typeof item === 'object') : [];
}

interface SchemaStore {
  schemas: Schema[];
  fields: Record<string, SchemaField[]>;
  meanings: Record<string, SchemaMeaning[]>;
  loading: boolean;

  loadByWorld: (rootNetworkId: string) => Promise<void>;
  createSchema: (data: SchemaCreate) => Promise<Schema>;
  updateSchema: (id: string, data: SchemaUpdate) => Promise<void>;
  deleteSchema: (id: string) => Promise<void>;

  loadFields: (schemaId: string) => Promise<void>;
  createField: (data: SchemaFieldCreate) => Promise<SchemaField>;
  updateField: (id: string, schemaId: string, data: SchemaFieldUpdate) => Promise<void>;
  deleteField: (id: string, schemaId: string) => Promise<void>;
  reorderFields: (schemaId: string, orderedIds: string[]) => Promise<void>;

  loadMeanings: (schemaId: string) => Promise<void>;
  ensureMeaning: (data: SchemaMeaningCreate) => Promise<SchemaMeaning>;
  updateMeaning: (id: string, schemaId: string, data: SchemaMeaningUpdate) => Promise<void>;
  deleteMeaning: (id: string, schemaId: string) => Promise<void>;
  updateMeaningSlot: (
    id: string,
    schemaId: string,
    data: SchemaMeaningSlotBindingUpdate,
  ) => Promise<SchemaMeaningSlotBinding>;

  clear: () => void;
}

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  schemas: [],
  fields: {},
  meanings: {},
  loading: false,

  loadByWorld: async (rootNetworkId) => {
    set({ loading: true });
    try {
      const schemas = normalizeSchemas(await schemaService.list(rootNetworkId));
      set({ schemas });
    } finally {
      set({ loading: false });
    }
  },

  createSchema: async (data) => {
    const schema = await schemaService.create(data);
    set((s) => ({ schemas: [...normalizeSchemas(s.schemas), schema] }));
    return schema;
  },

  updateSchema: async (id, data) => {
    const updated = await schemaService.update(id, data);
    set((s) => ({
      schemas: normalizeSchemas(s.schemas).map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteSchema: async (id) => {
    await schemaService.delete(id);
    set((s) => ({
      schemas: normalizeSchemas(s.schemas).filter((a) => a.id !== id),
      fields: Object.fromEntries(Object.entries(s.fields).filter(([k]) => k !== id)),
      meanings: Object.fromEntries(Object.entries(s.meanings).filter(([k]) => k !== id)),
    }));
  },

  loadFields: async (schemaId) => {
    const fields = normalizeFields(await schemaService.field.list(schemaId));
    set((s) => ({ fields: { ...s.fields, [schemaId]: fields } }));
  },

  createField: async (data) => {
    const field = await schemaService.field.create(data);
    const meanings = normalizeMeanings(await schemaService.meaning.list(data.schema_id));
    set((s) => ({
      fields: {
        ...s.fields,
        [data.schema_id]: [...normalizeFields(s.fields[data.schema_id]), field],
      },
      meanings: { ...s.meanings, [data.schema_id]: meanings },
    }));
    return field;
  },

  updateField: async (id, schemaId, data) => {
    const updated = await schemaService.field.update(id, data);
    const meanings = normalizeMeanings(await schemaService.meaning.list(schemaId));
    set((s) => ({
      fields: {
        ...s.fields,
        [schemaId]: normalizeFields(s.fields[schemaId]).map((f) => (f.id === id ? updated : f)),
      },
      meanings: { ...s.meanings, [schemaId]: meanings },
    }));
  },

  deleteField: async (id, schemaId) => {
    await schemaService.field.delete(id);
    const meanings = normalizeMeanings(await schemaService.meaning.list(schemaId));
    set((s) => ({
      fields: {
        ...s.fields,
        [schemaId]: normalizeFields(s.fields[schemaId]).filter((f) => f.id !== id),
      },
      meanings: { ...s.meanings, [schemaId]: meanings },
    }));
  },

  reorderFields: async (schemaId, orderedIds) => {
    await schemaService.field.reorder(schemaId, orderedIds);
    set((s) => {
      const current = normalizeFields(s.fields[schemaId]);
      const reordered = orderedIds
        .map((id, i) => {
          const field = current.find((f) => f.id === id);
          return field ? { ...field, sort_order: i } : null;
        })
        .filter(Boolean) as SchemaField[];
      return { fields: { ...s.fields, [schemaId]: reordered } };
    });
  },

  loadMeanings: async (schemaId) => {
    const meanings = normalizeMeanings(await schemaService.meaning.list(schemaId));
    set((s) => ({ meanings: { ...s.meanings, [schemaId]: meanings } }));
  },

  ensureMeaning: async (data) => {
    const meaning = await schemaService.meaning.ensure(data);
    const meanings = normalizeMeanings(await schemaService.meaning.list(data.schema_id));
    set((s) => ({ meanings: { ...s.meanings, [data.schema_id]: meanings } }));
    return meaning;
  },

  updateMeaning: async (id, schemaId, data) => {
    const updated = await schemaService.meaning.update(id, data);
    set((s) => ({
      meanings: {
        ...s.meanings,
        [schemaId]: normalizeMeanings(s.meanings[schemaId]).map((meaning) => (
          meaning.id === id ? updated : meaning
        )),
      },
    }));
  },

  deleteMeaning: async (id, schemaId) => {
    await schemaService.meaning.delete(id);
    set((s) => ({
      meanings: {
        ...s.meanings,
        [schemaId]: normalizeMeanings(s.meanings[schemaId]).filter((meaning) => meaning.id !== id),
      },
    }));
  },

  updateMeaningSlot: async (id, schemaId, data) => {
    const binding = await schemaService.meaning.updateSlot(id, data);
    await get().loadMeanings(schemaId);
    return binding;
  },

  clear: () => set({ schemas: [], fields: {}, meanings: {} }),
}));
