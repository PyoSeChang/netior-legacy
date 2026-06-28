import { create } from 'zustand';
import type { DomainSnapshot } from '@netior/shared';
import type { World } from '@netior/shared/types';
import { domainService } from '../services/domain-service';

type DomainRecord = Record<string, unknown>;

export interface DomainModelSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface DomainViewSummary {
  id: string;
  modelId: string;
  name: string;
  viewType: 'explorer' | 'canvas';
}

interface DomainStore {
  snapshot: DomainSnapshot | null;
  models: DomainModelSummary[];
  views: DomainViewSummary[];
  activeModelId: string | null;
  activeViewType: 'explorer' | 'canvas';
  loading: boolean;
  error: string | null;
  loadWorldContext: (world: World | null) => Promise<void>;
  setActiveModelId: (modelId: string | null) => void;
  setActiveViewType: (viewType: 'explorer' | 'canvas') => void;
  refreshCurrentWorld: () => Promise<void>;
  clear: () => void;
}

let currentWorldRef: World | null = null;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getWorldRootId(world: World): string {
  return stringValue((world as unknown as DomainRecord).root_id) ?? world.id;
}

function getWorldName(world: World): string {
  return stringValue((world as unknown as DomainRecord).name) ?? 'World';
}

function getFallbackModel(world: World | null): DomainModelSummary[] {
  if (!world) return [];
  return [{
    id: getWorldRootId(world),
    name: getWorldName(world),
    description: stringValue((world as unknown as DomainRecord).description),
  }];
}

function readArray(snapshot: DomainSnapshot | null, key: string): DomainRecord[] {
  if (!snapshot) return [];
  const value = (snapshot as unknown as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.filter((item): item is DomainRecord => Boolean(item) && typeof item === 'object') : [];
}

function normalizeViewType(value: unknown): 'explorer' | 'canvas' {
  return value === 'canvas' ? 'canvas' : 'explorer';
}

function selectModels(snapshot: DomainSnapshot | null, world: World | null): DomainModelSummary[] {
  if (!world) return [];
  const rootId = getWorldRootId(world);

  const worldNodes = readArray(snapshot, 'worldNodes');
  if (worldNodes.length > 0) {
    const models = worldNodes
      .filter((node) => node.node_type === 'model' && (node.root_id === rootId || node.parent_id === rootId))
      .map((node) => ({
        id: String(node.id),
        name: stringValue(node.name) ?? stringValue(node.key) ?? 'Model',
        description: stringValue(node.description),
      }));
    return models.length > 0 ? models : getFallbackModel(world);
  }

  const models = readArray(snapshot, 'models')
    .filter((model) => model.world_id === rootId || model.root_id === rootId || model.parent_id === rootId)
    .map((model) => ({
      id: String(model.id),
      name: stringValue(model.name) ?? 'Model',
      description: stringValue(model.description),
    }));

  return models.length > 0 ? models : getFallbackModel(world);
}

function selectViews(snapshot: DomainSnapshot | null, models: DomainModelSummary[]): DomainViewSummary[] {
  const modelIds = new Set(models.map((model) => model.id));
  return readArray(snapshot, 'views')
    .filter((view) => {
      const modelId = stringValue(view.owner_model_id) ?? stringValue(view.model_id);
      return modelId ? modelIds.has(modelId) : false;
    })
    .map((view) => ({
      id: String(view.id),
      modelId: stringValue(view.owner_model_id) ?? stringValue(view.model_id) ?? '',
      name: stringValue(view.name) ?? 'View',
      viewType: normalizeViewType(view.type ?? view.view_type),
    }));
}

function deriveState(snapshot: DomainSnapshot | null, world: World | null): Pick<DomainStore, 'models' | 'views' | 'activeModelId'> {
  const models = selectModels(snapshot, world);
  const views = selectViews(snapshot, models);
  return {
    models,
    views,
    activeModelId: models[0]?.id ?? null,
  };
}

export const useDomainStore = create<DomainStore>((set, get) => ({
  snapshot: null,
  models: [],
  views: [],
  activeModelId: null,
  activeViewType: 'explorer',
  loading: false,
  error: null,

  loadWorldContext: async (world) => {
    currentWorldRef = world;
    if (!world) {
      set({ snapshot: null, models: [], views: [], activeModelId: null, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const snapshot = await domainService.getSnapshot(getWorldRootId(world));
      const derived = deriveState(snapshot, world);
      set({
        snapshot,
        ...derived,
        activeModelId: get().activeModelId && derived.models.some((model) => model.id === get().activeModelId)
          ? get().activeModelId
          : derived.activeModelId,
        loading: false,
        error: null,
      });
    } catch (error) {
      const derived = deriveState(null, world);
      set({
        snapshot: null,
        ...derived,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  setActiveModelId: (activeModelId) => set({ activeModelId }),
  setActiveViewType: (activeViewType) => set({ activeViewType }),
  refreshCurrentWorld: async () => get().loadWorldContext(currentWorldRef),
  clear: () => {
    currentWorldRef = null;
    set({ snapshot: null, models: [], views: [], activeModelId: null, loading: false, error: null });
  },
}));

