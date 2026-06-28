export interface RendererEditorPrefs {
  view_mode?: string;
  float_x?: number;
  float_y?: number;
  float_width?: number;
  float_height?: number;
  side_split_ratio?: number;
}

const PREFS_KEY = 'netior:renderer-editor-prefs:v1';

function readPrefs(): Record<string, RendererEditorPrefs> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) as Record<string, RendererEditorPrefs> : {};
  } catch {
    return {};
  }
}

function writePrefs(prefs: Record<string, RendererEditorPrefs>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function getEditorPrefs(targetId: string): Promise<RendererEditorPrefs | undefined> {
  return readPrefs()[targetId];
}

export async function upsertEditorPrefs(
  targetId: string,
  data: RendererEditorPrefs,
): Promise<RendererEditorPrefs> {
  const prefs = readPrefs();
  const next = { ...(prefs[targetId] ?? {}), ...data };
  writePrefs({ ...prefs, [targetId]: next });
  return next;
}

export const editorPrefsService = {
  get: getEditorPrefs,
  upsert: upsertEditorPrefs,
};
