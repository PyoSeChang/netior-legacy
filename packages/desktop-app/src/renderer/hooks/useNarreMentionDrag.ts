import type React from 'react';
import type { MentionResult } from '../services/narre-service';

export const NARRE_MENTION_DRAG_TYPE = 'application/x-netior-narre-mention';
export const NARRE_MENTION_DROP_TARGET_SELECTOR = '[data-narre-mention-drop-target="true"]';
export const NARRE_MENTION_CUSTOM_DROP_EVENT = 'netior:narre-mention-drop';

export interface NarreMentionDragPayload {
  mention: MentionResult;
}

export interface NarreMentionCustomDropDetail {
  mention: MentionResult;
  clientX: number;
  clientY: number;
}

function parsePayload(raw: string): NarreMentionDragPayload | null {
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as NarreMentionDragPayload;
    if (!payload.mention?.type || !payload.mention.display) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function setNarreMentionDragData(event: React.DragEvent, mention: MentionResult): void {
  event.dataTransfer.setData(NARRE_MENTION_DRAG_TYPE, JSON.stringify({ mention } satisfies NarreMentionDragPayload));
  event.dataTransfer.setData('text/plain', `@${mention.display}`);
  event.dataTransfer.effectAllowed = 'copy';
}

export function getNarreMentionDragData(event: React.DragEvent): NarreMentionDragPayload | null {
  return parsePayload(event.dataTransfer.getData(NARRE_MENTION_DRAG_TYPE));
}

export function isNarreMentionDrag(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(NARRE_MENTION_DRAG_TYPE);
}

export function isEditableMentionDropTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest(NARRE_MENTION_DROP_TARGET_SELECTOR) != null
    || target.closest('input, textarea, [contenteditable=""], [contenteditable="true"]') != null
    || target.isContentEditable;
}

export function dispatchNarreMentionDrop(target: Element, detail: NarreMentionCustomDropDetail): void {
  target.dispatchEvent(new CustomEvent<NarreMentionCustomDropDetail>(NARRE_MENTION_CUSTOM_DROP_EVENT, {
    bubbles: true,
    detail,
  }));
}
