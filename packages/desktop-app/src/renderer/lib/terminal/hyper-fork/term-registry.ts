export interface HyperTerminalSurfaceHandle {
  focus(): void;
}

const terms: Record<string, HyperTerminalSurfaceHandle | null> = {};

export function registerHyperTerminalSurface(
  sessionId: string,
  surface: HyperTerminalSurfaceHandle,
): void {
  terms[sessionId] = surface;
}

export function unregisterHyperTerminalSurface(
  sessionId: string,
  surface?: HyperTerminalSurfaceHandle,
): void {
  if (surface && terms[sessionId] && terms[sessionId] !== surface) {
    return;
  }
  delete terms[sessionId];
}

export function getHyperTerminalSurface(sessionId: string): HyperTerminalSurfaceHandle | null {
  return terms[sessionId] ?? null;
}

export function focusHyperTerminalSurface(sessionId: string): boolean {
  const surface = getHyperTerminalSurface(sessionId);
  if (!surface) return false;
  surface.focus();
  return true;
}
