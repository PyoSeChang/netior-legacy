import React from 'react';
import { CalendarDays } from 'lucide-react';
import type {
  WorkspaceLayoutPlugin,
  LayoutRenderNode,
  NodeDropContext,
  NodeDropResult,
  SpanResizeContext,
  SpanResizeResult,
} from '../types';
import { TimelineBackground } from '../horizontal-timeline/TimelineBackground';
import { TimelineOverlay } from '../horizontal-timeline/TimelineOverlay';
import { computeTimelineLayout } from '../horizontal-timeline/timeline-layout';
import { PIXELS_PER_DAY, todayEpochDays } from '../time-axis/scale-utils';
import {
  formatTemporalSlotValueForWriteback,
  worldRecurringTemporalNodes,
} from '../temporal-utils';

export const ganttPlugin: WorkspaceLayoutPlugin = {
  key: 'gantt',
  displayName: 'Gantt Chart',
  semanticDiscovery: [
    {
      key: 'gantt-time-fields',
      expression: {
        op: 'discover.schemas',
        requires: [{ fieldMeaning: 'time.start' }],
        optional: [{ fieldMeaning: 'time.end' }],
      },
    },
  ],

  configModel: [],

  getDefaultConfig() {
    return {
      _originDay: todayEpochDays(),
    };
  },

  interactionConstraints: {
    panAxis: 'x',
    nodeDragAxis: null,
    enableSpanResize: true,
  },
  viewportMode: 'timeline',
  wheelBehavior: 'timeline',
  persistViewport: false,
  getViewportReset({ viewport }) {
    return {
      zoom: 1,
      panX: viewport.width / 2,
      panY: 0,
    };
  },

  computeLayout: computeTimelineLayout,

  worldNodes({ nodes, viewport, viewportState, config }) {
    const originDay = (config._originDay as number) ?? todayEpochDays();
    const pxPerDay = Math.max(PIXELS_PER_DAY * viewportState.zoom, 0.0001);
    const rangeStart = Math.floor(originDay + (-viewportState.panX) / pxPerDay) - 2;
    const rangeEnd = Math.ceil(originDay + (viewport.width - viewportState.panX) / pxPerDay) + 2;
    return worldRecurringTemporalNodes(nodes, rangeStart, rangeEnd);
  },

  classifyNodes(nodes: LayoutRenderNode[]) {
    const cardNodes: LayoutRenderNode[] = [];
    const overlayNodes: LayoutRenderNode[] = [];

    for (const node of nodes) {
      const timeValue = node.metadata.start_at as number | undefined;
      const endTimeValue = node.metadata.end_at as number | undefined;

      if (timeValue == null) continue;

      if (endTimeValue != null) {
        overlayNodes.push(node);
      } else {
        cardNodes.push(node);
      }
    }

    return { cardNodes, overlayNodes };
  },

  BackgroundComponent: TimelineBackground,
  OverlayComponent: TimelineOverlay,

  hiddenControls: ['zoom', 'fit', 'nav'],

  controlItems: [
    {
      key: 'go-to-today',
      icon: React.createElement(CalendarDays, { size: 14 }),
      label: 'Go to Today',
      onClick: ({ setZoom, setPanX, setPanY }) => {
        setZoom(1);
        setPanX(window.innerWidth / 2);
        setPanY(0);
      },
    },
  ],

  onNodeDrop(context: NodeDropContext): NodeDropResult {
    const { newX, newY, node, config, zoom } = context;
    const originDay = (config._originDay as number) ?? todayEpochDays();
    const correctedY = node.y + (newY - node.y) * zoom;
    const epochDay = Math.round(originDay + newX / PIXELS_PER_DAY);

    const slotFieldIds = node.metadata.__slotFieldIds as Record<string, string> | undefined;
    const startFieldId = slotFieldIds?.start_at;
    const allDayFieldId = slotFieldIds?.all_day;
    const propertyUpdates: Array<{ instanceId: string; fieldId: string; value: string }> = [];

    if (startFieldId && node.instanceId) {
      propertyUpdates.push({
        instanceId: node.instanceId,
        fieldId: startFieldId,
        value: formatTemporalSlotValue(node, 'start_at', epochDay),
      });
    }
    if (allDayFieldId && node.instanceId) {
      propertyUpdates.push({
        instanceId: node.instanceId,
        fieldId: allDayFieldId,
        value: String(node.metadata.all_day === true),
      });
    }

    return {
      position: { x: Math.round(newX), y: Math.round(correctedY) },
      propertyUpdates: propertyUpdates.length > 0 ? propertyUpdates : undefined,
    };
  },

  onSpanResize(context: SpanResizeContext): SpanResizeResult {
    const { dx, edge, node, zoom } = context;
    const slotFieldIds = node.metadata.__slotFieldIds as Record<string, string> | undefined;
    const propertyUpdates: Array<{ instanceId: string; fieldId: string; value: string }> = [];
    if (!node.instanceId || !slotFieldIds) return {};

    const pxPerDay = PIXELS_PER_DAY * zoom;
    if (pxPerDay === 0) return {};

    const deltaDays = Math.round(dx / pxPerDay);
    const startDay = node.metadata.start_at as number | undefined;
    const endDay = node.metadata.end_at as number | undefined;
    if (startDay == null || endDay == null) return {};

    if (edge === 'start' && slotFieldIds.start_at) {
      const nextStartDay = Math.min(startDay + deltaDays, endDay);
      propertyUpdates.push({
        instanceId: node.instanceId,
        fieldId: slotFieldIds.start_at,
        value: formatTemporalSlotValue(node, 'start_at', nextStartDay),
      });
    }

    if (edge === 'end' && slotFieldIds.end_at) {
      const nextEndDay = Math.max(endDay + deltaDays, startDay);
      propertyUpdates.push({
        instanceId: node.instanceId,
        fieldId: slotFieldIds.end_at,
        value: formatTemporalSlotValue(node, 'end_at', nextEndDay),
      });
    }

    return {
      propertyUpdates: propertyUpdates.length > 0 ? propertyUpdates : undefined,
    };
  },
};

function formatTemporalSlotValue(
  node: LayoutRenderNode,
  slot: 'start_at' | 'end_at',
  epochDay: number,
): string {
  const hasTime = node.metadata[`${slot}_has_time`] === true;
  const minutes = typeof node.metadata[`${slot}_minutes`] === 'number'
    ? Number(node.metadata[`${slot}_minutes`])
    : undefined;
  return formatTemporalSlotValueForWriteback(node, slot, epochDay, hasTime ? minutes : undefined, !hasTime);
}
