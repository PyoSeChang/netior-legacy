import { useState, useCallback, useEffect, useRef } from 'react';
import type { RenderNode } from './types';
import type { WorkspaceMode } from '../../stores/ui-store';
import type { InteractionConstraints, LayoutViewportMode } from './layout-plugins/types';
import type { MentionResult } from '../../services/narre-service';
import {
  dispatchNarreMentionDrop,
  NARRE_MENTION_DROP_TARGET_SELECTOR,
} from '../../hooks/useNarreMentionDrag';

interface UseInteractionParams {
  containerRef: React.RefObject<HTMLDivElement>;
  nodes: RenderNode[];
  zoom: number;
  panX: number;
  panY: number;
  viewportMode: LayoutViewportMode;
  mode: WorkspaceMode;
  constraints: InteractionConstraints;
  onPanChange: (panX: number, panY: number) => void;
  onNodeDragEnd: (nodeId: string, x: number, y: number) => Promise<void>;
  onSpanResizeEnd?: (nodeId: string, edge: 'start' | 'end', dx: number) => Promise<void>;
  onSelectionBox: (nodeIds: string[]) => void;
  onWorkspaceClick: () => void;
  onWheel: (e: WheelEvent) => void;
}

export interface MentionDragPreview {
  x: number;
  y: number;
  mention: MentionResult;
}

const MENTION_DRAG_HOLD_MS = 2000;
const MENTION_DRAG_PRE_HOLD_LOG_MS = 250;

type DragState =
  | { type: 'none' }
  | { type: 'pan'; startX: number; startY: number; originPanX: number; originPanY: number }
  | {
      type: 'mention-drag';
      nodeId: string;
      startX: number;
      startY: number;
      mention: MentionResult;
      active: boolean;
      holdTimer: number;
      holdStartedAt: number;
    }
  | {
      type: 'node';
      nodeId: string;
      startX: number;
      startY: number;
      nodeStartX: number;
      nodeStartY: number;
    }
  | {
      type: 'span-resize';
      nodeId: string;
      edge: 'start' | 'end';
      startX: number;
      startValue: number;
    }
  | {
      type: 'selection';
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    };

/**
 * useInteraction
 *
 * Handles mouse gestures:
 * - Pan (left-click + drag on workspace)
 * - Node drag (left-click + drag on node, edit mode only)
 * - Span resize (left-click + drag on span handle, edit mode only)
 * - Selection box (Shift + left-click + drag)
 * - Wheel zoom
 */
export function useInteraction({
  containerRef,
  nodes,
  zoom,
  panX,
  panY,
  viewportMode,
  mode,
  constraints,
  onPanChange,
  onNodeDragEnd,
  onSpanResizeEnd,
  onSelectionBox,
  onWorkspaceClick,
  onWheel,
}: UseInteractionParams) {
  const [dragState, setDragState] = useState<DragState>({ type: 'none' });
  const [nodeDragOffset, setNodeDragOffset] = useState<{ id: string; dx: number; dy: number } | null>(
    null,
  );
  const [spanResizeOffset, setSpanResizeOffset] = useState<{ id: string; edge: 'start' | 'end'; dx: number } | null>(
    null,
  );
  const [mentionDragPreview, setMentionDragPreview] = useState<MentionDragPreview | null>(null);
  const mentionDragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const mentionDragHoldTimerRef = useRef<number | null>(null);
  const mentionDragLastPreHoldLogAtRef = useRef(0);

  const toNodeDelta = useCallback((dx: number, dy: number) => {
    if (viewportMode === 'screen') {
      return { dx, dy };
    }
    if (viewportMode === 'timeline') {
      return { dx: dx / zoom, dy };
    }
    return { dx: dx / zoom, dy: dy / zoom };
  }, [viewportMode, zoom]);

  const getNodeScreenPosition = useCallback((node: RenderNode) => {
    if (viewportMode === 'screen') {
      return { x: node.x, y: node.y };
    }
    if (viewportMode === 'timeline') {
      return { x: node.x * zoom + panX, y: node.y + panY };
    }
    return { x: node.x * zoom + panX, y: node.y * zoom + panY };
  }, [panX, panY, viewportMode, zoom]);

  useEffect(() => () => {
    if (mentionDragHoldTimerRef.current != null) {
      window.clearTimeout(mentionDragHoldTimerRef.current);
      mentionDragHoldTimerRef.current = null;
    }
  }, []);

  // --- Workspace mouse down: pan or selection ---
  const handleWorkspaceMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      // Shift+click = selection box
      if (e.shiftKey) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setDragState({
          type: 'selection',
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          currentX: e.clientX - rect.left,
          currentY: e.clientY - rect.top,
        });
      } else {
        setDragState({
          type: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          originPanX: panX,
          originPanY: panY,
        });
      }
    },
    [containerRef, panX, panY],
  );

  // --- Node drag start (called by NodeCard) ---
  const handleNodeDragStart = useCallback(
    (nodeId: string, startX: number, startY: number, narreMention?: MentionResult | null) => {
      if (mode === 'browse') {
        if (narreMention) {
          if (mentionDragHoldTimerRef.current != null) {
            window.clearTimeout(mentionDragHoldTimerRef.current);
          }
          mentionDragPointerRef.current = { x: startX, y: startY };
          mentionDragLastPreHoldLogAtRef.current = 0;
          const holdStartedAt = performance.now();
          const holdTimer = window.setTimeout(() => {
            mentionDragHoldTimerRef.current = null;
            setDragState((previous) => {
              return previous.type === 'mention-drag' && previous.nodeId === nodeId
                ? {
                  ...previous,
                  type: 'mention-drag',
                  nodeId,
                  startX,
                  startY,
                  mention: narreMention,
                  active: true,
                  holdTimer,
                  holdStartedAt,
                }
                : previous;
            });
            const pointer = mentionDragPointerRef.current ?? { x: startX, y: startY };
            setMentionDragPreview({ x: pointer.x, y: pointer.y - 8, mention: narreMention });
          }, MENTION_DRAG_HOLD_MS);
          mentionDragHoldTimerRef.current = holdTimer;

          setDragState({
            type: 'mention-drag',
            nodeId,
            startX,
            startY,
            mention: narreMention,
            active: false,
            holdTimer,
            holdStartedAt,
          });
          return;
        }

        setDragState({
          type: 'pan',
          startX,
          startY,
          originPanX: panX,
          originPanY: panY,
        });
        return;
      }

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      setDragState({
        type: 'node',
        nodeId,
        startX,
        startY,
        nodeStartX: node.x,
        nodeStartY: node.y,
      });
    },
    [nodes, mode, panX, panY],
  );

  // --- Span resize start (called by overlay plugin) ---
  const handleSpanResizeStart = useCallback(
    (nodeId: string, edge: 'start' | 'end', startX: number, startValue: number) => {
      if (mode === 'browse') return;

      setDragState({
        type: 'span-resize',
        nodeId,
        edge,
        startX,
        startValue,
      });
    },
    [mode],
  );

  // --- Global mouse move/up handlers ---
  useEffect(() => {
    if (dragState.type === 'none') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.type === 'pan') {
        const rawDx = e.clientX - dragState.startX;
        const rawDy = e.clientY - dragState.startY;
        const dx = constraints.panAxis === 'y' || constraints.panAxis === 'none' ? 0 : rawDx;
        const dy = constraints.panAxis === 'x' || constraints.panAxis === 'none' ? 0 : rawDy;
        onPanChange(dragState.originPanX + dx, dragState.originPanY + dy);
      } else if (dragState.type === 'node') {
        const rawDx = e.clientX - dragState.startX;
        const rawDy = e.clientY - dragState.startY;
        const dx = constraints.nodeDragAxis === 'y' || constraints.nodeDragAxis === 'none' ? 0 : rawDx;
        const dy = constraints.nodeDragAxis === 'x' || constraints.nodeDragAxis === 'none' ? 0 : rawDy;
        setNodeDragOffset({ id: dragState.nodeId, dx, dy });
      } else if (dragState.type === 'mention-drag') {
        const rawDx = e.clientX - dragState.startX;
        const rawDy = e.clientY - dragState.startY;
        mentionDragPointerRef.current = { x: e.clientX, y: e.clientY };
        if (!dragState.active) {
          const now = performance.now();
          const elapsedMs = now - dragState.holdStartedAt;
          if (elapsedMs >= MENTION_DRAG_HOLD_MS) {
            window.clearTimeout(dragState.holdTimer);
            if (mentionDragHoldTimerRef.current === dragState.holdTimer) {
              mentionDragHoldTimerRef.current = null;
            }
            setDragState({
              ...dragState,
              active: true,
            });
            setNodeDragOffset({ id: dragState.nodeId, dx: rawDx, dy: rawDy });
            setMentionDragPreview({ x: e.clientX, y: e.clientY - 8, mention: dragState.mention });
            return;
          }

          if ((Math.abs(rawDx) > 2 || Math.abs(rawDy) > 2) && now - mentionDragLastPreHoldLogAtRef.current >= MENTION_DRAG_PRE_HOLD_LOG_MS) {
            mentionDragLastPreHoldLogAtRef.current = now;
          }
          return;
        }
        setNodeDragOffset({ id: dragState.nodeId, dx: rawDx, dy: rawDy });
        setMentionDragPreview({ x: e.clientX, y: e.clientY - 8, mention: dragState.mention });
      } else if (dragState.type === 'span-resize') {
        const dx = e.clientX - dragState.startX;
        setSpanResizeOffset({ id: dragState.nodeId, edge: dragState.edge, dx });
      } else if (dragState.type === 'selection') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setDragState((prev) =>
          prev.type === 'selection'
            ? {
                ...prev,
                currentX: e.clientX - rect.left,
                currentY: e.clientY - rect.top,
              }
            : prev,
        );
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragState.type === 'node') {
        const rawDx = e.clientX - dragState.startX;
        const rawDy = e.clientY - dragState.startY;
        const dx = constraints.nodeDragAxis === 'y' || constraints.nodeDragAxis === 'none' ? 0 : rawDx;
        const dy = constraints.nodeDragAxis === 'x' || constraints.nodeDragAxis === 'none' ? 0 : rawDy;

        setNodeDragOffset(null);
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          const nodeDelta = toNodeDelta(dx, dy);
          const newX = dragState.nodeStartX + nodeDelta.dx;
          const newY = dragState.nodeStartY + nodeDelta.dy;
          onNodeDragEnd(dragState.nodeId, Math.round(newX), Math.round(newY));
        }
      } else if (dragState.type === 'mention-drag') {
        window.clearTimeout(dragState.holdTimer);
        if (mentionDragHoldTimerRef.current === dragState.holdTimer) {
          mentionDragHoldTimerRef.current = null;
        }
        const elapsedMs = performance.now() - dragState.holdStartedAt;
        const isHoldComplete = dragState.active || elapsedMs >= MENTION_DRAG_HOLD_MS;
        if (!isHoldComplete) {
          setNodeDragOffset(null);
          setMentionDragPreview(null);
          mentionDragPointerRef.current = null;
          setDragState({ type: 'none' });
          return;
        }
        const dropTarget = document.elementsFromPoint(e.clientX, e.clientY)
          .find((element) => element.matches(NARRE_MENTION_DROP_TARGET_SELECTOR));
        if (dropTarget) {
          dispatchNarreMentionDrop(dropTarget, {
            mention: dragState.mention,
            clientX: e.clientX,
            clientY: e.clientY,
          });
        }
        setNodeDragOffset(null);
        setMentionDragPreview(null);
        mentionDragPointerRef.current = null;
      } else if (dragState.type === 'span-resize') {
        const dx = e.clientX - dragState.startX;

        if (Math.abs(dx) > 2 && onSpanResizeEnd) {
          onSpanResizeEnd(dragState.nodeId, dragState.edge, dx).then(() =>
            setSpanResizeOffset(null),
          );
        } else {
          setSpanResizeOffset(null);
        }
      } else if (dragState.type === 'selection') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const minX = Math.min(dragState.startX, dragState.currentX);
          const maxX = Math.max(dragState.startX, dragState.currentX);
          const minY = Math.min(dragState.startY, dragState.currentY);
          const maxY = Math.max(dragState.startY, dragState.currentY);

          const selected = nodes.filter((node) => {
            const { x: screenX, y: screenY } = getNodeScreenPosition(node);
            return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
          });

          if (selected.length > 0) {
            onSelectionBox(selected.map((n) => n.id));
          }
        }
      } else if (dragState.type === 'pan') {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          onWorkspaceClick();
        }
      }

      setDragState({ type: 'none' });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragState,
    zoom,
    panX,
    panY,
    viewportMode,
    nodes,
    constraints,
    containerRef,
    onPanChange,
    onNodeDragEnd,
    onSpanResizeEnd,
    onSelectionBox,
    onWorkspaceClick,
    toNodeDelta,
    getNodeScreenPosition,
  ]);

  // --- Wheel zoom ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, onWheel]);

  return {
    dragState,
    nodeDragOffset,
    spanResizeOffset,
    mentionDragPreview,
    handleWorkspaceMouseDown,
    handleNodeDragStart,
    handleSpanResizeStart,
  };
}

