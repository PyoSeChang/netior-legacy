import React from 'react';
import { Eye, Pencil, ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { useI18n } from '../../hooks/useI18n';
import type {
  LayoutControlsPresentation,
  LayoutControlsRendererProps,
} from './layout-plugins/types';

type HiddenControl = 'zoom' | 'fit' | 'nav' | 'mode';

interface NetworkControlsProps extends LayoutControlsRendererProps {
  presentation?: LayoutControlsPresentation;
}

export function NetworkControls({
  mode,
  zoom,
  canGoBack,
  canGoForward,
  onToggleMode,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onNavigateBack,
  onNavigateForward,
  hiddenControls = [],
  extraItems = [],
  presentation = 'floating-fixed',
}: NetworkControlsProps): JSX.Element {
  const { t } = useI18n();
  const isFloating = presentation !== 'header-fixed';

  const hidden = new Set(hiddenControls);
  const showMode = !hidden.has('mode');
  const showNav = !hidden.has('nav');
  const showZoom = !hidden.has('zoom');
  const showFit = !hidden.has('fit');

  const style: React.CSSProperties | undefined = isFloating
    ? { position: 'absolute', right: 8, top: 8, zIndex: 30 }
    : undefined;
  const containerClassName = isFloating
    ? 'flex items-center gap-1 rounded-lg border border-subtle bg-surface-panel px-1.5 py-1 shadow-sm'
    : 'flex h-7 shrink-0 items-center gap-0.5 rounded-md px-1';

  return (
    <div
      className={containerClassName}
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Mode toggle */}
      {showMode && (
        <Tooltip content={mode === 'browse' ? t('network.editMode') : t('network.browseMode')} position="bottom">
          <button
            className={`rounded p-1 transition-colors ${
              mode === 'edit'
                ? 'bg-state-selected text-accent'
                : 'text-secondary hover:bg-state-hover hover:text-default'
            }`}
            onClick={onToggleMode}
          >
            {mode === 'browse' ? <Eye size={14} /> : <Pencil size={14} />}
          </button>
        </Tooltip>
      )}

      {showMode && (showNav || showZoom || showFit || extraItems.length > 0) && (
        <div className="mx-0.5 h-4 w-px bg-border-subtle" />
      )}

      {/* Navigation */}
      {showNav && mode === 'browse' && (
        <>
          <Tooltip content={t('network.navBack')} position="bottom">
            <button
              className="rounded p-1 text-secondary hover:bg-state-hover hover:text-default disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={!canGoBack}
              onClick={onNavigateBack}
            >
              <ChevronLeft size={14} />
            </button>
          </Tooltip>
          <Tooltip content={t('network.navForward')} position="bottom">
            <button
              className="rounded p-1 text-secondary hover:bg-state-hover hover:text-default disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={!canGoForward}
              onClick={onNavigateForward}
            >
              <ChevronRight size={14} />
            </button>
          </Tooltip>
          {(showZoom || showFit) && <div className="mx-0.5 h-4 w-px bg-border-subtle" />}
        </>
      )}

      {/* Zoom controls */}
      {showZoom && (
        <>
          <Tooltip content={t('network.zoomOut')} position="bottom">
            <button
              className="rounded p-1 text-secondary hover:bg-state-hover hover:text-default"
              onClick={onZoomOut}
            >
              <ZoomOut size={14} />
            </button>
          </Tooltip>

          <span className="min-w-[36px] text-center text-xs text-secondary tabular-nums">
            {Math.round(zoom * 100)}%
          </span>

          <Tooltip content={t('network.zoomIn')} position="bottom">
            <button
              className="rounded p-1 text-secondary hover:bg-state-hover hover:text-default"
              onClick={onZoomIn}
            >
              <ZoomIn size={14} />
            </button>
          </Tooltip>
        </>
      )}

      {showFit && (
        <Tooltip content={t('network.fitToScreen')} position="bottom">
          <button
            className="rounded p-1 text-secondary hover:bg-state-hover hover:text-default"
            onClick={onFitToScreen}
          >
            <Maximize size={14} />
          </button>
        </Tooltip>
      )}

      {/* Plugin extra items */}
      {extraItems.length > 0 && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border-subtle" />
          {extraItems.map((item) => (
            <Tooltip key={item.key} content={item.label} position="bottom">
              <button
                className={`rounded p-1 hover:bg-state-hover hover:text-default ${
                  item.active ? 'text-accent' : 'text-secondary'
                }`}
                onClick={item.onClick}
              >
                {item.icon}
              </button>
            </Tooltip>
          ))}
        </>
      )}
    </div>
  );
}
