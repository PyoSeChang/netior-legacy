import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NETIOR_RPC_METHODS } from '@netior/shared';
import type { World } from '@netior/shared/types';

// Mock window.electron for renderer services
const mockElectron = {
  world: {
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    updateRootDir: vi.fn(),
    delete: vi.fn(),
  },
  domain: {
    rpc: vi.fn(),
  },
  fs: {
    readDir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    openDialog: vi.fn(),
    exists: vi.fn(),
  },
  config: {
    get: vi.fn().mockResolvedValue({ success: true, data: null }),
    set: vi.fn().mockResolvedValue({ success: true, data: true }),
  },
};

Object.defineProperty(globalThis, 'window', {
  value: {
    electron: mockElectron,
    localStorage: {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  },
  writable: true,
});

// Import stores after mock
const { useWorldStore } = await import('../stores/world-store');
const { useInstanceStore } = await import('../stores/instance-store');
const { useUIStore } = await import('../stores/ui-store');

describe('WorldStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectron.fs.exists.mockResolvedValue({ success: true, data: true });
    useWorldStore.setState({ worlds: [], currentWorld: null, loading: false, missingFiles: [], missingPathWorld: null });
  });

  it('should have correct initial state', () => {
    const state = useWorldStore.getState();
    expect(state.worlds).toEqual([]);
    expect(state.currentWorld).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('should load worlds', async () => {
    const mockWorlds = [
      { id: '1', name: 'P1', root_uri: '/a', created_at: '', updated_at: '' },
    ];
    mockElectron.world.list.mockResolvedValue({ success: true, data: mockWorlds });

    await useWorldStore.getState().loadWorlds();
    expect(useWorldStore.getState().worlds).toEqual(mockWorlds);
  });

  it('should create and add world', async () => {
    const newWorld = { id: '2', name: 'New', root_uri: '/b', created_at: '', updated_at: '' };
    mockElectron.world.create.mockResolvedValue({ success: true, data: newWorld });

    const result = await useWorldStore.getState().createWorld('New', '/b');
    expect(result).toEqual(newWorld);
    expect(useWorldStore.getState().worlds).toHaveLength(1);
  });

  it('should open and close world', async () => {
    const world = { id: '1', name: 'P', root_uri: '/x', created_at: '', updated_at: '' } as unknown as World;
    await useWorldStore.getState().openWorld(world);
    expect(useWorldStore.getState().currentWorld).toEqual(world);

    useWorldStore.getState().closeWorld();
    expect(useWorldStore.getState().currentWorld).toBeNull();
  });

  it('should clear missing file state without probing resource ownership', async () => {
    useWorldStore.setState({
      missingFiles: [{
        fileEntity: { id: 'f1', root_id: '1', path: 'docs/readme.md', type: 'file', metadata: null },
      }],
    });
    await useWorldStore.getState().validateFilePaths({
      id: '1',
      name: 'P',
      root_uri: 'C:/world',
      created_at: '',
      updated_at: '',
    } as unknown as World);

    expect(mockElectron.fs.exists).not.toHaveBeenCalledWith('C:/world/docs/readme.md');
    expect(useWorldStore.getState().missingFiles).toEqual([]);
  });
});

describe('InstanceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInstanceStore.setState({ instances: [], loading: false });
  });

  it('should have correct initial state', () => {
    const state = useInstanceStore.getState();
    expect(state.instances).toEqual([]);
  });

  it('should load instances by model', async () => {
    const mockInstances = [
      { id: '1', home_model_id: 'p1', display_name: 'C1', created_at: '', updated_at: '' },
    ];
    mockElectron.domain.rpc.mockResolvedValue({ success: true, data: mockInstances });

    await useInstanceStore.getState().loadByModel('p1');
    expect(mockElectron.domain.rpc).toHaveBeenCalledWith(NETIOR_RPC_METHODS.instanceList, { modelId: 'p1' });
    expect(useInstanceStore.getState().instances).toEqual(mockInstances);
  });
});

describe('UIStore', () => {
  it('should toggle workspace mode', () => {
    useUIStore.getState().setWorkspaceMode('browse');
    expect(useUIStore.getState().workspaceMode).toBe('browse');

    useUIStore.getState().setWorkspaceMode('edit');
    expect(useUIStore.getState().workspaceMode).toBe('edit');
  });

  it('should toggle sidebar', () => {
    const initial = useUIStore.getState().sidebarOpen;
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(!initial);
  });

});
