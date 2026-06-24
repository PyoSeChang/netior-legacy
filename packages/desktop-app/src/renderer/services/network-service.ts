import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate, NetworkNodeUpdate,
  Edge, EdgeCreate, EdgeUpdate,
  Relationship, RelationshipCreate, RelationshipListFilters, RelationshipUpdate,
  ObjectRecord, Instance, FileEntity, Meaning, NetworkBreadcrumbItem,
  NetworkTreeNode, Layout,
} from '@netior/shared/types';

export interface NodePosition {
  nodeId: string;
  positionJson: string;
}

export interface EdgeVisual {
  edgeId: string;
  visualJson: string;
}

export interface NetworkFullData {
  network: Network;
  layout: Layout | undefined;
  nodes: (NetworkNode & {
    object?: ObjectRecord;
    instance?: Instance;
    file?: FileEntity;
  })[];
  edges: (Edge & { meaning?: Meaning; relationship?: Relationship & { meaning?: Meaning } })[];
  nodePositions: NodePosition[];
  edgeVisuals: EdgeVisual[];
}
import { unwrapIpc } from './ipc';

// Network
export async function createNetwork(data: NetworkCreate): Promise<Network> {
  return unwrapIpc(await window.electron.network.create(data as unknown as Record<string, unknown>));
}

export async function listNetworks(rootNetworkId: string, rootOnly?: boolean): Promise<Network[]> {
  return unwrapIpc(await window.electron.network.list(rootNetworkId, rootOnly));
}

export async function updateNetwork(id: string, data: NetworkUpdate): Promise<Network> {
  return unwrapIpc(await window.electron.network.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteNetwork(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.network.delete(id));
}

export async function getNetworkFull(networkId: string): Promise<NetworkFullData | undefined> {
  return unwrapIpc(await window.electron.network.getFull(networkId));
}

export async function getUniverseNetwork(): Promise<Network | undefined> {
  return unwrapIpc(await window.electron.network.getUniverse());
}

export async function getRootNetwork(rootNetworkId: string): Promise<Network | undefined> {
  return unwrapIpc(await window.electron.network.getRoot(rootNetworkId));
}

export async function getNetworkAncestors(networkId: string): Promise<NetworkBreadcrumbItem[]> {
  return unwrapIpc(await window.electron.network.getAncestors(networkId));
}

export async function getNetworkTree(rootNetworkId: string): Promise<NetworkTreeNode[]> {
  return unwrapIpc(await window.electron.network.getTree(rootNetworkId));
}

// Network Node
export async function addNetworkNode(data: NetworkNodeCreate): Promise<NetworkNode> {
  return unwrapIpc(await window.electron.networkNode.add(data as unknown as Record<string, unknown>));
}

export async function updateNetworkNode(id: string, data: NetworkNodeUpdate): Promise<NetworkNode> {
  return unwrapIpc(await window.electron.networkNode.update(id, data as unknown as Record<string, unknown>));
}

export async function removeNetworkNode(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.networkNode.remove(id));
}

// Edge
export async function createEdge(data: EdgeCreate): Promise<Edge> {
  return unwrapIpc(await window.electron.edge.create(data as unknown as Record<string, unknown>));
}

export async function getEdge(id: string): Promise<Edge | undefined> {
  return unwrapIpc(await window.electron.edge.get(id));
}

export async function updateEdge(id: string, data: EdgeUpdate): Promise<Edge> {
  return unwrapIpc(await window.electron.edge.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteEdge(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.edge.delete(id));
}

export async function listRelationships(filters: RelationshipListFilters): Promise<Relationship[]> {
  return unwrapIpc(await window.electron.relationship.list(filters as unknown as Record<string, unknown>));
}

export async function createRelationship(data: RelationshipCreate): Promise<Relationship> {
  return unwrapIpc(await window.electron.relationship.create(data as unknown as Record<string, unknown>));
}

export async function getRelationship(id: string): Promise<Relationship | undefined> {
  return unwrapIpc(await window.electron.relationship.get(id));
}

export async function updateRelationship(id: string, data: RelationshipUpdate): Promise<Relationship> {
  return unwrapIpc(await window.electron.relationship.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteRelationship(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.relationship.delete(id));
}

export async function listRelationshipOccurrences(id: string): Promise<Edge[]> {
  return unwrapIpc(await window.electron.relationship.listOccurrences(id));
}

export const networkService = {
  create: createNetwork, list: listNetworks, update: updateNetwork,
  delete: deleteNetwork, getFull: getNetworkFull,
  getUniverse: getUniverseNetwork, getRoot: getRootNetwork,
  getAncestors: getNetworkAncestors, getTree: getNetworkTree,
  node: { add: addNetworkNode, update: updateNetworkNode, remove: removeNetworkNode },
  edge: { create: createEdge, get: getEdge, update: updateEdge, delete: deleteEdge },
  relationship: {
    list: listRelationships,
    create: createRelationship,
    get: getRelationship,
    update: updateRelationship,
    delete: deleteRelationship,
    listOccurrences: listRelationshipOccurrences,
  },
};
