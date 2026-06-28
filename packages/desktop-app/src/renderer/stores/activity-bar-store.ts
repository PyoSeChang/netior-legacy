import { create } from 'zustand';
import {
  DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG,
  ACTIVITY_BAR_LAYOUT_CONFIG_KEY,
  moveOrderedItem,
  normalizeActivityBarLayoutConfig,
  type ActivityBarBottomItemKey,
  type ActivityBarLayoutConfig,
  type ActivityBarTopItemKey,
} from '../lib/activity-bar-layout';
import { unwrapIpc } from '../services/ipc';

function parseConfigValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

async function readActivityBarLayoutConfig(): Promise<ActivityBarLayoutConfig> {
  try {
    const value = unwrapIpc(await window.electron.config.get(ACTIVITY_BAR_LAYOUT_CONFIG_KEY));
    return normalizeActivityBarLayoutConfig(parseConfigValue(value));
  } catch {
    return DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG;
  }
}

async function writeActivityBarLayoutConfig(config: ActivityBarLayoutConfig): Promise<void> {
  unwrapIpc(await window.electron.config.set(ACTIVITY_BAR_LAYOUT_CONFIG_KEY, config));
}

let loadPromise: Promise<void> | null = null;

interface ActivityBarStore {
  config: ActivityBarLayoutConfig;
  loaded: boolean;
  loading: boolean;

  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  replaceConfig: (config: ActivityBarLayoutConfig) => Promise<void>;
  setTopItemOrder: (order: ActivityBarTopItemKey[]) => Promise<void>;
  setBottomItemOrder: (order: ActivityBarBottomItemKey[]) => Promise<void>;
  moveTopItem: (index: number, direction: -1 | 1) => Promise<void>;
  moveBottomItem: (index: number, direction: -1 | 1) => Promise<void>;
}

export const useActivityBarStore = create<ActivityBarStore>((set, get) => ({
  config: DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG,
  loaded: false,
  loading: false,

  ensureLoaded: async () => {
    if (get().loaded) {
      return;
    }

    if (loadPromise) {
      return loadPromise;
    }

    set({ loading: true });
    loadPromise = (async () => {
      const config = await readActivityBarLayoutConfig();
      set({
        config,
        loaded: true,
        loading: false,
      });
      loadPromise = null;
    })();

    return loadPromise;
  },

  refresh: async () => {
    set({ loading: true });
    const config = await readActivityBarLayoutConfig();
    set({
      config,
      loaded: true,
      loading: false,
    });
  },

  replaceConfig: async (config) => {
    const nextConfig = normalizeActivityBarLayoutConfig(config);
    set({
      config: nextConfig,
      loaded: true,
    });

    try {
      await writeActivityBarLayoutConfig(nextConfig);
    } catch (error) {
      console.error('[ActivityBarStore] Failed to save activity bar layout', error);
    }
  },

  setTopItemOrder: async (order) => {
    await get().replaceConfig({
      ...get().config,
      topItemOrder: order,
    });
  },

  setBottomItemOrder: async (order) => {
    await get().replaceConfig({
      ...get().config,
      bottomItemOrder: order,
    });
  },

  moveTopItem: async (index, direction) => {
    await get().setTopItemOrder(moveOrderedItem(get().config.topItemOrder, index, direction));
  },

  moveBottomItem: async (index, direction) => {
    await get().setBottomItemOrder(moveOrderedItem(get().config.bottomItemOrder, index, direction));
  },
}));
