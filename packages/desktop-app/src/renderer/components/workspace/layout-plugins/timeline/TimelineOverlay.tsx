import React from 'react';
import type { LayoutLayerProps } from '../types';
import { PIXELS_PER_DAY, todayEpochDays } from '../time-axis/scale-utils';
import { getTimelineAxisY } from './TimelineBackground';

function getAbsoluteDay(epochDay: number | undefined, minutesOfDay: number | undefined): number | null {
  if (typeof epochDay !== 'number') return null;
  if (typeof minutesOfDay !== 'number') return epochDay;
  return epochDay + minutesOfDay / 1440;
}

export const TimelineOverlay: React.FC<LayoutLayerProps> = ({
  width,
  height,
  zoom,
  panX,
  nodes,
  config,
  nodeDragOffset,
}) => {
  const originDay = (config._originDay as number) ?? todayEpochDays();
  const axisY = getTimelineAxisY(height);
  const pxPerDay = Math.max(PIXELS_PER_DAY * zoom, 0.0001);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
        {nodes.map((node) => {
          const startAbsDay = getAbsoluteDay(
            node.metadata.start_at as number | undefined,
            node.metadata.start_at_has_time === true
              ? node.metadata.start_at_minutes as number | undefined
              : undefined,
          );
          if (startAbsDay == null) return null;

          const endAbsDay = getAbsoluteDay(
            node.metadata.end_at as number | undefined,
            node.metadata.end_at_has_time === true
              ? node.metadata.end_at_minutes as number | undefined
              : undefined,
          );

          const isDragging = nodeDragOffset?.id === node.id;
          const dragDayDelta = isDragging ? nodeDragOffset.dx / pxPerDay : 0;
          const x = isDragging ? node.x + nodeDragOffset.dx : node.x;
          const cardHalfHeight = (node.height ?? 76) / 2;
          const cardTop = node.y - cardHalfHeight;
          const cardBottom = node.y + cardHalfHeight;
          const isAboveAxis = node.y < axisY;
          const leaderY = isAboveAxis ? cardBottom : cardTop;
          const color = (node.metadata.display_color as string | undefined) ?? 'var(--accent)';

          const ribbon = typeof endAbsDay === 'number'
            ? {
                startX: (startAbsDay + dragDayDelta - originDay) * pxPerDay + panX,
                endX: ((endAbsDay + dragDayDelta) - originDay) * pxPerDay + panX,
              }
            : null;

          return (
            <g key={`timeline-overlay-${node.id}`}>
              {ribbon && (
                <>
                  <line
                    x1={Math.min(ribbon.startX, ribbon.endX)}
                    y1={axisY}
                    x2={Math.max(ribbon.startX, ribbon.endX)}
                    y2={axisY}
                    stroke={color}
                    strokeWidth={6}
                    opacity={0.28}
                    strokeLinecap="round"
                  />
                  <line
                    x1={Math.min(ribbon.startX, ribbon.endX)}
                    y1={axisY}
                    x2={Math.max(ribbon.startX, ribbon.endX)}
                    y2={axisY}
                    stroke={color}
                    strokeWidth={1.25}
                    opacity={0.65}
                    strokeLinecap="round"
                  />
                </>
              )}

              <line
                x1={x}
                y1={axisY}
                x2={x}
                y2={leaderY}
                stroke="var(--border-strong)"
                strokeWidth={1}
                opacity={0.7}
              />
              <circle
                cx={x}
                cy={axisY}
                r={4}
                fill={color}
                opacity={0.9}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
