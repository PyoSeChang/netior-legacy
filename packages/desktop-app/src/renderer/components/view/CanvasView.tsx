import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Database, File, GitBranch, Layers, Link2, Package, Tag } from 'lucide-react';
import type { CanvasEdgeTypeRecord, CanvasNodeTypeRecord, DomainSnapshot, ViewItemRecord } from '@netior/shared';
import { useCanvasViewStore } from '../../stores/canvas-view-store';
import type { DomainModelSummary, DomainViewSummary } from '../../stores/domain-store';
import { domainService, type ViewProjection } from '../../services/domain-service';

interface CanvasViewProps {
  models: DomainModelSummary[];
  views: DomainViewSummary[];
  activeModelId: string | null;
  snapshot: DomainSnapshot | null;
}

interface CanvasLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasNodeProjection {
  item: ViewItemRecord;
  nodeType: CanvasNodeTypeRecord | null;
  label: string;
  detail: string;
  layout: CanvasLayout;
  rendererKey: string;
}

interface CanvasEdgeProjection {
  item: ViewItemRecord;
  edgeType: CanvasEdgeTypeRecord | null;
  source: CanvasNodeProjection;
  target: CanvasNodeProjection;
  label: string | null;
  directed: boolean;
}

const DEFAULT_NODE_WIDTH = 168;
const DEFAULT_NODE_HEIGHT = 68;

function readJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function layoutFromItem(item: ViewItemRecord, index: number): CanvasLayout {
  const layout = readJsonObject(item.layout_json);
  const defaultSize = readJsonObject(item.overrides_json);
  return {
    x: numberValue(layout.x, 72 + (index % 4) * 210),
    y: numberValue(layout.y, 72 + Math.floor(index / 4) * 130),
    width: numberValue(layout.width, numberValue(defaultSize.width, DEFAULT_NODE_WIDTH)),
    height: numberValue(layout.height, numberValue(defaultSize.height, DEFAULT_NODE_HEIGHT)),
  };
}

function defaultSizeFromNodeType(nodeType: CanvasNodeTypeRecord | null): Partial<CanvasLayout> {
  if (!nodeType) return {};
  const size = readJsonObject(nodeType.default_size_json);
  return {
    width: numberValue(size.width, DEFAULT_NODE_WIDTH),
    height: numberValue(size.height, DEFAULT_NODE_HEIGHT),
  };
}

function getSubjectLabel(snapshot: DomainSnapshot | null, item: ViewItemRecord): { label: string; detail: string } {
  const subjectId = item.subject_id;
  if (!snapshot || !subjectId) {
    return { label: item.subject_type, detail: item.subject_type };
  }

  const worldNode = snapshot.worldNodes.find((record) => record.id === subjectId);
  if (worldNode) return { label: worldNode.name, detail: worldNode.node_type };

  const kind = snapshot.kinds.find((record) => record.id === subjectId);
  if (kind) return { label: kind.name, detail: 'kind' };

  const property = snapshot.properties.find((record) => record.id === subjectId);
  if (property) return { label: property.name, detail: 'property' };

  const relationKind = snapshot.relationKinds.find((record) => record.id === subjectId);
  if (relationKind) return { label: relationKind.name, detail: 'relation kind' };

  const instance = snapshot.instances.find((record) => record.id === subjectId);
  if (instance) return { label: instance.display_name, detail: 'instance' };

  const resource = snapshot.resources.find((record) => record.id === subjectId);
  if (resource) {
    return {
      label: stringValue(resource.relative_path) ?? stringValue(resource.source_uri) ?? 'Resource',
      detail: resource.source_kind,
    };
  }

  return { label: subjectId, detail: item.subject_type };
}

function getSubjectIcon(subjectType: string): typeof Database {
  if (subjectType === 'model' || subjectType === 'world') return Database;
  if (subjectType === 'kind') return Package;
  if (subjectType === 'relation_kind' || subjectType === 'relation_assertion') return GitBranch;
  if (subjectType === 'instance') return Box;
  if (subjectType === 'resource') return File;
  if (subjectType === 'kind_assignment') return Tag;
  if (subjectType === 'resource_mapping') return Link2;
  return Layers;
}

function getFallbackRendererKey(subjectType: string): string {
  if (subjectType === 'resource') return 'netior.resource_tile';
  if (subjectType === 'relation_kind') return 'netior.relation_kind_card';
  if (subjectType === 'kind') return 'netior.kind_card';
  if (subjectType === 'note') return 'netior.note';
  return 'netior.instance_card';
}

function getNodeType(snapshot: DomainSnapshot | null, item: ViewItemRecord): CanvasNodeTypeRecord | null {
  if (!snapshot || !item.type_id) return null;
  return snapshot.canvasNodeTypes.find((type) => type.id === item.type_id) ?? null;
}

function getEdgeType(snapshot: DomainSnapshot | null, item: ViewItemRecord): CanvasEdgeTypeRecord | null {
  if (!snapshot || !item.type_id) return null;
  return snapshot.canvasEdgeTypes.find((type) => type.id === item.type_id) ?? null;
}

function getNodeCenter(node: CanvasNodeProjection): { x: number; y: number } {
  return {
    x: node.layout.x + node.layout.width / 2,
    y: node.layout.y + node.layout.height / 2,
  };
}

function findNodeBySubject(nodes: CanvasNodeProjection[], subjectType: string, subjectId: string | null): CanvasNodeProjection | null {
  if (!subjectId) return null;
  return nodes.find((node) => node.item.subject_type === subjectType && node.item.subject_id === subjectId) ?? null;
}

function resolveEdgeEndpoints(
  snapshot: DomainSnapshot | null,
  item: ViewItemRecord,
  nodes: CanvasNodeProjection[],
): { source: CanvasNodeProjection; target: CanvasNodeProjection; label: string | null; directed: boolean } | null {
  if (!snapshot || !item.subject_id) return null;

  if (item.subject_type === 'relation_assertion') {
    const relation = snapshot.relations.find((record) => record.id === item.subject_id);
    if (!relation) return null;
    const source = findNodeBySubject(nodes, 'instance', relation.subject_instance_id);
    const target = findNodeBySubject(nodes, 'instance', relation.object_instance_id);
    const relationKind = snapshot.relationKinds.find((record) => record.id === relation.relation_kind_id);
    if (!source || !target) return null;
    return {
      source,
      target,
      label: relationKind?.name ?? null,
      directed: relationKind?.directed === 1,
    };
  }

  if (item.subject_type === 'kind_assignment') {
    const assignment = snapshot.kindAssignments.find((record) => record.id === item.subject_id);
    if (!assignment) return null;
    const source = findNodeBySubject(nodes, 'instance', assignment.instance_id);
    const target = findNodeBySubject(nodes, 'kind', assignment.kind_id);
    if (!source || !target) return null;
    return { source, target, label: 'kind', directed: true };
  }

  if (item.subject_type === 'resource_mapping') {
    const link = snapshot.instanceResourceLinks.find((record) => record.id === item.subject_id);
    if (!link) return null;
    const source = findNodeBySubject(nodes, 'instance', link.instance_id);
    const target = findNodeBySubject(nodes, 'resource', link.resource_id);
    if (!source || !target) return null;
    return { source, target, label: 'resource', directed: false };
  }

  if (item.subject_type === 'model_parent') {
    const model = snapshot.worldNodes.find((record) => record.id === item.subject_id);
    if (!model || !model.parent_id) return null;
    const source = findNodeBySubject(nodes, 'model', model.parent_id);
    const target = findNodeBySubject(nodes, 'model', model.id);
    if (!source || !target) return null;
    return { source, target, label: 'contains', directed: true };
  }

  return null;
}

function getCanvasView(views: DomainViewSummary[], activeModelId: string | null): DomainViewSummary | null {
  const activeModelViews = activeModelId ? views.filter((view) => view.modelId === activeModelId) : [];
  return activeModelViews.find((view) => view.viewType === 'canvas') ?? views.find((view) => view.viewType === 'canvas') ?? null;
}

export function CanvasView({ models, views, activeModelId, snapshot }: CanvasViewProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    type: 'pan' | 'node';
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startViewportX: number;
    startViewportY: number;
    itemId?: string;
    startNodeX?: number;
    startNodeY?: number;
  } | null>(null);
  const {
    mode,
    viewport,
    selectedItemIds,
    fitRequestId,
    setViewport,
    setSelectedItemIds,
    clearSelection,
  } = useCanvasViewStore();
  const [projection, setProjection] = useState<ViewProjection | null>(null);
  const [layoutOverrides, setLayoutOverrides] = useState<Record<string, CanvasLayout>>({});

  const activeModel = models.find((model) => model.id === activeModelId) ?? models[0] ?? null;
  const canvasView = getCanvasView(views, activeModel?.id ?? activeModelId);
  const viewId = canvasView?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setLayoutOverrides({});
    setProjection(null);
    clearSelection();

    if (!viewId) return undefined;
    void domainService.projectView(viewId)
      .then((nextProjection) => {
        if (!cancelled) setProjection(nextProjection);
      })
      .catch(() => {
        if (!cancelled) setProjection(null);
      });

    return () => {
      cancelled = true;
    };
  }, [clearSelection, viewId]);

  const rawItems = projection?.items ?? snapshot?.viewItems?.filter((item) => item.view_id === viewId) ?? [];
  const nodes = useMemo<CanvasNodeProjection[]>(() => rawItems
    .filter((item) => item.item_kind === 'node')
    .filter((item) => readJsonObject(item.state_json).hidden !== true)
    .map((item, index) => {
      const subject = getSubjectLabel(snapshot, item);
      const nodeType = getNodeType(snapshot, item);
      const defaultSize = defaultSizeFromNodeType(nodeType);
      const baseLayout = layoutFromItem({
        ...item,
        overrides_json: JSON.stringify(defaultSize),
      }, index);
      return {
        item,
        nodeType,
        ...subject,
        layout: layoutOverrides[item.id] ?? baseLayout,
        rendererKey: nodeType?.renderer_key ?? getFallbackRendererKey(item.subject_type),
      };
    }), [layoutOverrides, rawItems, snapshot]);

  const edges = useMemo<CanvasEdgeProjection[]>(() => rawItems
    .filter((item) => item.item_kind === 'edge')
    .filter((item) => readJsonObject(item.state_json).hidden !== true)
    .map((item) => {
      const endpoints = resolveEdgeEndpoints(snapshot, item, nodes);
      if (!endpoints) return null;
      return {
        item,
        edgeType: getEdgeType(snapshot, item),
        ...endpoints,
      };
    })
    .filter((item): item is CanvasEdgeProjection => item != null), [nodes, rawItems, snapshot]);

  const fitToNodes = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface || nodes.length === 0) return;

    const bounds = nodes.reduce(
      (acc, node) => ({
        minX: Math.min(acc.minX, node.layout.x),
        minY: Math.min(acc.minY, node.layout.y),
        maxX: Math.max(acc.maxX, node.layout.x + node.layout.width),
        maxY: Math.max(acc.maxY, node.layout.y + node.layout.height),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    const rect = surface.getBoundingClientRect();
    const padding = 96;
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const nextZoom = Math.min(1.6, Math.max(0.25, Math.min(
      (rect.width - padding) / contentWidth,
      (rect.height - padding) / contentHeight,
    )));

    setViewport({
      zoom: nextZoom,
      x: rect.width / 2 - ((bounds.minX + contentWidth / 2) * nextZoom),
      y: rect.height / 2 - ((bounds.minY + contentHeight / 2) * nextZoom),
    });
  }, [nodes, setViewport]);

  useEffect(() => {
    if (fitRequestId > 0) fitToNodes();
  }, [fitRequestId, fitToNodes]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();

    if (event.ctrlKey || event.metaKey) {
      const nextZoom = Math.max(0.2, Math.min(3, viewport.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const worldX = (pointerX - viewport.x) / viewport.zoom;
      const worldY = (pointerY - viewport.y) / viewport.zoom;
      setViewport({
        zoom: nextZoom,
        x: pointerX - worldX * nextZoom,
        y: pointerY - worldY * nextZoom,
      });
      return;
    }

    setViewport({
      x: viewport.x - event.deltaX,
      y: viewport.y - event.deltaY,
    });
  }, [setViewport, viewport]);

  const handleSurfacePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    clearSelection();
    dragRef.current = {
      type: 'pan',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewportX: viewport.x,
      startViewportY: viewport.y,
    };
  }, [clearSelection, viewport]);

  const handleNodePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, node: CanvasNodeProjection) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedItemIds([node.item.id]);

    if (mode !== 'edit') return;
    dragRef.current = {
      type: 'node',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewportX: viewport.x,
      startViewportY: viewport.y,
      itemId: node.item.id,
      startNodeX: node.layout.x,
      startNodeY: node.layout.y,
    };
  }, [mode, setSelectedItemIds, viewport]);

  const persistNodeLayout = useCallback((itemId: string, layout: CanvasLayout) => {
    if (!viewId) return;
    void domainService.saveViewLayout(viewId, [{
      id: itemId,
      layout_json: JSON.stringify(layout),
    }]).catch(() => {
      // Layout remains local if the service rejects persistence.
    });
  }, [viewId]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.type === 'pan') {
      setViewport({
        x: drag.startViewportX + event.clientX - drag.startClientX,
        y: drag.startViewportY + event.clientY - drag.startClientY,
      });
      return;
    }

    if (drag.type === 'node' && drag.itemId && drag.startNodeX != null && drag.startNodeY != null) {
      const dx = (event.clientX - drag.startClientX) / viewport.zoom;
      const dy = (event.clientY - drag.startClientY) / viewport.zoom;
      const currentNode = nodes.find((node) => node.item.id === drag.itemId);
      const nextLayout = {
        ...(currentNode?.layout ?? { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT }),
        x: drag.startNodeX + dx,
        y: drag.startNodeY + dy,
      };
      setLayoutOverrides((current) => ({ ...current, [drag.itemId as string]: nextLayout }));
    }
  }, [nodes, setViewport, viewport.zoom]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    if (drag.type === 'node' && drag.itemId) {
      const layout = layoutOverrides[drag.itemId];
      if (layout) persistNodeLayout(drag.itemId, layout);
    }
  }, [layoutOverrides, persistNodeLayout]);

  return (
    <div
      ref={surfaceRef}
      className="relative h-full min-h-0 overflow-hidden bg-surface-canvas"
      style={{
        backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
        backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        cursor: dragRef.current?.type === 'pan' ? 'grabbing' : 'grab',
      }}
      onPointerDown={handleSurfacePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
          <defs>
            <marker id="canvas-edge-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M1 1 L7 4 L1 7 Z" className="fill-border-strong" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const source = getNodeCenter(edge.source);
            const target = getNodeCenter(edge.target);
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            const strokeDasharray = edge.edgeType?.renderer_key === 'netior.dashed_edge' ? '6 6' : undefined;

            return (
              <g key={edge.item.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className="stroke-border-strong"
                  strokeWidth={1.5}
                  strokeDasharray={strokeDasharray}
                  markerEnd={edge.directed ? 'url(#canvas-edge-arrow)' : undefined}
                />
                {edge.label && (
                  <foreignObject x={midX - 48} y={midY - 12} width={96} height={24}>
                    <div className="flex h-6 items-center justify-center">
                      <span className="max-w-24 truncate rounded border border-subtle bg-surface-panel px-1.5 py-0.5 text-[10px] text-secondary shadow-sm">
                        {edge.label}
                      </span>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
        {nodes.map((node) => {
          const Icon = getSubjectIcon(node.item.subject_type);
          const selected = selectedItemIds.includes(node.item.id);
          const compact = node.rendererKey === 'netior.compact' || node.rendererKey === 'netior.badge';
          const note = node.rendererKey === 'netior.note';

          return (
            <div
              key={node.item.id}
              className={`absolute flex items-center gap-2 rounded-md border shadow-sm ${
                selected ? 'border-accent bg-accent-muted text-accent' : 'border-subtle bg-surface-panel text-default'
              } ${mode === 'edit' ? 'cursor-move' : 'cursor-pointer'} ${compact ? 'px-2' : 'px-3'} ${note ? 'items-start py-2' : ''}`}
              style={{
                left: node.layout.x,
                top: node.layout.y,
                width: node.layout.width,
                height: node.layout.height,
              }}
              onPointerDown={(event) => handleNodePointerDown(event, node)}
            >
              {!compact && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-editor text-secondary">
                  <Icon size={16} />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-default">{node.label}</div>
                {!compact && <div className="text-[11px] text-muted">{node.nodeType?.name ?? node.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted">
          {canvasView ? 'Empty canvas' : 'No canvas view'}
        </div>
      )}
    </div>
  );
}
