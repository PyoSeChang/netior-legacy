import React, { useState, useCallback } from 'react';
import type { SplitDirection } from '@netior/shared/types';
import { isTabDrag, getTabDragDataAsync, flushTabDragData } from '../../hooks/useTabDrag';
import { getFileOpenDragData, isFileOpenDrag } from '../../hooks/useFileOpenDrag';
import {
  dispatchNarreMentionDrop,
  getNarreMentionDragData,
  isNarreMentionDrag,
  NARRE_MENTION_DROP_TARGET_SELECTOR,
} from '../../hooks/useNarreMentionDrag';

export type DropZone = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface DropResult {
  tabId: string;
  zone: DropZone;
  direction: SplitDirection;
  position: 'before' | 'after';
}

interface DropZoneOverlayProps {
  onDrop: (result: DropResult) => void;
  onFileDrop?: (filePaths: string[], result: Omit<DropResult, 'tabId'>) => void;
  centerOnly?: boolean;
  active: boolean;
}

function zoneToSplit(zone: DropZone): { direction: SplitDirection; position: 'before' | 'after' } {
  switch (zone) {
    case 'top': return { direction: 'vertical', position: 'before' };
    case 'bottom': return { direction: 'vertical', position: 'after' };
    case 'left': return { direction: 'horizontal', position: 'before' };
    case 'right': return { direction: 'horizontal', position: 'after' };
    case 'center': return { direction: 'horizontal', position: 'after' };
  }
}

function getZone(e: React.DragEvent<HTMLDivElement>, centerOnly?: boolean): DropZone {
  if (centerOnly) return 'center';

  const rect = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  const threshold = 0.25;

  if (y < threshold) return 'top';
  if (y > 1 - threshold) return 'bottom';
  if (x < threshold) return 'left';
  if (x > 1 - threshold) return 'right';
  return 'center';
}

function getMentionDropTargetUnderOverlay(e: React.DragEvent): Element | null {
  if (!isNarreMentionDrag(e)) return null;

  return document.elementsFromPoint(e.clientX, e.clientY)
    .find((element) => element.matches(NARRE_MENTION_DROP_TARGET_SELECTOR)) ?? null;
}

export function DropZoneOverlay({ onDrop, onFileDrop, centerOnly, active }: DropZoneOverlayProps): JSX.Element | null {
  const [activeZone, setActiveZone] = useState<DropZone | null>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (getMentionDropTargetUnderOverlay(e)) {
        console.log('[NarreMentionDrag][DropZoneOverlay] dragOver forwarded to mention target', {
          x: e.clientX,
          y: e.clientY,
        });
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setActiveZone(null);
        return;
      }

      if (!isTabDrag(e) && !isFileOpenDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      console.log(`[DropZoneOverlay] dragOver centerOnly=${!!centerOnly}, zone=${getZone(e, centerOnly)}, types=${JSON.stringify(Array.from(e.dataTransfer.types))}`);
      setActiveZone(getZone(e, centerOnly));
    },
    [centerOnly],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setActiveZone(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const mentionDropTarget = getMentionDropTargetUnderOverlay(e);
      if (mentionDropTarget) {
        const payload = getNarreMentionDragData(e);
        console.log('[NarreMentionDrag][DropZoneOverlay] drop on mention target', {
          hasPayload: !!payload,
          mentionType: payload?.mention.type,
          mentionId: payload?.mention.id,
          display: payload?.mention.display,
          x: e.clientX,
          y: e.clientY,
        });
        if (payload) {
          dispatchNarreMentionDrop(mentionDropTarget, {
            mention: payload.mention,
            clientX: e.clientX,
            clientY: e.clientY,
          });
        }
        setActiveZone(null);
        return;
      }

      const zone = getZone(e, centerOnly);
      const { direction, position } = zoneToSplit(zone);
      setActiveZone(null);

      if (isFileOpenDrag(e)) {
        const filePaths = getFileOpenDragData(e);
        console.log(`[DropZoneOverlay] drop file centerOnly=${!!centerOnly}, zone=${zone}, count=${filePaths.length}`);
        if (filePaths.length > 0) onFileDrop?.(filePaths, { zone, direction, position });
        return;
      }

      const tabId = await getTabDragDataAsync(e);
      flushTabDragData();
      console.log(`[DropZoneOverlay] drop tab centerOnly=${!!centerOnly}, zone=${zone}, tabId=${tabId}`);
      if (tabId) onDrop({ tabId, zone, direction, position });
    },
    [onDrop, onFileDrop, centerOnly],
  );

  // Only render when a drag is active
  if (!active) return null;

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {centerOnly ? (
        <div className={`absolute inset-0 pointer-events-auto transition-colors ${
          activeZone === 'center' ? 'bg-state-selected border-2 border-accent' : ''
        }`} />
      ) : (
        <>
          <div className={`absolute inset-x-0 top-0 h-1/4 pointer-events-auto transition-colors ${
            activeZone === 'top' ? 'bg-state-selected border-b-2 border-accent' : ''
          }`} />
          <div className={`absolute inset-x-0 bottom-0 h-1/4 pointer-events-auto transition-colors ${
            activeZone === 'bottom' ? 'bg-state-selected border-t-2 border-accent' : ''
          }`} />
          <div className={`absolute inset-y-0 left-0 w-1/4 pointer-events-auto transition-colors ${
            activeZone === 'left' ? 'bg-state-selected border-r-2 border-accent' : ''
          }`} />
          <div className={`absolute inset-y-0 right-0 w-1/4 pointer-events-auto transition-colors ${
            activeZone === 'right' ? 'bg-state-selected border-l-2 border-accent' : ''
          }`} />
          <div className={`absolute left-1/4 right-1/4 top-1/4 bottom-1/4 pointer-events-auto transition-colors ${
            activeZone === 'center' ? 'bg-state-muted border-2 border-dashed border-accent' : ''
          }`} />
        </>
      )}
    </div>
  );
}

