import type { Layout, LayoutUpdate } from '@netior/shared/types';
import type { NodePosition, EdgeVisual } from './network-service';
import { unwrapIpc } from './ipc';

// Layout
export async function getLayoutByNetwork(networkId: string): Promise<Layout | undefined> {
  return unwrapIpc(await window.electron.layout.getByNetwork(networkId));
}

export async function updateLayout(id: string, data: LayoutUpdate): Promise<Layout> {
  return unwrapIpc(await window.electron.layout.update(id, data as unknown as Record<string, unknown>));
}

// Layout Node positions
export async function setNodePosition(layoutId: string, nodeId: string, positionJson: string): Promise<void> {
  await unwrapIpc(await window.electron.layoutNode.setPosition(layoutId, nodeId, positionJson));
}

export async function getNodePositions(layoutId: string): Promise<NodePosition[]> {
  return unwrapIpc(await window.electron.layoutNode.getPositions(layoutId));
}

export async function removeNodePosition(layoutId: string, nodeId: string): Promise<boolean> {
  return unwrapIpc(await window.electron.layoutNode.remove(layoutId, nodeId));
}

// Layout Edge visuals
export async function setEdgeVisual(layoutId: string, edgeId: string, visualJson: string): Promise<void> {
  await unwrapIpc(await window.electron.layoutEdge.setVisual(layoutId, edgeId, visualJson));
}

export async function getEdgeVisuals(layoutId: string): Promise<EdgeVisual[]> {
  return unwrapIpc(await window.electron.layoutEdge.getVisuals(layoutId));
}

export async function removeEdgeVisual(layoutId: string, edgeId: string): Promise<boolean> {
  return unwrapIpc(await window.electron.layoutEdge.remove(layoutId, edgeId));
}

export const layoutService = {
  getByNetwork: getLayoutByNetwork,
  update: updateLayout,
  node: { setPosition: setNodePosition, getPositions: getNodePositions, remove: removeNodePosition },
  edge: { setVisual: setEdgeVisual, getVisuals: getEdgeVisuals, remove: removeEdgeVisual },
};
