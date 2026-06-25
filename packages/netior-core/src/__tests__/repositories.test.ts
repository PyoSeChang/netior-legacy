import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb } from './test-db';

// Mock getDatabase to use test db, but keep real hasColumn/tableExists for migrations
vi.mock('../connection', async (importOriginal) => {
  const original = await importOriginal<typeof import('../connection')>();
  return {
    ...original,
    getDatabase: () => getTestDb(),
  };
});

// Import after mock
import { createWorld, listWorlds, deleteWorld } from '../repositories/world';
import { createInstance, getInstancesByWorld, updateInstance, deleteInstance, searchInstances } from '../repositories/instance';
import {
  createNetwork, listNetworks, updateNetwork, deleteNetwork, getNetworkFull,
  getNetworkAncestors, getNetworkTree, addNetworkNode, updateNetworkNode, removeNetworkNode,
  createEdge, getEdge, updateEdge, deleteEdge,
  ensureUniverseNetwork, getRootNetwork, getUniverseNetwork,
} from '../repositories/network';
import {
  createLayout, getLayoutByNetwork, updateLayout, deleteLayout,
  setNodePosition, getNodePositions, removeNodePosition,
  setEdgeVisual, getEdgeVisuals, removeEdgeVisual,
} from '../repositories/layout';
import { createFileEntity, getFileEntity, getFileEntityByPath, getFileEntitiesByWorld, updateFileEntity, deleteFileEntity } from '../repositories/file';
import {
  addModuleDirectory,
  createModule,
  deleteModule,
  listModuleDirectories,
  listModules,
  updateModule,
} from '../repositories/module';
import { getEditorPrefs, upsertEditorPrefs } from '../repositories/editor-prefs';
import { createMeaning, deleteMeaning, getMeaning, listMeanings, updateMeaning } from '../repositories/meaning';
import { listMeaningCategoriesForWorldDb } from '../repositories/meaning-category';
import { migrate062 } from '../migrations/062-repair-root-network-owners';
import { createObject, getObject, getObjectByRef, deleteObject, deleteObjectByRef } from '../repositories/objects';
import { createContext, listContexts, getContext, updateContext, deleteContext, addContextMember, removeContextMember, getContextMembers } from '../repositories/context';
import {
  createSchema,
  deleteSchema,
  createField,
  getSchema,
  ensureSchemaMeaning,
  listFields,
  listSchemaMeanings,
  updateField,
  updateSchemaMeaningSlotBinding,
} from '../repositories/schema';

describe('Repositories', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  // --- World ---

  describe('World', () => {
    it('should create and list worlds', () => {
      const p = createWorld({ name: 'Test', root_dir: '/tmp/test' });
      expect(p.id).toBeDefined();
      expect(p.name).toBe('Test');
      expect(p.root_dir).toBe('/tmp/test');

      const list = listWorlds();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(p.id);
    });

    it('should auto-create universe and root networks when creating world', () => {
      const world = createWorld({ name: 'Rooted', root_dir: '/tmp/rooted' });
      const universe = getUniverseNetwork();
      const rootNetwork = getRootNetwork(world.id);
      const universeFull = getNetworkFull(universe!.id);
      const worldPortalNode = universeFull?.nodes.find(
        (node) => node.object?.object_type === 'network' && node.object.ref_id === world.id,
      );
      const worldPortalPosition = universeFull?.nodePositions.find((position) => position.nodeId === worldPortalNode?.id);

      expect(universe).toBeDefined();
      expect(universe!.kind).toBe('universe');
      expect(rootNetwork).toBeDefined();
      expect(rootNetwork!.kind).toBe('root');
      expect(rootNetwork!.id).toBe(world.id);
      expect(rootNetwork!.root_network_id).toBe(world.id);
      expect(rootNetwork!.parent_network_id).toBeNull();
      expect(rootNetwork!.name).toBe('Rooted');
      expect(worldPortalNode).toBeDefined();
      expect(worldPortalNode!.node_type).toBe('portal');
      expect(worldPortalPosition).toBeDefined();
      expect(JSON.parse(worldPortalPosition!.positionJson)).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    });

    it('should delete world', () => {
      const p = createWorld({ name: 'Del', root_dir: '/tmp/del' });
      expect(deleteWorld(p.id)).toBe(true);
      expect(listWorlds()).toHaveLength(0);
    });

    it('should reject duplicate root_dir', () => {
      createWorld({ name: 'A', root_dir: '/tmp/dup' });
      expect(() => createWorld({ name: 'B', root_dir: '/tmp/dup' })).toThrow();
    });

    it('should create object record when creating world', () => {
      const p = createWorld({ name: 'P', root_dir: '/tmp/obj-test' });
      const obj = getObjectByRef('network', p.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('network');
      expect(obj!.scope).toBe('world');
      expect(obj!.root_network_id).toBe(p.id);
    });

    it('should delete object record when deleting world', () => {
      const p = createWorld({ name: 'P', root_dir: '/tmp/obj-del' });
      deleteWorld(p.id);
      expect(getObjectByRef('network', p.id)).toBeUndefined();
    });
  });

  // --- Instance ---

  describe('Instance', () => {
    let rootNetworkId: string;

    beforeEach(() => {
      rootNetworkId = createWorld({ name: 'P', root_dir: '/tmp/p' }).id;
    });

    it('should create and query by world', () => {
      const c = createInstance({ root_network_id: rootNetworkId, title: 'Hello' });
      expect(c.title).toBe('Hello');
      expect(c.root_network_id).toBe(rootNetworkId);

      const list = getInstancesByWorld(rootNetworkId);
      expect(list).toHaveLength(1);
    });

    it('should update instance', () => {
      const c = createInstance({ root_network_id: rootNetworkId, title: 'Old' });
      const updated = updateInstance(c.id, { title: 'New', color: '#ff0000' });
      expect(updated?.title).toBe('New');
      expect(updated?.color).toBe('#ff0000');
    });

    it('should delete instance', () => {
      const c = createInstance({ root_network_id: rootNetworkId, title: 'Del' });
      expect(deleteInstance(c.id)).toBe(true);
      expect(getInstancesByWorld(rootNetworkId)).toHaveLength(0);
    });

    it('should search by title', () => {
      createInstance({ root_network_id: rootNetworkId, title: 'Alpha' });
      createInstance({ root_network_id: rootNetworkId, title: 'Beta' });
      createInstance({ root_network_id: rootNetworkId, title: 'Alphabet' });

      expect(searchInstances(rootNetworkId, 'alph')).toHaveLength(2);
      expect(searchInstances(rootNetworkId, 'beta')).toHaveLength(1);
      expect(searchInstances(rootNetworkId, 'xyz')).toHaveLength(0);
    });

    it('should cascade delete when world is deleted', () => {
      createInstance({ root_network_id: rootNetworkId, title: 'C1' });
      deleteWorld(rootNetworkId);
      expect(getInstancesByWorld(rootNetworkId)).toHaveLength(0);
    });

    it('should create object record when creating instance', () => {
      const c = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      const obj = getObjectByRef('instance', c.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('instance');
      expect(obj!.scope).toBe('world');
      expect(obj!.root_network_id).toBe(rootNetworkId);
    });

    it('should delete object record when deleting instance', () => {
      const c = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      deleteInstance(c.id);
      expect(getObjectByRef('instance', c.id)).toBeUndefined();
    });
  });

  // --- Objects ---

  describe('Objects', () => {
    it('should create and get object', () => {
      const obj = createObject('instance', 'world', null, 'ref-123');
      expect(obj.id).toBeDefined();
      expect(obj.object_type).toBe('instance');
      expect(obj.ref_id).toBe('ref-123');

      const fetched = getObject(obj.id);
      expect(fetched?.id).toBe(obj.id);
    });

    it('should get object by ref', () => {
      createObject('instance', 'world', null, 'ref-456');
      const found = getObjectByRef('instance', 'ref-456');
      expect(found?.ref_id).toBe('ref-456');
      expect(getObjectByRef('instance', 'nonexistent')).toBeUndefined();
    });

    it('should enforce unique object_type + ref_id', () => {
      createObject('instance', 'world', null, 'dup-ref');
      expect(() => createObject('instance', 'world', null, 'dup-ref')).toThrow();
    });

    it('should allow same ref_id with different object_type', () => {
      createObject('instance', 'world', null, 'shared-ref');
      expect(() => createObject('file', 'world', null, 'shared-ref')).not.toThrow();
    });

    it('should delete object', () => {
      const obj = createObject('instance', 'world', null, 'del-ref');
      expect(deleteObject(obj.id)).toBe(true);
      expect(getObject(obj.id)).toBeUndefined();
    });

    it('should delete object by ref', () => {
      createObject('instance', 'world', null, 'del-by-ref');
      expect(deleteObjectByRef('instance', 'del-by-ref')).toBe(true);
      expect(getObjectByRef('instance', 'del-by-ref')).toBeUndefined();
    });

    it('should return undefined for nonexistent object', () => {
      expect(getObject('nonexistent-id')).toBeUndefined();
    });

    it('should return false when deleting nonexistent object', () => {
      expect(deleteObject('nonexistent-id')).toBe(false);
      expect(deleteObjectByRef('instance', 'nonexistent-ref')).toBe(false);
    });
  });

  // --- Network + Nodes + Edges ---

  describe('Network', () => {
    let rootNetworkId: string;

    beforeEach(() => {
      rootNetworkId = createWorld({ name: 'P', root_dir: '/tmp/p2' }).id;
    });

    it('should create and list networks', () => {
      createNetwork({ root_network_id: rootNetworkId, name: 'Network 1' });
      createNetwork({ root_network_id: rootNetworkId, name: 'Network 2' });
      expect(listNetworks(rootNetworkId)).toHaveLength(3);
    });

    it('should create network with scope and parent', () => {
      const parent = createNetwork({ root_network_id: rootNetworkId, name: 'Parent' });
      const child = createNetwork({ root_network_id: rootNetworkId, name: 'Child', parent_network_id: parent.id });
      expect(child.parent_network_id).toBe(parent.id);
      expect(child.scope).toBe('world');
    });

    it('should auto-create layout when creating network', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const layout = getLayoutByNetwork(network.id);
      expect(layout).toBeDefined();
      expect(layout!.layout_type).toBe('freeform');
      expect(layout!.network_id).toBe(network.id);
    });

    it('should create object record when creating network', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const obj = getObjectByRef('network', network.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('network');
      expect(obj!.scope).toBe('world');
    });

    it('should update network name', () => {
      const n = createNetwork({ root_network_id: rootNetworkId, name: 'Old' });
      const updated = updateNetwork(n.id, { name: 'New' });
      expect(updated?.name).toBe('New');
    });

    it('should add nodes with object_id and get full network', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'Node1' });
      const instanceObj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({
        network_id: network.id,
        object_id: instanceObj.id,
      });

      // Set position via layout
      const layout = getLayoutByNetwork(network.id)!;
      setNodePosition(layout.id, node.id, JSON.stringify({ x: 50, y: 100 }));

      const full = getNetworkFull(network.id);
      expect(full).toBeDefined();
      expect(full!.nodes).toHaveLength(1);
      expect(full!.nodes[0]!.instance!.title).toBe('Node1');
      expect(full!.nodes[0]!.object!.object_type).toBe('instance');
      expect(full!.nodePositions).toHaveLength(1);
      expect(JSON.parse(full!.nodePositions[0].positionJson).x).toBe(50);
    });

    it('should enforce unique object per network', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'N' });
      const instanceObj = getObjectByRef('instance', instance.id)!;
      addNetworkNode({ network_id: network.id, object_id: instanceObj.id });
      expect(() =>
        addNetworkNode({ network_id: network.id, object_id: instanceObj.id }),
      ).toThrow();
    });

    it('should create and delete edges', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const c1 = createInstance({ root_network_id: rootNetworkId, title: 'A' });
      const c2 = createInstance({ root_network_id: rootNetworkId, title: 'B' });
      const obj1 = getObjectByRef('instance', c1.id)!;
      const obj2 = getObjectByRef('instance', c2.id)!;
      const n1 = addNetworkNode({ network_id: network.id, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: network.id, object_id: obj2.id });

      const edge = createEdge({ network_id: network.id, source_node_id: n1.id, target_node_id: n2.id });
      expect(edge.id).toBeDefined();

      const full = getNetworkFull(network.id);
      expect(full!.edges).toHaveLength(1);

      expect(deleteEdge(edge.id)).toBe(true);
      expect(getNetworkFull(network.id)!.edges).toHaveLength(0);
    });

    it('should cascade delete nodes when network is deleted', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'N' });
      const instanceObj = getObjectByRef('instance', instance.id)!;
      addNetworkNode({ network_id: network.id, object_id: instanceObj.id });

      deleteNetwork(network.id);
      expect(getNetworkFull(network.id)).toBeUndefined();
    });

    it('should return false when deleting nonexistent network', () => {
      expect(deleteNetwork('nonexistent')).toBe(false);
    });

    it('should return undefined when updating nonexistent network', () => {
      expect(updateNetwork('nonexistent', { name: 'X' })).toBeUndefined();
    });

    it('should update network scope', () => {
      const n = createNetwork({ root_network_id: rootNetworkId, name: 'N', scope: 'world' });
      const updated = updateNetwork(n.id, { scope: 'app' });
      expect(updated?.scope).toBe('app');
    });

    it('should update network node metadata', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      const obj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: network.id, object_id: obj.id });
      expect(node.metadata).toBeNull();

      const updated = updateNetworkNode(node.id, { metadata: '{"label":"test"}' });
      expect(updated.metadata).toBe('{"label":"test"}');
    });

    it('should update edge description', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const c1 = createInstance({ root_network_id: rootNetworkId, title: 'A' });
      const c2 = createInstance({ root_network_id: rootNetworkId, title: 'B' });
      const obj1 = getObjectByRef('instance', c1.id)!;
      const obj2 = getObjectByRef('instance', c2.id)!;
      const n1 = addNetworkNode({ network_id: network.id, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: network.id, object_id: obj2.id });

      const edge = createEdge({ network_id: network.id, source_node_id: n1.id, target_node_id: n2.id, description: 'initial' });
      expect(edge.description).toBe('initial');

      const updated = updateEdge(edge.id, { description: 'modified' });
      expect(updated?.description).toBe('modified');
    });

    it('should persist meanings on edges', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const meaning = createMeaning({ root_network_id: rootNetworkId, name: 'Contains', target_kind: 'relation' });
      const c1 = createInstance({ root_network_id: rootNetworkId, title: 'A' });
      const c2 = createInstance({ root_network_id: rootNetworkId, title: 'B' });
      const obj1 = getObjectByRef('instance', c1.id)!;
      const obj2 = getObjectByRef('instance', c2.id)!;
      const n1 = addNetworkNode({ network_id: network.id, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: network.id, object_id: obj2.id });

      const edge = createEdge({
        network_id: network.id,
        source_node_id: n1.id,
        target_node_id: n2.id,
        meaning_id: meaning.id,
      });

      expect(edge.meaning_id).toBe(meaning.id);
      expect(getEdge(edge.id)?.meaning_id).toBe(meaning.id);

      const entryPortal = createMeaning({ root_network_id: rootNetworkId, name: 'Entry Portal', target_kind: 'relation' });
      const updated = updateEdge(edge.id, { meaning_id: entryPortal.id });
      expect(updated?.meaning_id).toBe(entryPortal.id);
    });

    it('should return undefined when updating nonexistent edge', () => {
      expect(updateEdge('nonexistent', { description: 'x' })).toBeUndefined();
    });

    it('should delete object record when network is deleted', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'ObjDel' });
      deleteNetwork(network.id);
      expect(getObjectByRef('network', network.id)).toBeUndefined();
    });

    it('should list root-only networks', () => {
      const root = createNetwork({ root_network_id: rootNetworkId, name: 'Root' });
      createNetwork({ root_network_id: rootNetworkId, name: 'Child', parent_network_id: root.id });
      const all = listNetworks(rootNetworkId);
      const rootOnly = listNetworks(rootNetworkId, true);
      expect(all).toHaveLength(3);
      expect(rootOnly).toHaveLength(2);
      expect(rootOnly.map((network) => network.name)).toEqual(['P', 'Root']);
    });

    it('should remove network node', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      const obj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: network.id, object_id: obj.id });
      expect(removeNetworkNode(node.id)).toBe(true);
      expect(getNetworkFull(network.id)!.nodes).toHaveLength(0);
    });

    it('should cascade delete edges when node is removed', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const c1 = createInstance({ root_network_id: rootNetworkId, title: 'A' });
      const c2 = createInstance({ root_network_id: rootNetworkId, title: 'B' });
      const obj1 = getObjectByRef('instance', c1.id)!;
      const obj2 = getObjectByRef('instance', c2.id)!;
      const n1 = addNetworkNode({ network_id: network.id, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: network.id, object_id: obj2.id });
      createEdge({ network_id: network.id, source_node_id: n1.id, target_node_id: n2.id });

      removeNetworkNode(n1.id);
      expect(getNetworkFull(network.id)!.edges).toHaveLength(0);
    });
  });

  // --- Layout ---

  describe('Layout', () => {
    let rootNetworkId: string;
    let networkId: string;
    let layoutId: string;

    beforeEach(() => {
      rootNetworkId = createWorld({ name: 'P', root_dir: '/tmp/layout' }).id;
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      networkId = network.id;
      layoutId = getLayoutByNetwork(networkId)!.id;
    });

    it('should get layout by network', () => {
      const layout = getLayoutByNetwork(networkId);
      expect(layout).toBeDefined();
      expect(layout!.network_id).toBe(networkId);
      expect(layout!.layout_type).toBe('freeform');
    });

    it('should update layout', () => {
      const viewport = JSON.stringify({ x: 100, y: 200, zoom: 1.5 });
      const updated = updateLayout(layoutId, { viewport_json: viewport, layout_type: 'force' });
      expect(updated?.viewport_json).toBe(viewport);
      expect(updated?.layout_type).toBe('force');
    });

    it('should delete layout', () => {
      expect(deleteLayout(layoutId)).toBe(true);
      expect(getLayoutByNetwork(networkId)).toBeUndefined();
    });

    it('should set and get node positions', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      const instanceObj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: instanceObj.id });

      setNodePosition(layoutId, node.id, JSON.stringify({ x: 10, y: 20 }));
      const positions = getNodePositions(layoutId);
      expect(positions).toHaveLength(1);
      expect(positions[0].nodeId).toBe(node.id);
      expect(JSON.parse(positions[0].positionJson)).toEqual({ x: 10, y: 20 });
    });

    it('should upsert node position on conflict', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      const instanceObj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: instanceObj.id });

      setNodePosition(layoutId, node.id, JSON.stringify({ x: 10, y: 20 }));
      setNodePosition(layoutId, node.id, JSON.stringify({ x: 30, y: 40 }));
      const positions = getNodePositions(layoutId);
      expect(positions).toHaveLength(1);
      expect(JSON.parse(positions[0].positionJson)).toEqual({ x: 30, y: 40 });
    });

    it('should remove node position', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      const instanceObj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: instanceObj.id });

      setNodePosition(layoutId, node.id, JSON.stringify({ x: 10, y: 20 }));
      expect(removeNodePosition(layoutId, node.id)).toBe(true);
      expect(getNodePositions(layoutId)).toHaveLength(0);
    });

    it('should set and get edge visuals', () => {
      const c1 = createInstance({ root_network_id: rootNetworkId, title: 'A' });
      const c2 = createInstance({ root_network_id: rootNetworkId, title: 'B' });
      const obj1 = getObjectByRef('instance', c1.id)!;
      const obj2 = getObjectByRef('instance', c2.id)!;
      const n1 = addNetworkNode({ network_id: networkId, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: networkId, object_id: obj2.id });
      const edge = createEdge({ network_id: networkId, source_node_id: n1.id, target_node_id: n2.id });

      const visual = JSON.stringify({ color: '#ff0000', lineStyle: 'dashed', directed: true });
      setEdgeVisual(layoutId, edge.id, visual);
      const visuals = getEdgeVisuals(layoutId);
      expect(visuals).toHaveLength(1);
      expect(visuals[0].edgeId).toBe(edge.id);
      expect(JSON.parse(visuals[0].visualJson)).toEqual({ color: '#ff0000', lineStyle: 'dashed', directed: true });
    });

    it('should remove edge visual', () => {
      const c1 = createInstance({ root_network_id: rootNetworkId, title: 'A' });
      const c2 = createInstance({ root_network_id: rootNetworkId, title: 'B' });
      const obj1 = getObjectByRef('instance', c1.id)!;
      const obj2 = getObjectByRef('instance', c2.id)!;
      const n1 = addNetworkNode({ network_id: networkId, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: networkId, object_id: obj2.id });
      const edge = createEdge({ network_id: networkId, source_node_id: n1.id, target_node_id: n2.id });

      setEdgeVisual(layoutId, edge.id, JSON.stringify({ color: '#00ff00' }));
      expect(removeEdgeVisual(layoutId, edge.id)).toBe(true);
      expect(getEdgeVisuals(layoutId)).toHaveLength(0);
    });

    it('should cascade delete layout_nodes when layout is deleted', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      const instanceObj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: instanceObj.id });
      setNodePosition(layoutId, node.id, JSON.stringify({ x: 0, y: 0 }));

      deleteLayout(layoutId);
      // Re-create layout to query positions (original was deleted)
      const newLayout = createLayout({ contextId: 'test-ctx' });
      expect(getNodePositions(newLayout.id)).toHaveLength(0);
    });

    it('should cascade delete layout when network is deleted', () => {
      deleteNetwork(networkId);
      expect(getLayoutByNetwork(networkId)).toBeUndefined();
    });
  });

  // --- Universe / Root Network ---

  describe('System Networks', () => {
    it('should create universe network', () => {
      const root = ensureUniverseNetwork();
      expect(root.scope).toBe('app');
      expect(root.kind).toBe('universe');
      expect(root.parent_network_id).toBeNull();
      expect(root.name).toBe('Universe');
    });

    it('should return same universe on subsequent calls', () => {
      const root1 = ensureUniverseNetwork();
      const root2 = ensureUniverseNetwork();
      expect(root1.id).toBe(root2.id);
    });

    it('should get universe network', () => {
      ensureUniverseNetwork();
      const root = getUniverseNetwork();
      expect(root).toBeDefined();
      expect(root!.scope).toBe('app');
      expect(root!.kind).toBe('universe');
    });

    it('should get root network as the world itself', () => {
      const world = createWorld({ name: 'P', root_dir: '/tmp/pr' });
      const rootNetwork = getRootNetwork(world.id);
      expect(rootNetwork).toBeDefined();
      expect(rootNetwork!.id).toBe(world.id);
      expect(rootNetwork!.kind).toBe('root');
      expect(rootNetwork!.parent_network_id).toBeNull();
      expect(rootNetwork!.name).toBe('P');
    });

    it('should use the root network as the initial owner network scope', () => {
      const world = createWorld({ name: 'Scoped', root_dir: '/tmp/scoped' });
      const rootNetwork = getRootNetwork(world.id);
      expect(rootNetwork).toBeDefined();

      const db = getTestDb();
      const schema = db.prepare(
        "SELECT owner_network_id FROM schemas WHERE root_network_id = ? AND source_ref = 'schema.meaning_category'",
      ).get(world.id) as { owner_network_id: string | null } | undefined;
      expect(schema?.owner_network_id).toBe(rootNetwork!.id);

      const meanings = listMeanings(world.id);
      expect(meanings.length).toBeGreaterThan(0);
      expect(meanings.every((meaning) => meaning.owner_network_id === rootNetwork!.id)).toBe(true);

      const bindingCount = db.prepare(
        `SELECT COUNT(*) AS count
           FROM object_scope_bindings
          WHERE scope_network_id = ?
            AND binding_kind = 'visible'`,
      ).get(rootNetwork!.id) as { count: number };
      expect(bindingCount.count).toBeGreaterThan(0);
    });

    it('should repair stale ontology owner references after the world boundary migration', () => {
      const world = createWorld({ name: 'Migrated', root_dir: '/tmp/migrated' });
      const rootNetwork = getRootNetwork(world.id);
      expect(rootNetwork).toBeDefined();

      const db = getTestDb();
      db.pragma('foreign_keys = OFF');
      db.prepare(
        "UPDATE schemas SET owner_network_id = 'network-deleted-ontology' WHERE root_network_id = ? AND source_ref = 'schema.meaning_category'",
      ).run(world.id);
      db.prepare("UPDATE instances SET owner_network_id = 'network-deleted-ontology' WHERE root_network_id = ?").run(world.id);
      db.prepare("UPDATE meanings SET owner_network_id = 'network-deleted-ontology' WHERE root_network_id = ?").run(world.id);
      db.prepare("UPDATE object_scope_bindings SET scope_network_id = 'network-deleted-ontology' WHERE scope_network_id = ?").run(rootNetwork!.id);
      db.pragma('foreign_keys = ON');

      migrate062(db);
      const meanings = listMeanings(world.id);

      const schema = db.prepare(
        "SELECT owner_network_id FROM schemas WHERE root_network_id = ? AND source_ref = 'schema.meaning_category'",
      ).get(world.id) as { owner_network_id: string | null } | undefined;
      const categories = listMeaningCategoriesForWorldDb(db, world.id);
      const violations = db.pragma('foreign_key_check') as unknown[];

      expect(schema?.owner_network_id).toBe(rootNetwork!.id);
      expect(categories.every((category) => category.owner_network_id === rootNetwork!.id)).toBe(true);
      expect(meanings.every((meaning) => meaning.owner_network_id === rootNetwork!.id)).toBe(true);
      expect(violations).toEqual([]);
    });
  });

  // --- File Entity ---

  describe('FileEntity', () => {
    let rootNetworkId: string;

    beforeEach(() => {
      rootNetworkId = createWorld({ name: 'P', root_dir: '/tmp/p3' }).id;
    });

    it('should create and get file entity', () => {
      const f = createFileEntity({ root_network_id: rootNetworkId, path: 'docs/readme.md', type: 'file' });
      expect(f.path).toBe('docs/readme.md');
      expect(f.type).toBe('file');
      expect(f.metadata).toBeNull();

      const fetched = getFileEntity(f.id);
      expect(fetched?.id).toBe(f.id);
    });

    it('should get file entity by path', () => {
      createFileEntity({ root_network_id: rootNetworkId, path: 'src/index.ts', type: 'file' });
      const found = getFileEntityByPath(rootNetworkId, 'src/index.ts');
      expect(found?.path).toBe('src/index.ts');
      expect(getFileEntityByPath(rootNetworkId, 'nonexistent')).toBeUndefined();
    });

    it('should list by world', () => {
      createFileEntity({ root_network_id: rootNetworkId, path: 'a.md', type: 'file' });
      createFileEntity({ root_network_id: rootNetworkId, path: 'docs', type: 'directory' });
      const list = getFileEntitiesByWorld(rootNetworkId);
      expect(list).toHaveLength(2);
    });

    it('should update metadata', () => {
      const f = createFileEntity({ root_network_id: rootNetworkId, path: 'test.pdf', type: 'file' });
      const meta = JSON.stringify({ pdf_toc: { entries: [] } });
      const updated = updateFileEntity(f.id, { metadata: meta });
      expect(updated?.metadata).toBe(meta);
    });

    it('should delete file entity', () => {
      const f = createFileEntity({ root_network_id: rootNetworkId, path: 'del.md', type: 'file' });
      expect(deleteFileEntity(f.id)).toBe(true);
      expect(getFileEntity(f.id)).toBeUndefined();
    });

    it('should enforce unique root_network_id+path', () => {
      createFileEntity({ root_network_id: rootNetworkId, path: 'dup.md', type: 'file' });
      expect(() => createFileEntity({ root_network_id: rootNetworkId, path: 'dup.md', type: 'file' })).toThrow();
    });

    it('should cascade delete when world is deleted', () => {
      createFileEntity({ root_network_id: rootNetworkId, path: 'cascade.md', type: 'file' });
      deleteWorld(rootNetworkId);
      expect(getFileEntitiesByWorld(rootNetworkId)).toHaveLength(0);
    });

    it('should create object record when creating file entity', () => {
      const f = createFileEntity({ root_network_id: rootNetworkId, path: 'obj.md', type: 'file' });
      const obj = getObjectByRef('file', f.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('file');
      expect(obj!.scope).toBe('world');
    });

    it('should delete object record when deleting file entity', () => {
      const f = createFileEntity({ root_network_id: rootNetworkId, path: 'obj-del.md', type: 'file' });
      deleteFileEntity(f.id);
      expect(getObjectByRef('file', f.id)).toBeUndefined();
    });
  });

  // --- Module ---

  describe('Module', () => {
    let rootNetworkId: string;

    beforeEach(() => {
      rootNetworkId = createWorld({ name: 'P', root_dir: '/tmp/mod' }).id;
    });

    it('should create and list modules', () => {
      const m = createModule({
        root_network_id: rootNetworkId,
        name: 'frontend',
        description: 'Frontend workspace',
        path: '/tmp/mod/frontend',
      });
      expect(m.id).toBeDefined();
      expect(m.name).toBe('frontend');
      expect(m.description).toBe('Frontend workspace');
      expect(m.path).toBe('/tmp/mod/frontend');

      const list = listModules(rootNetworkId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(m.id);
      expect(list[0].description).toBe('Frontend workspace');
    });

    it('should update module name, description, and path', () => {
      const m = createModule({ root_network_id: rootNetworkId, name: 'old', path: '/tmp/mod/old' });
      const updated = updateModule(m.id, { name: 'new', description: 'Updated module', path: '/tmp/mod/new' });
      expect(updated?.name).toBe('new');
      expect(updated?.description).toBe('Updated module');
      expect(updated?.path).toBe('/tmp/mod/new');
      expect(listModuleDirectories(m.id)).toHaveLength(1);
      expect(listModuleDirectories(m.id)[0].dir_path).toBe('/tmp/mod/new');
    });

    it('should keep only one directory path per module', () => {
      const m = createModule({ root_network_id: rootNetworkId, name: 'single', path: '/tmp/mod/one' });
      addModuleDirectory({ module_id: m.id, dir_path: '/tmp/mod/two' });

      const directories = listModuleDirectories(m.id);
      const updated = listModules(rootNetworkId).find((module) => module.id === m.id);

      expect(directories).toHaveLength(1);
      expect(directories[0].dir_path).toBe('/tmp/mod/two');
      expect(updated?.path).toBe('/tmp/mod/two');
    });

    it('should delete module', () => {
      const m = createModule({ root_network_id: rootNetworkId, name: 'del', path: '/tmp/mod/del' });
      expect(deleteModule(m.id)).toBe(true);
      expect(listModules(rootNetworkId)).toHaveLength(0);
    });

    it('should cascade delete when world is deleted', () => {
      createModule({ root_network_id: rootNetworkId, name: 'mod', path: '/tmp/mod/mod' });
      deleteWorld(rootNetworkId);
      expect(listModules(rootNetworkId)).toHaveLength(0);
    });
  });

  // --- Hierarchical Network (parent_network_id) ---

  describe('Hierarchical Network', () => {
    let rootNetworkId: string;

    beforeEach(() => {
      rootNetworkId = createWorld({ name: 'P', root_dir: '/tmp/hc' }).id;
    });

    it('should create child network with parent_network_id', () => {
      const parent = createNetwork({ root_network_id: rootNetworkId, name: 'Root' });
      const child = createNetwork({ root_network_id: rootNetworkId, name: 'Child', parent_network_id: parent.id });
      expect(child.parent_network_id).toBe(parent.id);
    });

    it('should build network tree from parent_network_id', () => {
      const root = createNetwork({ root_network_id: rootNetworkId, name: 'Root' });
      const child1 = createNetwork({ root_network_id: rootNetworkId, name: 'Child1', parent_network_id: root.id });
      const child2 = createNetwork({ root_network_id: rootNetworkId, name: 'Child2', parent_network_id: root.id });
      createNetwork({ root_network_id: rootNetworkId, name: 'Grandchild', parent_network_id: child1.id });

      const tree = getNetworkTree(rootNetworkId);
      expect(tree).toHaveLength(2);
      expect(tree[0].network.name).toBe('P');
      expect(tree[0].children).toHaveLength(0);
      expect(tree[1].network.name).toBe('Root');
      expect(tree[1].children).toHaveLength(2);
      expect(tree[1].children[0].children).toHaveLength(1);
      expect(tree[1].children[0].children[0].network.name).toBe('Grandchild');
    });

    it('should get network ancestors via parent_network_id chain', () => {
      const root = createNetwork({ root_network_id: rootNetworkId, name: 'Root' });
      const child = createNetwork({ root_network_id: rootNetworkId, name: 'Child', parent_network_id: root.id });
      const grandchild = createNetwork({ root_network_id: rootNetworkId, name: 'Grandchild', parent_network_id: child.id });

      const ancestors = getNetworkAncestors(grandchild.id);
      expect(ancestors).toHaveLength(3);
      expect(ancestors[0].networkName).toBe('Root');
      expect(ancestors[1].networkName).toBe('Child');
      expect(ancestors[2].networkName).toBe('Grandchild');
    });

    it('should cascade delete child networks when parent is deleted', () => {
      const parent = createNetwork({ root_network_id: rootNetworkId, name: 'Parent' });
      const child = createNetwork({ root_network_id: rootNetworkId, name: 'Child', parent_network_id: parent.id });
      deleteNetwork(parent.id);
      expect(getNetworkFull(child.id)).toBeUndefined();
    });

    it('should include layout data in getNetworkFull', () => {
      const network = createNetwork({ root_network_id: rootNetworkId, name: 'N' });
      const full = getNetworkFull(network.id);
      expect(full).toBeDefined();
      expect(full!.layout).toBeDefined();
      expect(full!.layout!.layout_type).toBe('freeform');
    });
  });

  // --- Editor Prefs ---

  describe('EditorPrefs', () => {
    let instanceId: string;

    beforeEach(() => {
      const rootNetworkId = createWorld({ name: 'P', root_dir: '/tmp/ep' }).id;
      instanceId = createInstance({ root_network_id: rootNetworkId, title: 'C' }).id;
    });

    it('should return undefined for non-existing prefs', () => {
      expect(getEditorPrefs(instanceId)).toBeUndefined();
    });

    it('should upsert prefs (insert then update)', () => {
      const p1 = upsertEditorPrefs(instanceId, { view_mode: 'float', float_x: 100 });
      expect(p1.view_mode).toBe('float');
      expect(p1.float_x).toBe(100);
      expect(p1.float_width).toBe(600);

      const p2 = upsertEditorPrefs(instanceId, { view_mode: 'side', side_split_ratio: 0.3 });
      expect(p2.view_mode).toBe('side');
      expect(p2.float_x).toBe(100); // preserved from previous
      expect(p2.side_split_ratio).toBe(0.3);
    });

    it('should get prefs after upsert', () => {
      upsertEditorPrefs(instanceId, { view_mode: 'full' });
      const prefs = getEditorPrefs(instanceId);
      expect(prefs?.view_mode).toBe('full');
    });

    it('should cascade delete when instance is deleted', () => {
      upsertEditorPrefs(instanceId, { view_mode: 'float' });
      deleteInstance(instanceId);
      expect(getEditorPrefs(instanceId)).toBeUndefined();
    });
  });

  describe('Meaning', () => {
    let rootNetworkId: string;

    beforeEach(() => {
      const world = createWorld({ name: 'Test', root_dir: '/meaning-test' });
      rootNetworkId = world.id;
    });

    it('should seed built-in meanings for new worlds', () => {
      const meanings = listMeanings(rootNetworkId);
      const temporal = meanings.find((meaning) => meaning.key === 'temporal');
      const dependency = meanings.find((meaning) => meaning.key === 'depends_on');

      expect(meanings.length).toBeGreaterThan(0);
      expect(temporal).toBeDefined();
      expect(dependency).toBeDefined();
      expect(dependency?.target_kind).toBe('relation');
      expect(dependency?.directed).toBe(true);
      expect(temporal?.built_in).toBe(true);
      expect(temporal?.description).toContain('occupy time');
      expect(temporal?.recipe.meanings[0]?.fields[0]?.name).toBe('Start At');
      expect(meanings.find((meaning) => meaning.key === 'instance_multi_select')).toBeUndefined();
      expect(meanings.find((meaning) => meaning.key === 'computed_field')).toBeUndefined();

      const obj = getObjectByRef('meaning', temporal!.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('meaning');
      expect(obj!.root_network_id).toBe(rootNetworkId);
    });

    it('should create, update, and delete custom meanings', () => {
      const categorySchemaId = listMeaningCategoriesForWorldDb(getTestDb(), rootNetworkId)[0]?.schema_id;
      expect(categorySchemaId).toBeDefined();
      const experimentCategory = createInstance({
        root_network_id: rootNetworkId,
        schema_id: categorySchemaId!,
        title: 'Experiment',
        source_kind: 'world',
        source_ref: 'meaning-category.experiment',
      });
      const meaning = createMeaning({
        root_network_id: rootNetworkId,
        name: 'Experiment Rhythm',
        category_instance_id: experimentCategory.id,
        recipe: {
          meanings: [{
            id: 'cadence',
            key: 'cadence',
            name: 'Cadence',
            representation: 'field_group',
            fields: [{
              id: 'frequency',
              key: 'frequency',
              name: 'Frequency',
              field_types: ['select', 'text'],
              required: true,
            }],
          }],
          rules: [{ id: 'cadence-required', description: 'Frequency is required.' }],
        },
      });

      expect(meaning.key).toBe('experiment_rhythm');
      expect(meaning.category_instance_id).toBe(experimentCategory.id);
      expect(meaning.category_instance_title).toBe('Experiment');
      expect(meaning.recipe.meanings[0]?.fields[0]?.name).toBe('Frequency');
      expect(meaning.recipe.meanings[0]?.fields[0]?.field_types).toEqual(['select', 'text']);
      expect(getObjectByRef('meaning', meaning.id)).toBeDefined();

      const updated = updateMeaning(meaning.id, {
        name: 'Experiment Cadence',
        recipe: {
          ...meaning.recipe,
          rules: [{ id: 'cadence-required', description: 'Frequency and interval are required.' }],
        },
      });

      expect(updated?.name).toBe('Experiment Cadence');
      expect(updated?.recipe.rules[0]?.description).toContain('interval');
      expect(getMeaning(meaning.id)?.name).toBe('Experiment Cadence');

      expect(deleteMeaning(meaning.id)).toBe(true);
      expect(getMeaning(meaning.id)).toBeUndefined();
      expect(getObjectByRef('meaning', meaning.id)).toBeUndefined();
    });

    it('should keep schema meaning references aligned when a custom meaning key changes', () => {
      const knowledgeCategory = listMeaningCategoriesForWorldDb(getTestDb(), rootNetworkId).find((category) => category.source_ref === 'meaning-category.knowledge');
      const meaning = createMeaning({
        root_network_id: rootNetworkId,
        name: 'Evidence Lifecycle',
        category_instance_id: knowledgeCategory?.id ?? null,
        meaning_keys: ['versioning'],
      });
      const schema = createSchema({
        root_network_id: rootNetworkId,
        name: 'Evidence',
        meanings: [meaning.key],
      });

      const updated = updateMeaning(meaning.id, { key: 'evidence_state' });

      expect(updated?.key).toBe('evidence_state');
      expect(getSchema(schema.id)?.meanings).toEqual(['evidence_state']);
    });

    it('should remove deleted custom meaning keys from schemas', () => {
      const meaning = createMeaning({
        root_network_id: rootNetworkId,
        name: 'Evidence Lifecycle',
        meaning_keys: ['versioning'],
      });
      const schema = createSchema({
        root_network_id: rootNetworkId,
        name: 'Evidence',
        meanings: [meaning.key],
      });

      expect(schema.meanings).toEqual([meaning.key]);

      expect(deleteMeaning(meaning.id)).toBe(true);
      expect(getSchema(schema.id)?.meanings).toEqual([]);
    });
  });

  describe('NetworkNode with objects', () => {
    let rootNetworkId: string;
    let networkId: string;

    beforeEach(() => {
      const world = createWorld({ name: 'Test', root_dir: '/node-test' });
      rootNetworkId = world.id;
      networkId = createNetwork({ root_network_id: rootNetworkId, name: 'Network' }).id;
    });

    it('should add node with instance object', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'C' });
      const obj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: obj.id });
      expect(node.object_id).toBe(obj.id);
      expect(node.node_type).toBe('basic');
    });

    it('should add node with file object', () => {
      const file = createFileEntity({ root_network_id: rootNetworkId, path: 'readme.md', type: 'file' });
      const obj = getObjectByRef('file', file.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: obj.id });
      expect(node.object_id).toBe(obj.id);
      expect(node.node_type).toBe('basic');
    });

    it('should add node with custom node_type', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'Portal' });
      const obj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: obj.id, node_type: 'portal' });
      expect(node.node_type).toBe('portal');
    });

    it('should add node with hierarchy node_type', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'Hierarchy' });
      const obj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: obj.id, node_type: 'hierarchy' });
      expect(node.node_type).toBe('hierarchy');
    });

    it('should add node with parent_node_id', () => {
      const c1 = createInstance({ root_network_id: rootNetworkId, title: 'Parent' });
      const c2 = createInstance({ root_network_id: rootNetworkId, title: 'Child' });
      const obj1 = getObjectByRef('instance', c1.id)!;
      const obj2 = getObjectByRef('instance', c2.id)!;
      const parentNode = addNetworkNode({ network_id: networkId, object_id: obj1.id, node_type: 'group' });
      const childNode = addNetworkNode({ network_id: networkId, object_id: obj2.id, parent_node_id: parentNode.id });
      expect(childNode.parent_node_id).toBe(parentNode.id);
    });

    it('should return file nodes with file data in getNetworkFull', () => {
      const file = createFileEntity({ root_network_id: rootNetworkId, path: 'test.md', type: 'file' });
      const obj = getObjectByRef('file', file.id)!;
      addNetworkNode({ network_id: networkId, object_id: obj.id });
      const full = getNetworkFull(networkId)!;
      expect(full.nodes).toHaveLength(1);
      expect(full.nodes[0].object!.object_type).toBe('file');
      expect(full.nodes[0].file?.path).toBe('test.md');
      expect(full.nodes[0].instance).toBeUndefined();
    });

    it('should return instance nodes with instance data in getNetworkFull', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'My Instance' });
      const obj = getObjectByRef('instance', instance.id)!;
      addNetworkNode({ network_id: networkId, object_id: obj.id });
      const full = getNetworkFull(networkId)!;
      expect(full.nodes).toHaveLength(1);
      expect(full.nodes[0].object!.object_type).toBe('instance');
      expect(full.nodes[0].instance?.title).toBe('My Instance');
      expect(full.nodes[0].file).toBeUndefined();
    });

    it('should map legacy box node_type to group in getNetworkFull', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'Legacy Box' });
      const obj = getObjectByRef('instance', instance.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: obj.id });
      getTestDb().prepare('UPDATE network_nodes SET node_type = ? WHERE id = ?').run('box', node.id);

      const full = getNetworkFull(networkId)!;
      expect(full.nodes[0].node_type).toBe('group');
    });

    it('should cascade delete node when object is deleted', () => {
      const instance = createInstance({ root_network_id: rootNetworkId, title: 'Cascade' });
      const obj = getObjectByRef('instance', instance.id)!;
      addNetworkNode({ network_id: networkId, object_id: obj.id });
      // Deleting the instance deletes the object (via deleteObjectByRef), which cascades to network_nodes
      deleteInstance(instance.id);
      const full = getNetworkFull(networkId)!;
      expect(full.nodes).toHaveLength(0);
    });
  });

  // --- getNetworkFull Integration ---

  describe('getNetworkFull integration', () => {
    it('should return all parts: network, layout, nodes, edges, positions, visuals', () => {
      const world = createWorld({ name: 'Int', root_dir: '/int-test' });
      const network = createNetwork({ root_network_id: world.id, name: 'Full' });

      // Create instance + file nodes
      const instance = createInstance({ root_network_id: world.id, title: 'Instance Node' });
      const file = createFileEntity({ root_network_id: world.id, path: 'test.md', type: 'file' });
      const instanceObj = getObjectByRef('instance', instance.id)!;
      const fileObj = getObjectByRef('file', file.id)!;
      const n1 = addNetworkNode({ network_id: network.id, object_id: instanceObj.id });
      const n2 = addNetworkNode({ network_id: network.id, object_id: fileObj.id });

      // Create edge with meaning
      const meaning = createMeaning({ root_network_id: world.id, name: 'References', target_kind: 'relation', directed: true });
      const edge = createEdge({
        network_id: network.id,
        source_node_id: n1.id,
        target_node_id: n2.id,
        meaning_id: meaning.id,
        description: 'instance references file',
      });

      // Set layout data
      const layout = getLayoutByNetwork(network.id)!;
      setNodePosition(layout.id, n1.id, JSON.stringify({ x: 0, y: 0 }));
      setNodePosition(layout.id, n2.id, JSON.stringify({ x: 200, y: 100 }));
      setEdgeVisual(layout.id, edge.id, JSON.stringify({ color: '#00ff00' }));

      // Verify full data
      const full = getNetworkFull(network.id)!;
      expect(full.network.name).toBe('Full');
      expect(full.layout).toBeDefined();
      expect(full.layout!.layout_type).toBe('freeform');
      expect(full.nodes).toHaveLength(2);
      expect(full.edges).toHaveLength(1);
      expect(full.nodePositions).toHaveLength(2);
      expect(full.edgeVisuals).toHaveLength(1);

      // Verify instance node has instance data
      const instanceNode = full.nodes.find((n) => n.object?.object_type === 'instance')!;
      expect(instanceNode.instance?.title).toBe('Instance Node');
      expect(instanceNode.file).toBeUndefined();

      // Verify file node has file data
      const fileNode = full.nodes.find((n) => n.object?.object_type === 'file')!;
      expect(fileNode.file?.path).toBe('test.md');
      expect(fileNode.instance).toBeUndefined();

      // Verify edge has meaning
      expect(full.edges[0].meaning?.name).toBe('References');
      expect(full.edges[0].meaning?.directed).toBe(true);
      expect(full.edges[0].description).toBe('instance references file');

      // Verify node positions
      const pos1 = full.nodePositions.find((p) => p.nodeId === n1.id)!;
      expect(JSON.parse(pos1.positionJson)).toEqual({ x: 0, y: 0 });

      // Verify edge visuals
      expect(JSON.parse(full.edgeVisuals[0].visualJson).color).toBe('#00ff00');
    });
  });

  // --- Context ---

  describe('Context', () => {
    let rootNetworkId: string;
    let networkId: string;

    beforeEach(() => {
      const world = createWorld({ name: 'Test', root_dir: '/ctx-test' });
      rootNetworkId = world.id;
      networkId = createNetwork({ root_network_id: rootNetworkId, name: 'Network' }).id;
    });

    it('should create and list contexts', () => {
      const ctx = createContext({ network_id: networkId, name: 'View A' });
      expect(ctx.id).toBeDefined();
      expect(ctx.name).toBe('View A');
      expect(ctx.network_id).toBe(networkId);
      expect(ctx.description).toBeNull();

      const list = listContexts(networkId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(ctx.id);
    });

    it('should get context by id', () => {
      const ctx = createContext({ network_id: networkId, name: 'Ctx' });
      expect(getContext(ctx.id)?.name).toBe('Ctx');
      expect(getContext('nonexistent')).toBeUndefined();
    });

    it('should update context', () => {
      const ctx = createContext({ network_id: networkId, name: 'Old' });
      const updated = updateContext(ctx.id, { name: 'New', description: 'desc' });
      expect(updated?.name).toBe('New');
      expect(updated?.description).toBe('desc');
    });

    it('should delete context', () => {
      const ctx = createContext({ network_id: networkId, name: 'Del' });
      expect(deleteContext(ctx.id)).toBe(true);
      expect(listContexts(networkId)).toHaveLength(0);
    });

    it('should create object record when creating context', () => {
      const ctx = createContext({ network_id: networkId, name: 'ObjTest' });
      const obj = getObjectByRef('context', ctx.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('context');
      expect(obj!.scope).toBe('world');
    });

    it('should delete object record when deleting context', () => {
      const ctx = createContext({ network_id: networkId, name: 'ObjDel' });
      deleteContext(ctx.id);
      expect(getObjectByRef('context', ctx.id)).toBeUndefined();
    });

    it('should add and get context members', () => {
      const ctx = createContext({ network_id: networkId, name: 'Members' });
      const member = addContextMember(ctx.id, 'object', 'some-object-id');
      expect(member.context_id).toBe(ctx.id);
      expect(member.member_type).toBe('object');
      expect(member.member_id).toBe('some-object-id');

      const members = getContextMembers(ctx.id);
      expect(members).toHaveLength(1);
      expect(members[0].id).toBe(member.id);
    });

    it('should remove context member', () => {
      const ctx = createContext({ network_id: networkId, name: 'Rm' });
      const member = addContextMember(ctx.id, 'edge', 'some-edge-id');
      expect(removeContextMember(member.id)).toBe(true);
      expect(getContextMembers(ctx.id)).toHaveLength(0);
    });

    it('should cascade delete members when context is deleted', () => {
      const ctx = createContext({ network_id: networkId, name: 'Cascade' });
      addContextMember(ctx.id, 'object', 'obj-1');
      addContextMember(ctx.id, 'edge', 'edge-1');
      deleteContext(ctx.id);
      expect(getContextMembers(ctx.id)).toHaveLength(0);
    });

    it('should cascade delete contexts when network is deleted', () => {
      createContext({ network_id: networkId, name: 'C1' });
      createContext({ network_id: networkId, name: 'C2' });
      deleteNetwork(networkId);
      expect(listContexts(networkId)).toHaveLength(0);
    });

    it('should enforce unique context member', () => {
      const ctx = createContext({ network_id: networkId, name: 'Unique' });
      addContextMember(ctx.id, 'object', 'dup-id');
      expect(() => addContextMember(ctx.id, 'object', 'dup-id')).toThrow();
    });

    it('should allow same member_id with different member_type', () => {
      const ctx = createContext({ network_id: networkId, name: 'MixTypes' });
      addContextMember(ctx.id, 'object', 'shared-id');
      expect(() => addContextMember(ctx.id, 'edge', 'shared-id')).not.toThrow();
      expect(getContextMembers(ctx.id)).toHaveLength(2);
    });

    it('should create context with description', () => {
      const ctx = createContext({ network_id: networkId, name: 'Desc', description: 'A viewpoint' });
      expect(ctx.description).toBe('A viewpoint');
    });

    it('should return undefined when updating nonexistent context', () => {
      expect(updateContext('nonexistent', { name: 'X' })).toBeUndefined();
    });

    it('should return false when deleting nonexistent context', () => {
      expect(deleteContext('nonexistent')).toBe(false);
    });

    it('should return false when removing nonexistent member', () => {
      expect(removeContextMember('nonexistent')).toBe(false);
    });
  });

  // --- Schema Semantics ---

  describe('Schema semantic compatibility', () => {
    let rootNetworkId: string;

    beforeEach(() => {
      rootNetworkId = createWorld({ name: 'Semantic', root_dir: '/semantic-test' }).id;
    });

    it('should attach meanings to schema on create/update', () => {
      const schema = createSchema({
        root_network_id: rootNetworkId,
        name: 'Event',
        meanings: ['temporal'],
      });

      expect(schema.meanings).toEqual(['temporal']);

      const updated = createSchema({
        root_network_id: rootNetworkId,
        name: 'Task',
        meanings: ['dueable'],
      });

      expect(updated.meanings).toEqual(['dueable']);
    });

    it('should bind fields to meanings and read legacy semantic annotations', () => {
      const schema = createSchema({ root_network_id: rootNetworkId, name: 'Event' });
      const start = createField({
        schema_id: schema.id,
        name: 'Start',
        field_type: 'datetime',
        sort_order: 0,
        meaning_bindings: ['time.start'],
      });

      expect(start.meaning_bindings).toEqual(['time.start']);

      const updated = updateField(start.id, { meaning_bindings: ['time.end', 'temporal.point', 'temporal.boundary.end'] });
      expect(updated?.meaning_bindings).toEqual(['time.end', 'temporal.point', 'temporal.boundary.end']);
    });

    it('should preserve multiple meaning bindings on a single field', () => {
      const schema = createSchema({ root_network_id: rootNetworkId, name: 'Task' });
      const due = createField({
        schema_id: schema.id,
        name: 'Due',
        field_type: 'datetime',
        sort_order: 0,
        meaning_bindings: ['time.due', 'temporal.deadline', 'obligation.due', 'boundary.deadline'],
      });

      expect(due.meaning_bindings).toEqual(['time.due', 'temporal.deadline', 'obligation.due', 'boundary.deadline']);
      expect(listFields(schema.id)[0].meaning_bindings).toEqual(due.meaning_bindings);

      const db = getTestDb();
      const meaningRows = db.prepare('SELECT meaning_key FROM field_meaning_bindings WHERE field_id = ? ORDER BY sort_order').all(due.id) as { meaning_key: string }[];
      expect(meaningRows.map((row) => row.meaning_key)).toEqual(due.meaning_bindings);
    });

    it('should create meanings with slot bindings and bind them to fields', () => {
      const schema = createSchema({ root_network_id: rootNetworkId, name: 'Recurring Task' });
      const meaning = ensureSchemaMeaning({
        schema_id: schema.id,
        meaning_key: 'recurrence',
        source: 'manual',
      });

      expect(meaning?.meaning_key).toBe('recurrence');
      expect(meaning?.slots.map((slot) => slot.slot_key)).toEqual([
        'recurrence_frequency',
        'recurrence_interval',
        'recurrence_weekdays',
        'recurrence_monthday',
        'recurrence_until',
        'recurrence_count',
      ]);

      const frequencyField = createField({
        schema_id: schema.id,
        name: 'Repeat frequency',
        field_type: 'select',
        sort_order: 0,
        meaning_bindings: ['time.recurrence_frequency'],
      });
      const frequencyBinding = listSchemaMeanings(schema.id)
        .find((item) => item.meaning_key === 'recurrence')
        ?.slots.find((slot) => slot.slot_key === 'recurrence_frequency');

      expect(frequencyBinding?.field_id).toBe(frequencyField.id);

      const untilField = createField({
        schema_id: schema.id,
        name: 'Repeat until',
        field_type: 'datetime',
        sort_order: 1,
      });
      const untilBinding = meaning!.slots.find((slot) => slot.slot_key === 'recurrence_until')!;
      updateSchemaMeaningSlotBinding(untilBinding.id, {
        target_kind: 'field',
        field_id: untilField.id,
      });

      const recurring = listSchemaMeanings(schema.id).find((item) => item.meaning_key === 'recurrence');
      expect(recurring?.slots.find((slot) => slot.slot_key === 'recurrence_until')?.field_id).toBe(untilField.id);
      expect(listFields(schema.id).find((field) => field.id === untilField.id)?.meaning_bindings).toContain('time.recurrence_until');
    });

    it('should repair legacy recurrence rule bindings into structured recurrence slots', () => {
      const schema = createSchema({ root_network_id: rootNetworkId, name: 'Legacy Recurring Task' });
      const db = getTestDb();
      const now = new Date().toISOString();
      const meaningId = 'legacy-recurrence-meaning';
      const fieldId = 'legacy-recurrence-rule-field';

      db.prepare(`
        INSERT INTO schema_fields (id, schema_id, name, field_type, sort_order, required, meaning_slot, meaning_key, slot_binding_locked, generated_by_meaning, created_at)
        VALUES (?, ?, 'Repeat rule', 'text', 0, 1, 'recurrence_rule', 'time.recurrence_rule', 1, 1, ?)
      `).run(fieldId, schema.id, now);
      db.prepare(`
        INSERT INTO schema_meanings (id, schema_id, meaning_key, label, source, source_meaning, sort_order, created_at, updated_at)
        VALUES (?, ?, 'recurrence', NULL, 'migration', NULL, 0, ?, ?)
      `).run(meaningId, schema.id, now, now);
      db.prepare(`
        INSERT INTO schema_meaning_slot_bindings (id, meaning_id, slot_key, target_kind, field_id, required, sort_order, created_at)
        VALUES ('legacy-recurrence-rule-binding', ?, 'recurrence_rule', 'field', ?, 1, 0, ?)
      `).run(meaningId, fieldId, now);

      const recurrence = listSchemaMeanings(schema.id).find((item) => item.meaning_key === 'recurrence');

      expect(recurrence?.slots.map((slot) => slot.slot_key)).toEqual([
        'recurrence_frequency',
        'recurrence_interval',
        'recurrence_weekdays',
        'recurrence_monthday',
        'recurrence_until',
        'recurrence_count',
      ]);
      expect(recurrence?.slots.some((slot) => slot.slot_key === 'recurrence_rule')).toBe(false);
      expect(recurrence?.slots.filter((slot) => slot.required).map((slot) => slot.slot_key)).toEqual([
        'recurrence_frequency',
        'recurrence_interval',
      ]);
    });
  });

  // --- Schema Composition Field ---

  describe('Schema composition field', () => {
    let rootNetworkId: string;

    beforeEach(() => {
      rootNetworkId = createWorld({ name: 'Test', root_dir: '/ref-test' }).id;
    });

    it('should create object field with source schema binding', () => {
      const a = createSchema({ root_network_id: rootNetworkId, name: 'Person' });
      const b = createSchema({ root_network_id: rootNetworkId, name: 'Company' });
      const field = createField({
        schema_id: a.id,
        name: 'employer',
        field_type: 'object',
        sort_order: 0,
        bindings: [{
          binding_kind: 'schema_composition',
          source_schema_id: b.id,
          cardinality: 'object',
        }],
      });
      expect(field.field_type).toBe('object');
      expect(field.bindings).toHaveLength(1);
      expect(field.bindings[0].source_schema_id).toBe(b.id);
    });

    it('should create and delete object record for schema', () => {
      const a = createSchema({ root_network_id: rootNetworkId, name: 'Placeable Type' });
      const obj = getObjectByRef('schema', a.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('schema');
      expect(obj!.root_network_id).toBe(rootNetworkId);

      expect(deleteSchema(a.id)).toBe(true);
      expect(getObjectByRef('schema', a.id)).toBeUndefined();
    });

    it('should reject self-referencing schema composition', () => {
      const a = createSchema({ root_network_id: rootNetworkId, name: 'Self' });
      expect(() =>
        createField({
          schema_id: a.id,
          name: 'self',
          field_type: 'object',
          sort_order: 0,
          bindings: [{
            binding_kind: 'schema_composition',
            source_schema_id: a.id,
            cardinality: 'object',
          }],
        }),
      ).toThrow('Circular schema composition detected');
    });

    it('should reject circular schema composition chain', () => {
      const a = createSchema({ root_network_id: rootNetworkId, name: 'A' });
      const b = createSchema({ root_network_id: rootNetworkId, name: 'B' });
      // A references B
      createField({
        schema_id: a.id,
        name: 'refB',
        field_type: 'object',
        sort_order: 0,
        bindings: [{
          binding_kind: 'schema_composition',
          source_schema_id: b.id,
          cardinality: 'object',
        }],
      });
      // B references A → cycle
      expect(() =>
        createField({
          schema_id: b.id,
          name: 'refA',
          field_type: 'object',
          sort_order: 0,
          bindings: [{
            binding_kind: 'schema_composition',
            source_schema_id: a.id,
            cardinality: 'object',
          }],
        }),
      ).toThrow('Circular schema composition detected');
    });

    it('should reject longer circular schema composition chain', () => {
      const a = createSchema({ root_network_id: rootNetworkId, name: 'A' });
      const b = createSchema({ root_network_id: rootNetworkId, name: 'B' });
      const c = createSchema({ root_network_id: rootNetworkId, name: 'C' });
      createField({ schema_id: a.id, name: 'refB', field_type: 'object', sort_order: 0, bindings: [{ binding_kind: 'schema_composition', source_schema_id: b.id, cardinality: 'object' }] });
      createField({ schema_id: b.id, name: 'refC', field_type: 'object', sort_order: 0, bindings: [{ binding_kind: 'schema_composition', source_schema_id: c.id, cardinality: 'object' }] });
      expect(() =>
        createField({ schema_id: c.id, name: 'refA', field_type: 'object', sort_order: 0, bindings: [{ binding_kind: 'schema_composition', source_schema_id: a.id, cardinality: 'object' }] }),
      ).toThrow('Circular schema composition detected');
    });

    it('should allow non-cyclic schema composition fan-out', () => {
      const a = createSchema({ root_network_id: rootNetworkId, name: 'A' });
      const b = createSchema({ root_network_id: rootNetworkId, name: 'B' });
      const c = createSchema({ root_network_id: rootNetworkId, name: 'C' });
      createField({ schema_id: a.id, name: 'refB', field_type: 'object', sort_order: 0, bindings: [{ binding_kind: 'schema_composition', source_schema_id: b.id, cardinality: 'object' }] });
      const field = createField({ schema_id: a.id, name: 'refC', field_type: 'object', sort_order: 1, bindings: [{ binding_kind: 'schema_composition', source_schema_id: c.id, cardinality: 'object' }] });
      expect(field.bindings[0].source_schema_id).toBe(c.id);
    });

    it('should clear binding source schema when referenced schema is deleted', () => {
      const a = createSchema({ root_network_id: rootNetworkId, name: 'A' });
      const b = createSchema({ root_network_id: rootNetworkId, name: 'B' });
      createField({ schema_id: a.id, name: 'ref', field_type: 'object', sort_order: 0, bindings: [{ binding_kind: 'schema_composition', source_schema_id: b.id, cardinality: 'object' }] });
      deleteSchema(b.id);
      const fields = listFields(a.id);
      expect(fields).toHaveLength(1);
      expect(fields[0].bindings[0].source_schema_id).toBeNull();
    });
  });

});
