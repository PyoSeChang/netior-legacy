import type { Edge, Model, ModelRefKey, Relationship } from '@netior/shared/types';

export const CONTAINS_MODEL_KEY = 'contains_relation' as const;
export const ENTRY_PORTAL_MODEL_KEY = 'entry_portal_relation' as const;
export const HIERARCHY_PARENT_MODEL_KEY = 'parent_relation' as const;

export type EdgeWithModel = Edge & {
  model?: Model;
  relationship?: Relationship & { model?: Model };
};

export function systemEdgeModelId(projectId: string | null | undefined, key: ModelRefKey): string | null {
  return projectId ? `model-${projectId}-${key}` : null;
}

export function getEdgeModelKey(edge: Pick<EdgeWithModel, 'model' | 'relationship'>): string | null {
  return edge.relationship?.model?.key ?? edge.model?.key ?? null;
}

function hasSystemEdgeModelId(edge: Pick<EdgeWithModel, 'model_id' | 'relationship'>, key: ModelRefKey): boolean {
  const modelId = edge.relationship?.model_id ?? edge.model_id;
  return typeof modelId === 'string' && modelId.endsWith(`-${key}`);
}

export function isContainsEdge(edge: Pick<EdgeWithModel, 'model' | 'model_id' | 'relationship'>): boolean {
  return getEdgeModelKey(edge) === CONTAINS_MODEL_KEY || hasSystemEdgeModelId(edge, CONTAINS_MODEL_KEY);
}

export function isEntryPortalEdge(edge: Pick<EdgeWithModel, 'model' | 'model_id' | 'relationship'>): boolean {
  return getEdgeModelKey(edge) === ENTRY_PORTAL_MODEL_KEY || hasSystemEdgeModelId(edge, ENTRY_PORTAL_MODEL_KEY);
}

export function isHierarchyParentEdge(edge: Pick<EdgeWithModel, 'model' | 'model_id' | 'relationship'>): boolean {
  return getEdgeModelKey(edge) === HIERARCHY_PARENT_MODEL_KEY || hasSystemEdgeModelId(edge, HIERARCHY_PARENT_MODEL_KEY);
}
