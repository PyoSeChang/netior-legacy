import { describe, expect, it } from 'vitest';

import {
  buildResolvedLayoutGraph,
  getPlacedObjectRefs,
} from '../components/workspace/layout-resolution';
import type { LayoutRenderNode } from '../components/workspace/layout-plugins/types';

function node(id: string, objectTargetId: string): LayoutRenderNode {
  return {
    id,
    x: 0,
    y: 0,
    label: id,
    icon: 'circle',
    semanticType: 'instance',
    semanticTypeLabel: 'Instance',
    nodeType: 'instance',
    objectType: 'instance',
    objectTargetId,
    metadata: {},
  };
}

describe('layout-resolution', () => {
  it('treats placed network nodes as the default scoped objects', () => {
    const graph = buildResolvedLayoutGraph({
      nodes: [node('node-1', 'instance-1'), node('node-2', 'instance-2')],
      edges: [],
    });

    expect(graph.scopedObjects.map((object) => object.key)).toEqual([
      'instance:instance-1',
      'instance:instance-2',
    ]);
    expect(graph.placements.map((placement) => placement.nodeId)).toEqual(['node-1', 'node-2']);
    expect(graph.unplacedScopedObjects).toEqual([]);
    expect(graph.renderNodes).toHaveLength(2);
  });

  it('separates unplaced scoped objects from placed objects', () => {
    const graph = buildResolvedLayoutGraph({
      nodes: [node('node-1', 'instance-1')],
      edges: [],
      scopedObjects: [
        { objectType: 'instance', refId: 'instance-1' },
        { objectType: 'instance', refId: 'instance-2' },
      ],
      visibility: 'suggest-missing',
    });

    expect(graph.placements).toHaveLength(1);
    expect(graph.unplacedScopedObjects.map((object) => object.key)).toEqual(['instance:instance-2']);
    expect(graph.candidateObjects.map((object) => object.key)).toEqual(['instance:instance-2']);
    expect(graph.diagnostics).toEqual([
      {
        code: 'unplaced_scoped_object',
        objectKey: 'instance:instance-2',
        message: 'Scoped object has no placement in this network.',
      },
    ]);
  });

  it('deduplicates placed object refs', () => {
    expect(getPlacedObjectRefs([
      node('node-1', 'instance-1'),
      node('node-2', 'instance-1'),
    ])).toEqual([
      { objectType: 'instance', refId: 'instance-1', key: 'instance:instance-1' },
    ]);
  });
});

