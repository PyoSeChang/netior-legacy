import React from 'react';
import { CalendarDays } from 'lucide-react';
import type {
  LayoutRenderNode,
  NodeDropContext,
  NodeDropResult,
  WorkspaceLayoutPlugin,
} from '../types';
import { TimelineBackground } from './TimelineBackground';
import { TimelineOverlay } from './TimelineOverlay';
import { computeTimelineLayout } from './timeline-layout';
import { PIXELS_PER_DAY, todayEpochDays } from '../time-axis/scale-utils';
import {
  formatTemporalSlotValueForWriteback,
  projectRecurringTemporalNodes,
} from '../temporal-utils';

interface ResolvedTimelineBounds {
  startAbsDay: number;
  endAbsDay: number;
  isSpan: boolean;
  startHasTime: boolean;
  endHasTime: boolean;
  allDay: boolean;
}

function getAbsoluteDay(epochDay: number | undefined, minutesOfDay: number | undefined): number | null {
  if (typeof epochDay !== 'number') return null;
  if (typeof minutesOfDay !== 'number') return epochDay;
  return epochDay + minutesOfDay / 1440;
}

function splitAbsoluteDay(value: number, withTime: boolean): { epochDay: number; minutesOfDay?: number } {
  if (!withTime) {
    return { epochDay: Math.round(value) };
  }

  const snappedMinutes = Math.round(value * 96) * 15;
  const epochDay = Math.floor(snappedMinutes / 1440);
  const minutesOfDay = ((snappedMinutes % 1440) + 1440) % 1440;
  return { epochDay, minutesOfDay };
}

function resolveTimelineBounds(node: LayoutRenderNode): ResolvedTimelineBounds | null {
  const startHasTime = node.metadata.start_at_has_time === true;
  const endHasTime = node.metadata.end_at_has_time === true;
  const allDay = node.metadata.all_day === true;
  const startAbsDay = getAbsoluteDay(
    node.metadata.start_at as number | undefined,
    startHasTime ? node.metadata.start_at_minutes as number | undefined : undefined,
  );
  if (startAbsDay == null) return null;

  const endEpochDay = node.metadata.end_at as number | undefined;
  if (typeof endEpochDay !== 'number') {
    return {
      startAbsDay,
      endAbsDay: startAbsDay,
      isSpan: false,
      startHasTime,
      endHasTime,
      allDay,
    };
  }

  const isTimed = !allDay && (startHasTime || endHasTime);
  let endAbsDay = getAbsoluteDay(
    endEpochDay,
    endHasTime ? node.metadata.end_at_minutes as number | undefined : undefined,
  ) ?? startAbsDay;

  if (isTimed) {
    if (endAbsDay <= startAbsDay) {
      endAbsDay = startAbsDay + 1 / 24;
    }
  } else {
    endAbsDay = Math.max(startAbsDay + 1, endEpochDay + 1);
  }

  return {
    startAbsDay,
    endAbsDay,
    isSpan: true,
    startHasTime,
    endHasTime,
    allDay,
  };
}

function formatTemporalSlotValue(
  node: LayoutRenderNode,
  slot: 'start_at' | 'end_at',
  epochDay: number,
  minutesOfDay?: number,
  forceDateOnly = false,
): string {
  return formatTemporalSlotValueForWriteback(node, slot, epochDay, minutesOfDay, forceDateOnly);
}

export const timelinePlugin: WorkspaceLayoutPlugin = {
  key: 'timeline',
  displayName: 'Timeline',

  configModel: [],

  getDefaultConfig() {
    return {
      _originDay: todayEpochDays(),
    };
  },

  interactionConstraints: {
    panAxis: 'x',
    nodeDragAxis: 'x',
    enableSpanResize: false,
  },
  viewportMode: 'screen',
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

  projectNodes({ nodes, viewport, viewportState, config }) {
    const originDay = (config._originDay as number) ?? todayEpochDays();
    const pxPerDay = Math.max(PIXELS_PER_DAY * viewportState.zoom, 0.0001);
    const rangeStart = Math.floor(originDay + (-viewportState.panX) / pxPerDay) - 2;
    const rangeEnd = Math.ceil(originDay + (viewport.width - viewportState.panX) / pxPerDay) + 2;
    return projectRecurringTemporalNodes(nodes, rangeStart, rangeEnd);
  },

  classifyNodes(nodes: LayoutRenderNode[]) {
    return {
      cardNodes: nodes.filter((node) => typeof node.metadata.start_at === 'number'),
      overlayNodes: [],
    };
  },

  BackgroundComponent: TimelineBackground,
  OverlayComponent: TimelineOverlay,

  hiddenControls: ['fit', 'nav'],

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
    const { newX, node, zoom } = context;
    const bounds = resolveTimelineBounds(node);
    if (!bounds || !node.conceptId) {
      return {
        position: { x: Math.round(node.x), y: Math.round(node.y) },
      };
    }

    const slotFieldIds = node.metadata.__slotFieldIds as Record<string, string> | undefined;
    if (!slotFieldIds?.start_at) {
      return {
        position: { x: Math.round(node.x), y: Math.round(node.y) },
      };
    }

    const pxPerDay = Math.max(PIXELS_PER_DAY * zoom, 0.0001);
    const deltaDays = (newX - node.x) / pxPerDay;
    const nextStart = splitAbsoluteDay(bounds.startAbsDay + deltaDays, bounds.startHasTime);

    const propertyUpdates: Array<{ conceptId: string; fieldId: string; value: string }> = [{
      conceptId: node.conceptId,
      fieldId: slotFieldIds.start_at,
      value: formatTemporalSlotValue(
        node,
        'start_at',
        nextStart.epochDay,
        nextStart.minutesOfDay,
        !bounds.startHasTime,
      ),
    }];

    if (bounds.isSpan && slotFieldIds.end_at) {
      if (bounds.endHasTime) {
        const nextEnd = splitAbsoluteDay(bounds.endAbsDay + deltaDays, true);
        propertyUpdates.push({
          conceptId: node.conceptId,
          fieldId: slotFieldIds.end_at,
          value: formatTemporalSlotValue(
            node,
            'end_at',
            nextEnd.epochDay,
            nextEnd.minutesOfDay,
            false,
          ),
        });
      } else {
        const nextDisplayEnd = Math.max(bounds.startAbsDay + deltaDays + 1, bounds.endAbsDay + deltaDays);
        const nextEndEpochDay = Math.max(nextStart.epochDay, Math.ceil(nextDisplayEnd) - 1);
        propertyUpdates.push({
          conceptId: node.conceptId,
          fieldId: slotFieldIds.end_at,
          value: formatTemporalSlotValue(
            node,
            'end_at',
            nextEndEpochDay,
            undefined,
            true,
          ),
        });
      }
    }

    return {
      position: {
        x: Math.round(node.x),
        y: Math.round(node.y),
      },
      propertyUpdates,
    };
  },
};
