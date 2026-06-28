import React from 'react';
import { Eye, Filter, ListTree, Maximize, Pencil, RefreshCw, Settings, SlidersHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import { useCanvasViewStore } from '../../stores/canvas-view-store';
import { useDomainStore } from '../../stores/domain-store';
import { Tooltip } from '../ui/Tooltip';

type ViewType = 'explorer' | 'canvas';

export function ViewControl(): JSX.Element {
  const {
    activeViewType,
    loading,
    refreshCurrentWorld,
    setActiveViewType,
  } = useDomainStore();
  const viewTypes: ViewType[] = ['explorer', 'canvas'];

  return (
    <div
      className="flex h-full min-w-0 items-center gap-1"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="flex min-w-0 items-center gap-1">
        {viewTypes.length > 2 ? (
          <select
            className="h-7 rounded-md border border-subtle bg-surface-input px-2 text-xs text-default outline-none"
            value={activeViewType}
            onChange={(event) => setActiveViewType(event.target.value as ViewType)}
          >
            {viewTypes.map((type) => (
              <option key={type} value={type}>{type === 'explorer' ? 'Explorer' : 'Canvas'}</option>
            ))}
          </select>
        ) : (
          <div className="flex h-7 rounded-md border border-subtle bg-surface-input p-0.5">
            {viewTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`rounded px-2 text-xs transition-colors ${
                  activeViewType === type ? 'bg-state-selected text-accent' : 'text-secondary hover:text-default'
                }`}
                onClick={() => setActiveViewType(type)}
              >
                {type === 'explorer' ? 'Explorer' : 'Canvas'}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeViewType === 'explorer' ? <ExplorerControls /> : <CanvasControls />}
      <Divider />
      <Tooltip content="View settings" position="bottom">
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-state-hover hover:text-default">
          <Settings size={14} />
        </button>
      </Tooltip>
      <Tooltip content="Refresh" position="bottom">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-state-hover hover:text-default disabled:opacity-50"
          disabled={loading}
          onClick={() => { void refreshCurrentWorld(); }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </Tooltip>
    </div>
  );
}

function ExplorerControls(): JSX.Element {
  return (
    <>
      <Tooltip content="Filter" position="bottom">
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-state-hover hover:text-default">
          <Filter size={14} />
        </button>
      </Tooltip>
      <Tooltip content="Explorer options" position="bottom">
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-state-hover hover:text-default">
          <ListTree size={14} />
        </button>
      </Tooltip>
    </>
  );
}

function CanvasControls(): JSX.Element {
  const {
    mode,
    viewport,
    setMode,
    zoomIn,
    zoomOut,
    resetViewport,
    requestFit,
  } = useCanvasViewStore();
  const zoomLabel = `${Math.round(viewport.zoom * 100)}%`;

  return (
    <>
      <div className="flex h-7 rounded-md border border-subtle bg-surface-input p-0.5">
        <Tooltip content="Browse" position="bottom">
          <button
            type="button"
            className={`flex h-6 items-center gap-1 rounded px-1.5 text-xs hover:bg-state-hover ${
              mode === 'browse' ? 'bg-state-selected text-accent' : 'text-secondary hover:text-default'
            }`}
            onClick={() => setMode('browse')}
          >
            <Eye size={13} />
            Browse
          </button>
        </Tooltip>
        <Tooltip content="Edit" position="bottom">
          <button
            type="button"
            className={`flex h-6 items-center gap-1 rounded px-1.5 text-xs hover:bg-state-hover ${
              mode === 'edit' ? 'bg-state-selected text-accent' : 'text-secondary hover:text-default'
            }`}
            onClick={() => setMode('edit')}
          >
            <Pencil size={13} />
            Edit
          </button>
        </Tooltip>
      </div>
      <Divider />
      <Tooltip content="Zoom out" position="bottom">
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-state-hover hover:text-default" onClick={zoomOut}>
          <ZoomOut size={14} />
        </button>
      </Tooltip>
      <button
        type="button"
        className="min-w-9 rounded px-1 text-center text-[11px] tabular-nums text-secondary hover:bg-state-hover hover:text-default"
        onClick={resetViewport}
      >
        {zoomLabel}
      </button>
      <Tooltip content="Zoom in" position="bottom">
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-state-hover hover:text-default" onClick={zoomIn}>
          <ZoomIn size={14} />
        </button>
      </Tooltip>
      <Tooltip content="Fit" position="bottom">
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-state-hover hover:text-default" onClick={requestFit}>
          <Maximize size={14} />
        </button>
      </Tooltip>
      <Tooltip content="Canvas controls" position="bottom">
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-secondary hover:bg-state-hover hover:text-default">
          <SlidersHorizontal size={14} />
        </button>
      </Tooltip>
    </>
  );
}

function Divider(): JSX.Element {
  return <div className="mx-0.5 h-4 w-px bg-border-subtle" />;
}
