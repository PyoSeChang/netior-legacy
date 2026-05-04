import type { LayoutComputeInput, LayoutComputeResult, LayoutRenderNode } from '../types';
import { PIXELS_PER_DAY, todayEpochDays } from '../time-axis/scale-utils';
import { getTimelineAxisY } from './TimelineBackground';

const CARD_HEIGHT = 76;
const DEFAULT_CARD_WIDTH = 188;
const LANE_GAP = 18;
const AXIS_CARD_GAP = 32;
const COLLISION_PADDING = 20;

interface TimelineItemBounds {
  startAbsDay: number;
  endAbsDay: number;
  isSpan: boolean;
}

function getAbsoluteDay(epochDay: number | undefined, minutesOfDay: number | undefined): number | null {
  if (typeof epochDay !== 'number') return null;
  if (typeof minutesOfDay !== 'number') return epochDay;
  return epochDay + minutesOfDay / 1440;
}

function getItemBounds(node: LayoutRenderNode): TimelineItemBounds | null {
  const startAbsDay = getAbsoluteDay(
    node.metadata.start_at as number | undefined,
    node.metadata.start_at_has_time === true
      ? node.metadata.start_at_minutes as number | undefined
      : undefined,
  );
  if (startAbsDay == null) return null;

  const endEpochDay = node.metadata.end_at as number | undefined;
  if (typeof endEpochDay !== 'number') {
    return { startAbsDay, endAbsDay: startAbsDay, isSpan: false };
  }

  const endHasTime = node.metadata.end_at_has_time === true;
  const startHasTime = node.metadata.start_at_has_time === true;
  const isTimed = node.metadata.all_day !== true && (startHasTime || endHasTime);
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
  };
}

export function computeTimelineLayout(input: LayoutComputeInput): LayoutComputeResult {
  const { nodes, viewport, viewportState, config } = input;
  if (nodes.length === 0) return {};

  const originDay = (config._originDay as number) ?? todayEpochDays();
  const pxPerDay = Math.max(PIXELS_PER_DAY * viewportState.zoom, 0.0001);
  const result: LayoutComputeResult = {};
  const axisY = getTimelineAxisY(viewport.height);

  const topLanes: Array<Array<{ start: number; end: number }>> = [];
  const bottomLanes: Array<Array<{ start: number; end: number }>> = [];
  const orderedNodes = [...nodes].sort((left, right) => {
    const leftBounds = getItemBounds(left);
    const rightBounds = getItemBounds(right);
    if (!leftBounds || !rightBounds) return left.id.localeCompare(right.id);
    if (leftBounds.startAbsDay !== rightBounds.startAbsDay) {
      return leftBounds.startAbsDay - rightBounds.startAbsDay;
    }
    const leftDuration = leftBounds.endAbsDay - leftBounds.startAbsDay;
    const rightDuration = rightBounds.endAbsDay - rightBounds.startAbsDay;
    if (leftDuration !== rightDuration) {
      return rightDuration - leftDuration;
    }
    return left.id.localeCompare(right.id);
  });

  orderedNodes.forEach((node, index) => {
    const bounds = getItemBounds(node);
    if (!bounds) return;

    const width = DEFAULT_CARD_WIDTH;

    const centerAbsDay = bounds.isSpan
      ? bounds.startAbsDay + (bounds.endAbsDay - bounds.startAbsDay) / 2
      : bounds.startAbsDay;
    const x = (centerAbsDay - originDay) * pxPerDay + viewportState.panX;
    const xStart = x - width / 2 - COLLISION_PADDING;
    const xEnd = x + width / 2 + COLLISION_PADDING;

    const preferTop = index % 2 === 0;
    const preferredLanes = preferTop ? topLanes : bottomLanes;
    const alternateLanes = preferTop ? bottomLanes : topLanes;
    let laneIndex = 0;
    while (laneIndex < preferredLanes.length) {
      const overlaps = preferredLanes[laneIndex].some((item) => xStart < item.end && xEnd > item.start);
      if (!overlaps) break;
      laneIndex += 1;
    }

    let useTop = preferTop;
    if (laneIndex > 1) {
      let alternateLaneIndex = 0;
      while (alternateLaneIndex < alternateLanes.length) {
        const overlaps = alternateLanes[alternateLaneIndex].some((item) => xStart < item.end && xEnd > item.start);
        if (!overlaps) break;
        alternateLaneIndex += 1;
      }
      if (alternateLaneIndex < laneIndex) {
        laneIndex = alternateLaneIndex;
        useTop = !preferTop;
      }
    }

    const targetLanes = useTop ? topLanes : bottomLanes;
    if (!targetLanes[laneIndex]) {
      targetLanes[laneIndex] = [];
    }
    targetLanes[laneIndex].push({ start: xStart, end: xEnd });

    const laneOffset = AXIS_CARD_GAP + CARD_HEIGHT / 2 + laneIndex * (CARD_HEIGHT + LANE_GAP);
    const y = useTop
      ? axisY - laneOffset
      : axisY + laneOffset;

    result[node.id] = {
      x: Math.round(x),
      y: Math.round(y),
      width,
      height: CARD_HEIGHT,
    };
  });

  return result;
}
