import React, { useCallback, useRef } from 'react';
import type { SplitNode, SplitLeaf } from '../../types/editor';
import { ResizeHandle } from '../ui/ResizeHandle';

interface SplitPaneRendererProps {
  node: SplitNode;
  mode: 'side' | 'full';
  path?: number[];
  adjacency?: PaneAdjacency;
  renderLeaf: (leaf: SplitLeaf, adjacency?: PaneAdjacency) => React.ReactNode;
  onRatioChange: (mode: 'side' | 'full', path: number[], ratio: number) => void;
}

export interface PaneAdjacency {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
}

export function isTopRightPane(adjacency?: PaneAdjacency): boolean {
  return !adjacency?.top && !adjacency?.right;
}

export function SplitPaneRenderer({
  node,
  mode,
  path = [],
  adjacency,
  renderLeaf,
  onRatioChange,
}: SplitPaneRendererProps): JSX.Element {
  if (node.type === 'leaf') {
    return (
      <div className="pane-leaf-host h-full w-full overflow-visible">
        {renderLeaf(node, adjacency)}
      </div>
    );
  }

  const isHorizontal = node.direction === 'horizontal';
  const firstChildAdjacency = {
    ...adjacency,
    ...(isHorizontal ? { right: true } : { bottom: true }),
  };
  const secondChildAdjacency = {
    ...adjacency,
    ...(isHorizontal ? { left: true } : { top: true }),
  };

  return (
    <div className={`flex h-full w-full ${isHorizontal ? 'flex-row' : 'flex-col'}`}>
      <div
        className="min-h-0 min-w-0 overflow-visible"
        style={{
          flexBasis: 0,
          flexGrow: node.ratio,
          flexShrink: 1,
        }}
      >
        <SplitPaneRenderer
          node={node.children[0]}
          mode={mode}
          path={[...path, 0]}
          adjacency={firstChildAdjacency}
          renderLeaf={renderLeaf}
          onRatioChange={onRatioChange}
        />
      </div>

      <SplitHandle
        direction={node.direction}
        mode={mode}
        path={path}
        onRatioChange={onRatioChange}
      />

      <div
        className="min-h-0 min-w-0 overflow-visible"
        style={{
          flexBasis: 0,
          flexGrow: 1 - node.ratio,
          flexShrink: 1,
        }}
      >
        <SplitPaneRenderer
          node={node.children[1]}
          mode={mode}
          path={[...path, 1]}
          adjacency={secondChildAdjacency}
          renderLeaf={renderLeaf}
          onRatioChange={onRatioChange}
        />
      </div>
    </div>
  );
}

interface SplitHandleProps {
  direction: 'horizontal' | 'vertical';
  mode: 'side' | 'full';
  path: number[];
  onRatioChange: (mode: 'side' | 'full', path: number[], ratio: number) => void;
}

function SplitHandle({ direction, mode, path, onRatioChange }: SplitHandleProps): JSX.Element {
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;

      const parent = (e.target as HTMLElement).parentElement;
      if (!parent) return;

      const handleMove = (ev: MouseEvent) => {
        if (!draggingRef.current || !parent) return;
        const rect = parent.getBoundingClientRect();
        const ratio = direction === 'horizontal'
          ? (ev.clientX - rect.left) / rect.width
          : (ev.clientY - rect.top) / rect.height;
        onRatioChange(mode, path, ratio);
      };

      const handleUp = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [direction, mode, path, onRatioChange],
  );

  return (
    <ResizeHandle direction={direction} onMouseDown={handleMouseDown} />
  );
}
