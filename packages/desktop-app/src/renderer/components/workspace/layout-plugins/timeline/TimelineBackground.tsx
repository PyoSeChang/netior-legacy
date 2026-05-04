import React, { useMemo } from 'react';
import type { LayoutLayerProps } from '../types';
import {
  generateHeaderCells,
  getGranularity,
  PIXELS_PER_DAY,
  todayEpochDays,
} from '../time-axis/scale-utils';

const HEADER_MAJOR_HEIGHT = 28;
const HEADER_MINOR_HEIGHT = 24;
const AXIS_BAND_HEIGHT = 24;

export const TIMELINE_HEADER_TOTAL_HEIGHT = HEADER_MAJOR_HEIGHT + HEADER_MINOR_HEIGHT + AXIS_BAND_HEIGHT;

export function getTimelineAxisY(height: number): number {
  return Math.max(TIMELINE_HEADER_TOTAL_HEIGHT + 96, Math.round(height / 2));
}

export const TimelineBackground: React.FC<LayoutLayerProps> = ({
  width,
  height,
  zoom,
  panX,
  config,
}) => {
  const originDay = (config._originDay as number) ?? todayEpochDays();
  const { major, minor } = getGranularity(zoom);
  const safeWidth = width || 2000;

  const majorCells = useMemo(
    () => generateHeaderCells({ granularity: major, zoom, panX, viewportWidth: safeWidth, originDay }),
    [major, zoom, panX, safeWidth, originDay],
  );
  const minorCells = useMemo(
    () => generateHeaderCells({ granularity: minor, zoom, panX, viewportWidth: safeWidth, originDay }),
    [minor, zoom, panX, safeWidth, originDay],
  );

  const pxPerDay = PIXELS_PER_DAY * zoom;
  const todayScreenX = (todayEpochDays() - originDay) * pxPerDay + panX;
  const axisY = getTimelineAxisY(height);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--surface-canvas)' }} />

      <svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
        {minorCells.map((cell, index) => (
          <line
            key={`timeline-minor-${index}`}
            x1={cell.screenX}
            y1={axisY}
            x2={cell.screenX}
            y2={height}
            stroke="var(--border-subtle)"
            strokeWidth={0.5}
          />
        ))}
        {majorCells.map((cell, index) => (
          <line
            key={`timeline-major-${index}`}
            x1={cell.screenX}
            y1={axisY}
            x2={cell.screenX}
            y2={height}
            stroke="var(--border-default)"
            strokeWidth={1}
            opacity={0.55}
          />
        ))}
        {todayScreenX >= 0 && todayScreenX <= safeWidth && (
          <line
            x1={todayScreenX}
            y1={0}
            x2={todayScreenX}
            y2={height}
            stroke="var(--accent)"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}
      </svg>

      <svg width="100%" height={TIMELINE_HEADER_TOTAL_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, zIndex: 10 }}>
        <rect x={0} y={0} width="100%" height={TIMELINE_HEADER_TOTAL_HEIGHT} fill="var(--surface-panel)" />
        <line x1={0} y1={HEADER_MAJOR_HEIGHT} x2="100%" y2={HEADER_MAJOR_HEIGHT} stroke="var(--border-subtle)" strokeWidth={1} />
        <line x1={0} y1={HEADER_MAJOR_HEIGHT + HEADER_MINOR_HEIGHT} x2="100%" y2={HEADER_MAJOR_HEIGHT + HEADER_MINOR_HEIGHT} stroke="var(--border-subtle)" strokeWidth={1} />
        <line x1={0} y1={TIMELINE_HEADER_TOTAL_HEIGHT} x2="100%" y2={TIMELINE_HEADER_TOTAL_HEIGHT} stroke="var(--border-default)" strokeWidth={1} />

        {majorCells.map((cell, index) => (
          <g key={`timeline-major-header-${index}`}>
            <line x1={cell.screenX} y1={0} x2={cell.screenX} y2={HEADER_MAJOR_HEIGHT} stroke="var(--border-subtle)" strokeWidth={1} />
            <text
              x={cell.screenX + 6}
              y={HEADER_MAJOR_HEIGHT / 2}
              dominantBaseline="middle"
              fill="var(--text-default)"
              fontSize={11}
              fontWeight={600}
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {cell.label}
            </text>
          </g>
        ))}

        {minorCells.map((cell, index) => (
          <g key={`timeline-minor-header-${index}`}>
            <line
              x1={cell.screenX}
              y1={HEADER_MAJOR_HEIGHT}
              x2={cell.screenX}
              y2={HEADER_MAJOR_HEIGHT + HEADER_MINOR_HEIGHT}
              stroke="var(--border-subtle)"
              strokeWidth={0.5}
            />
            <line
              x1={cell.screenX}
              y1={HEADER_MAJOR_HEIGHT + HEADER_MINOR_HEIGHT}
              x2={cell.screenX}
              y2={TIMELINE_HEADER_TOTAL_HEIGHT}
              stroke="var(--border-subtle)"
              strokeWidth={0.5}
              opacity={0.6}
            />
            {cell.screenWidth > 12 && (
              <text
                x={cell.screenX + cell.screenWidth / 2}
                y={HEADER_MAJOR_HEIGHT + HEADER_MINOR_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--text-secondary)"
                fontSize={10}
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                {cell.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      <svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
        <line x1={0} y1={axisY} x2="100%" y2={axisY} stroke="var(--border-strong)" strokeWidth={1.5} />
      </svg>
    </div>
  );
};
