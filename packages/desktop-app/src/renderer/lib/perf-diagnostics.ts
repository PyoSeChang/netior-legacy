import { useEffect, useRef } from 'react';

type DetailMap = Record<string, unknown>;

export function emitPerfDiagnostic(kind: string, payload: DetailMap): void {
  console.debug('[NetiorDiag]', kind, payload);
  try {
    window.electron.diagnostics?.perf({ kind, ...payload });
  } catch {
    // Console output is still useful when the diagnostic IPC is unavailable.
  }
}

function isDevBuild(): boolean {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
}

export function perfDiagnosticsEnabled(): boolean {
  if (!isDevBuild()) return false;
  try {
    return window.localStorage.getItem('netior:perf-diagnostics') !== 'off';
  } catch {
    return true;
  }
}

export function useRenderPerfTrace(name: string, details: DetailMap): void {
  const renderCountRef = useRef(0);
  const mountedAtRef = useRef(performance.now());
  const detailsRef = useRef(details);
  detailsRef.current = details;
  renderCountRef.current += 1;

  useEffect(() => {
    if (!perfDiagnosticsEnabled()) return;
    emitPerfDiagnostic('render', {
      component: name,
      renderCount: renderCountRef.current,
      sinceMountMs: Math.round((performance.now() - mountedAtRef.current) * 10) / 10,
      ...detailsRef.current,
    });
  });

  useEffect(() => {
    if (!perfDiagnosticsEnabled()) return undefined;
    emitPerfDiagnostic('mount', {
      component: name,
      ...detailsRef.current,
    });
    return () => {
      emitPerfDiagnostic('unmount', {
        component: name,
        lifetimeMs: Math.round((performance.now() - mountedAtRef.current) * 10) / 10,
        renderCount: renderCountRef.current,
        ...detailsRef.current,
      });
    };
  }, [name]);
}

export function useLongTaskPerfTrace(name: string, details: DetailMap): void {
  const detailsRef = useRef(details);
  detailsRef.current = details;

  useEffect(() => {
    if (!perfDiagnosticsEnabled()) return undefined;
    if (typeof PerformanceObserver === 'undefined') return undefined;

    let observer: PerformanceObserver;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          emitPerfDiagnostic('longtask', {
            component: name,
            durationMs: Math.round(entry.duration * 10) / 10,
            startTimeMs: Math.round(entry.startTime * 10) / 10,
            ...detailsRef.current,
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      return undefined;
    }

    return () => observer.disconnect();
  }, [name]);
}
