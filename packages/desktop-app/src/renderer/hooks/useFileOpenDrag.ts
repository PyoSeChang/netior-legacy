import React from 'react';

export const FILE_OPEN_DRAG_TYPE = 'application/x-netior-file-open';

interface FileOpenDragPayload {
  paths: string[];
}

function parsePayload(raw: string): string[] {
  if (!raw) return [];
  try {
    const payload = JSON.parse(raw) as FileOpenDragPayload;
    if (!Array.isArray(payload.paths)) return [];
    return payload.paths.filter((path): path is string => typeof path === 'string' && path.length > 0);
  } catch {
    return [];
  }
}

export function setFileOpenDragData(event: React.DragEvent, paths: string[]): void {
  const filePaths = paths.filter((path) => path.length > 0);
  if (filePaths.length === 0) return;
  event.dataTransfer.setData(FILE_OPEN_DRAG_TYPE, JSON.stringify({ paths: filePaths } satisfies FileOpenDragPayload));
}

export function getFileOpenDragData(event: React.DragEvent): string[] {
  return parsePayload(event.dataTransfer.getData(FILE_OPEN_DRAG_TYPE));
}

export function isFileOpenDrag(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(FILE_OPEN_DRAG_TYPE);
}
