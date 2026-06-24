import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window.electron for renderer services
const mockElectron = {
  world: {
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  },
  fileEntity: {
    getByRootNetwork: vi.fn(),
    delete: vi.fn(),
  },
  instance: {
    create: vi.fn(),
    getByRootNetwork: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  network: {
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getFull: vi.fn(),
    getTree: vi.fn(),
    getAncestors: vi.fn(),
  },
  networkNode: {
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  edge: {
    create: vi.fn(),
    delete: vi.fn(),
  },
  layout: {
    getByNetwork: vi.fn(),
    update: vi.fn(),
  },
  layoutNode: {
    setPosition: vi.fn(),
    getPositions: vi.fn(),
    remove: vi.fn(),
  },
  layoutEdge: {
    setVisual: vi.fn(),
    getVisuals: vi.fn(),
    remove: vi.fn(),
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
  value: { electron: mockElectron },
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
    mockElectron.fileEntity.getByRootNetwork.mockResolvedValue({ success: true, data: [] });
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
      { id: '1', name: 'P1', root_dir: '/a', created_at: '', updated_at: '' },
    ];
    mockElectron.world.list.mockResolvedValue({ success: true, data: mockWorlds });

    await useWorldStore.getState().loadWorlds();
    expect(useWorldStore.getState().worlds).toEqual(mockWorlds);
  });

  it('should create and add world', async () => {
    const newWorld = { id: '2', name: 'New', root_dir: '/b', created_at: '', updated_at: '' };
    mockElectron.world.create.mockResolvedValue({ success: true, data: newWorld });

    const result = await useWorldStore.getState().createWorld('New', '/b');
    expect(result).toEqual(newWorld);
    expect(useWorldStore.getState().worlds).toHaveLength(1);
  });

  it('should open and close world', async () => {
    const world = { id: '1', name: 'P', root_dir: '/x', created_at: '', updated_at: '' };
    await useWorldStore.getState().openWorld(world);
    expect(useWorldStore.getState().currentWorld).toEqual(world);

    useWorldStore.getState().closeWorld();
    expect(useWorldStore.getState().currentWorld).toBeNull();
  });

  it('should validate relative file entity paths against the world directory', async () => {
    mockElectron.fileEntity.getByRootNetwork.mockResolvedValue({
      success: true,
      data: [{ id: 'f1', root_network_id: '1', path: 'docs/readme.md', type: 'file', metadata: null, created_at: '', updated_at: '' }],
    });
    mockElectron.fs.exists.mockResolvedValue({ success: true, data: true });

    await useWorldStore.getState().validateFilePaths({
      id: '1',
      name: 'P',
      root_dir: 'C:/world',
      created_at: '',
      updated_at: '',
    });

    expect(mockElectron.fs.exists).toHaveBeenCalledWith('C:/world/docs/readme.md');
    expect(useWorldStore.getState().missingFiles).toEqual([]);
  });

  it('should validate absolute file entity paths without prepending the world directory', async () => {
    mockElectron.fileEntity.getByRootNetwork.mockResolvedValue({
      success: true,
      data: [{ id: 'f1', root_network_id: '1', path: 'C:/world/docs/readme.md', type: 'file', metadata: null, created_at: '', updated_at: '' }],
    });
    mockElectron.fs.exists.mockResolvedValue({ success: true, data: true });

    await useWorldStore.getState().validateFilePaths({
      id: '1',
      name: 'P',
      root_dir: 'C:/world',
      created_at: '',
      updated_at: '',
    });

    expect(mockElectron.fs.exists).toHaveBeenCalledWith('C:/world/docs/readme.md');
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

  it('should load instances by world', async () => {
    const mockInstances = [
      { id: '1', root_network_id: 'p1', title: 'C1', color: null, icon: null, created_at: '', updated_at: '' },
    ];
    mockElectron.instance.getByRootNetwork.mockResolvedValue({ success: true, data: mockInstances });

    await useInstanceStore.getState().loadByWorld('p1');
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
