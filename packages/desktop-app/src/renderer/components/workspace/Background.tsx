import React from 'react';

interface BackgroundProps {
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
}

const GRID_SIZE = 20;

export const Background: React.FC<BackgroundProps> = ({
  width,
  height,
  zoom,
  panX,
  panY,
}) => {
  const scaledGrid = GRID_SIZE * zoom;
  const offsetX = panX % scaledGrid;
  const offsetY = panY % scaledGrid;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <pattern
          id="grid"
          width={scaledGrid}
          height={scaledGrid}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <circle cx={scaledGrid / 2} cy={scaledGrid / 2} r={0.5} fill="var(--border-subtle)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="var(--surface-canvas)" />
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
};
