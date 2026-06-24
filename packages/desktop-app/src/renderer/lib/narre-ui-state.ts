export interface NarrePendingIndexSkillState {
  startPage: number;
  endPage: number;
  overviewPagesText: string;
}

export interface NarrePendingSkillInvocationState {
  name: string;
  indexArgs?: NarrePendingIndexSkillState;
}

export interface NarreWorldUiState {
  view: 'sessionList' | 'chat';
  activeSessionId: string | null;
  activeAgentKey: string | null;
  drafts: Record<string, string>;
  pendingSkillInvocations: Record<string, NarrePendingSkillInvocationState>;
}

type NarreWorldUiStateListener = (state: NarreWorldUiState) => void;

const STORAGE_PREFIX = 'netior:narre-ui:';
const DEFAULT_WORLD_UI_STATE: NarreWorldUiState = {
  view: 'sessionList',
  activeSessionId: null,
  activeAgentKey: null,
  drafts: {},
  pendingSkillInvocations: {},
};
const worldUiStateListeners = new Map<string, Set<NarreWorldUiStateListener>>();

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStorageKey(rootNetworkId: string): string {
  return `${STORAGE_PREFIX}${rootNetworkId}`;
}

function notifyNarreWorldUiState(rootNetworkId: string, state: NarreWorldUiState): void {
  const listeners = worldUiStateListeners.get(rootNetworkId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  for (const listener of listeners) {
    listener(state);
  }
}

function sanitizeWorldUiState(value: unknown): NarreWorldUiState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_WORLD_UI_STATE };
  }

  const source = value as Partial<NarreWorldUiState>;
  const drafts = source.drafts && typeof source.drafts === 'object' && !Array.isArray(source.drafts)
    ? Object.fromEntries(
        Object.entries(source.drafts)
          .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
      )
    : {};
  const rawPendingSkillInvocations = source.pendingSkillInvocations ?? (source as { pendingCommands?: unknown }).pendingCommands;
  const pendingSkillInvocations = rawPendingSkillInvocations && typeof rawPendingSkillInvocations === 'object' && !Array.isArray(rawPendingSkillInvocations)
    ? Object.fromEntries(
        Object.entries(rawPendingSkillInvocations)
          .map(([key, invocation]) => {
            if (typeof key !== 'string' || !invocation || typeof invocation !== 'object' || Array.isArray(invocation)) {
              return null;
            }

            const candidate = invocation as Partial<NarrePendingSkillInvocationState>;
            if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
              return null;
            }

            const next: NarrePendingSkillInvocationState = { name: candidate.name };
            if (candidate.indexArgs && typeof candidate.indexArgs === 'object' && !Array.isArray(candidate.indexArgs)) {
              const indexArgs = candidate.indexArgs as Partial<NarrePendingIndexSkillState>;
              const startPage = typeof indexArgs.startPage === 'number' ? indexArgs.startPage : 1;
              const endPage = typeof indexArgs.endPage === 'number' ? indexArgs.endPage : 1;
              const overviewPagesText = typeof indexArgs.overviewPagesText === 'string' ? indexArgs.overviewPagesText : '';

              next.indexArgs = {
                startPage,
                endPage,
                overviewPagesText,
              };
            }

            return [key, next] as const;
          })
          .filter((entry): entry is readonly [string, NarrePendingSkillInvocationState] => entry !== null),
      )
    : {};

  return {
    view: source.view === 'chat' ? 'chat' : 'sessionList',
    activeSessionId: typeof source.activeSessionId === 'string' ? source.activeSessionId : null,
    activeAgentKey: typeof source.activeAgentKey === 'string' ? source.activeAgentKey : null,
    drafts,
    pendingSkillInvocations,
  };
}

export function getNarreWorldUiState(rootNetworkId: string): NarreWorldUiState {
  if (!canUseStorage()) {
    return { ...DEFAULT_WORLD_UI_STATE };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(rootNetworkId));
    if (!raw) {
      return { ...DEFAULT_WORLD_UI_STATE };
    }

    return sanitizeWorldUiState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORLD_UI_STATE };
  }
}

export function updateNarreWorldUiState(
  rootNetworkId: string,
  updater: (prev: NarreWorldUiState) => NarreWorldUiState,
): NarreWorldUiState {
  const next = sanitizeWorldUiState(updater(getNarreWorldUiState(rootNetworkId)));
  if (!canUseStorage()) {
    return next;
  }

  try {
    window.localStorage.setItem(getStorageKey(rootNetworkId), JSON.stringify(next));
  } catch {
    // Ignore storage failures; Narre still works with in-memory state.
  }

  notifyNarreWorldUiState(rootNetworkId, next);
  return next;
}

export function subscribeNarreWorldUiState(
  rootNetworkId: string,
  listener: NarreWorldUiStateListener,
): () => void {
  const listeners = worldUiStateListeners.get(rootNetworkId) ?? new Set<NarreWorldUiStateListener>();
  listeners.add(listener);
  worldUiStateListeners.set(rootNetworkId, listeners);

  return () => {
    const current = worldUiStateListeners.get(rootNetworkId);
    if (!current) {
      return;
    }

    current.delete(listener);
    if (current.size === 0) {
      worldUiStateListeners.delete(rootNetworkId);
    }
  };
}

export function setNarreWorldDraft(
  rootNetworkId: string,
  sessionId: string | null,
  draftHtml: string,
): void {
  const draftKey = sessionId ?? '__new__';
  updateNarreWorldUiState(rootNetworkId, (prev) => {
    const drafts = { ...prev.drafts };
    if (draftHtml) {
      drafts[draftKey] = draftHtml;
    } else {
      delete drafts[draftKey];
    }

    return {
      ...prev,
      drafts,
    };
  });
}

export function getNarreWorldDraft(rootNetworkId: string, sessionId: string | null): string {
  return getNarreWorldUiState(rootNetworkId).drafts[sessionId ?? '__new__'] ?? '';
}

export function moveNarreWorldDraft(
  rootNetworkId: string,
  fromSessionId: string | null,
  toSessionId: string | null,
): void {
  const fromKey = fromSessionId ?? '__new__';
  const toKey = toSessionId ?? '__new__';

  if (fromKey === toKey) {
    return;
  }

  updateNarreWorldUiState(rootNetworkId, (prev) => {
    const drafts = { ...prev.drafts };
    const fromDraft = drafts[fromKey];
    if (typeof fromDraft === 'string' && fromDraft.length > 0 && !drafts[toKey]) {
      drafts[toKey] = fromDraft;
    }
    delete drafts[fromKey];

    return {
      ...prev,
      drafts,
    };
  });
}

export function setNarreWorldPendingSkillInvocation(
  rootNetworkId: string,
  sessionId: string | null,
  skillInvocationState: NarrePendingSkillInvocationState | null,
): void {
  const draftKey = sessionId ?? '__new__';
  updateNarreWorldUiState(rootNetworkId, (prev) => {
    const pendingSkillInvocations = { ...prev.pendingSkillInvocations };
    if (skillInvocationState) {
      pendingSkillInvocations[draftKey] = skillInvocationState;
    } else {
      delete pendingSkillInvocations[draftKey];
    }

    return {
      ...prev,
      pendingSkillInvocations,
    };
  });
}

export function getNarreWorldPendingSkillInvocation(
  rootNetworkId: string,
  sessionId: string | null,
): NarrePendingSkillInvocationState | null {
  return getNarreWorldUiState(rootNetworkId).pendingSkillInvocations[sessionId ?? '__new__'] ?? null;
}

export function moveNarreWorldPendingSkillInvocation(
  rootNetworkId: string,
  fromSessionId: string | null,
  toSessionId: string | null,
): void {
  const fromKey = fromSessionId ?? '__new__';
  const toKey = toSessionId ?? '__new__';

  if (fromKey === toKey) {
    return;
  }

  updateNarreWorldUiState(rootNetworkId, (prev) => {
    const pendingSkillInvocations = { ...prev.pendingSkillInvocations };
    const fromInvocation = pendingSkillInvocations[fromKey];
    if (fromInvocation && !pendingSkillInvocations[toKey]) {
      pendingSkillInvocations[toKey] = fromInvocation;
    }
    delete pendingSkillInvocations[fromKey];

    return {
      ...prev,
      pendingSkillInvocations,
    };
  });
}
