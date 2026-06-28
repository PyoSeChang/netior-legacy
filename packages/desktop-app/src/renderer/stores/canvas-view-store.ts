import { create } from 'zustand';

export type CanvasMode = 'browse' | 'edit';

interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasViewStore {
  mode: CanvasMode;
  viewport: CanvasViewport;
  selectedItemIds: string[];
  fitRequestId: number;
  setMode: (mode: CanvasMode) => void;
  setViewport: (viewport: Partial<CanvasViewport>) => void;
  setSelectedItemIds: (itemIds: string[]) => void;
  clearSelection: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
  requestFit: () => void;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.15;

function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export const useCanvasViewStore = create<CanvasViewStore>((set, get) => ({
  mode: 'browse',
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedItemIds: [],
  fitRequestId: 0,

  setMode: (mode) => set({ mode }),
  setViewport: (viewport) => set((state) => ({
    viewport: {
      ...state.viewport,
      ...viewport,
      zoom: viewport.zoom == null ? state.viewport.zoom : clampZoom(viewport.zoom),
    },
  })),
  setSelectedItemIds: (selectedItemIds) => set({ selectedItemIds }),
  clearSelection: () => set({ selectedItemIds: [] }),
  zoomIn: () => {
    const { viewport } = get();
    set({ viewport: { ...viewport, zoom: clampZoom(viewport.zoom * ZOOM_STEP) } });
  },
  zoomOut: () => {
    const { viewport } = get();
    set({ viewport: { ...viewport, zoom: clampZoom(viewport.zoom / ZOOM_STEP) } });
  },
  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),
  requestFit: () => set((state) => ({ fitRequestId: state.fitRequestId + 1 })),
}));

