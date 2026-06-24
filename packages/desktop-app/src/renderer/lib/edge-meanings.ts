import type { Edge, Meaning, MeaningRefKey, Relationship } from '@netior/shared/types';

export const CONTAINS_MEANING_KEY = 'contains' as const;
export const ENTRY_PORTAL_MEANING_KEY = 'entry_portal' as const;
export const HIERARCHY_PARENT_MEANING_KEY = 'parent' as const;

export type EdgeWithMeaning = Edge & {
  meaning?: Meaning;
  relationship?: Relationship & { meaning?: Meaning };
};

export function systemEdgeMeaningId(rootNetworkId: string | null | undefined, key: MeaningRefKey): string | null {
  return rootNetworkId ? `meaning-${rootNetworkId}-${key}` : null;
}

export function getEdgeMeaningKey(edge: Pick<EdgeWithMeaning, 'meaning' | 'relationship'>): string | null {
  return edge.relationship?.meaning?.key ?? edge.meaning?.key ?? null;
}

function hasSystemEdgeMeaningId(edge: Pick<EdgeWithMeaning, 'meaning_id' | 'relationship'>, key: MeaningRefKey): boolean {
  const meaningId = edge.relationship?.meaning_id ?? edge.meaning_id;
  return typeof meaningId === 'string' && meaningId.endsWith(`-${key}`);
}

export function isContainsEdge(edge: Pick<EdgeWithMeaning, 'meaning' | 'meaning_id' | 'relationship'>): boolean {
  return getEdgeMeaningKey(edge) === CONTAINS_MEANING_KEY || hasSystemEdgeMeaningId(edge, CONTAINS_MEANING_KEY);
}

export function isEntryPortalEdge(edge: Pick<EdgeWithMeaning, 'meaning' | 'meaning_id' | 'relationship'>): boolean {
  return getEdgeMeaningKey(edge) === ENTRY_PORTAL_MEANING_KEY || hasSystemEdgeMeaningId(edge, ENTRY_PORTAL_MEANING_KEY);
}

export function isHierarchyParentEdge(edge: Pick<EdgeWithMeaning, 'meaning' | 'meaning_id' | 'relationship'>): boolean {
  return getEdgeMeaningKey(edge) === HIERARCHY_PARENT_MEANING_KEY || hasSystemEdgeMeaningId(edge, HIERARCHY_PARENT_MEANING_KEY);
}
