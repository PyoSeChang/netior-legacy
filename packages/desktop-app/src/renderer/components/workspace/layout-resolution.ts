import type { NetiorDslObjectRef } from '@netior/shared/dsl';
import type { RenderEdge } from './types';
import type { LayoutRenderNode } from './layout-plugins/types';

export type ScopedObjectVisibility =
  | 'materialized-only'
  | 'suggest-missing'
  | 'show-scoped'
  | 'auto-materialize';

export interface ResolvedScopedObject extends NetiorDslObjectRef {
  key: string;
}

export interface ResolvedPlacement {
  nodeId: string;
  objectKey: string;
  object: ResolvedScopedObject;
}

export interface ResolvedLayoutDiagnostic {
  code: 'unplaced_scoped_object' | 'auto_materialize_not_supported';
  objectKey?: string;
  message: string;
}

export interface ResolvedLayoutGraph {
  scopedObjects: ResolvedScopedObject[];
  placements: ResolvedPlacement[];
  unplacedScopedObjects: ResolvedScopedObject[];
  candidateObjects: ResolvedScopedObject[];
  renderNodes: LayoutRenderNode[];
  renderEdges: RenderEdge[];
  diagnostics: ResolvedLayoutDiagnostic[];
}

export interface BuildResolvedLayoutGraphInput {
  nodes: LayoutRenderNode[];
  edges: RenderEdge[];
  scopedObjects?: NetiorDslObjectRef[];
  visibility?: ScopedObjectVisibility;
}

export function objectRefKey(object: Pick<NetiorDslObjectRef, 'objectType' | 'refId'>): string {
  return `${object.objectType}:${object.refId}`;
}

export function getPlacedObjectRefs(nodes: readonly LayoutRenderNode[]): ResolvedScopedObject[] {
  const placed = new Map<string, ResolvedScopedObject>();
  for (const node of nodes) {
    if (!node.objectType || !node.objectTargetId) continue;
    const object = {
      objectType: node.objectType as NetiorDslObjectRef['objectType'],
      refId: node.objectTargetId,
      key: `${node.objectType}:${node.objectTargetId}`,
    };
    placed.set(object.key, object);
  }
  return [...placed.values()];
}

export function buildResolvedLayoutGraph({
  nodes,
  edges,
  scopedObjects,
  visibility = 'materialized-only',
}: BuildResolvedLayoutGraphInput): ResolvedLayoutGraph {
  const normalizedScopedObjects = normalizeScopedObjects(scopedObjects ?? getPlacedObjectRefs(nodes));
  const scopedByKey = new Map(normalizedScopedObjects.map((object) => [object.key, object]));
  const placements: ResolvedPlacement[] = [];
  const placedKeys = new Set<string>();

  for (const node of nodes) {
    if (!node.objectType || !node.objectTargetId) continue;
    const key = `${node.objectType}:${node.objectTargetId}`;
    const object = scopedByKey.get(key) ?? {
      objectType: node.objectType as NetiorDslObjectRef['objectType'],
      refId: node.objectTargetId,
      key,
    };
    placements.push({ nodeId: node.id, objectKey: key, object });
    placedKeys.add(key);
  }

  const unplacedScopedObjects = normalizedScopedObjects.filter((object) => !placedKeys.has(object.key));
  const candidateObjects = visibility === 'suggest-missing' ? unplacedScopedObjects : [];
  const diagnostics: ResolvedLayoutDiagnostic[] = unplacedScopedObjects.map((object) => ({
    code: 'unplaced_scoped_object',
    objectKey: object.key,
    message: 'Scoped object has no placement in this network.',
  }));

  if (visibility === 'auto-materialize') {
    diagnostics.push({
      code: 'auto_materialize_not_supported',
      message: 'Automatic network node materialization is intentionally disabled in the MVP.',
    });
  }

  return {
    scopedObjects: normalizedScopedObjects,
    placements,
    unplacedScopedObjects,
    candidateObjects,
    renderNodes: nodes,
    renderEdges: edges,
    diagnostics,
  };
}

function normalizeScopedObjects(objects: readonly NetiorDslObjectRef[]): ResolvedScopedObject[] {
  const byKey = new Map<string, ResolvedScopedObject>();
  for (const object of objects) {
    const key = objectRefKey(object);
    byKey.set(key, { ...object, key });
  }
  return [...byKey.values()];
}

