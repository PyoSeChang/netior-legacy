export type ActivityBarTopItemKey =
  | 'worlds'
  | 'models'
  | 'files'
  | 'sessions';
export type ActivityBarBottomItemKey = 'narre' | 'terminal' | 'agents' | 'browser' | 'settings';

export const ACTIVITY_BAR_TOP_ITEM_KEYS = [
  'worlds',
  'models',
  'files',
  'sessions',
] as const satisfies readonly ActivityBarTopItemKey[];

export const ACTIVITY_BAR_BOTTOM_ITEM_KEYS = [
  'narre',
  'terminal',
  'agents',
  'browser',
  'settings',
] as const satisfies readonly ActivityBarBottomItemKey[];

export interface ActivityBarLayoutConfig {
  topItemOrder: ActivityBarTopItemKey[];
  bottomItemOrder: ActivityBarBottomItemKey[];
}

export const ACTIVITY_BAR_LAYOUT_CONFIG_KEY = 'ui.activityBarLayout';

export const DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG: ActivityBarLayoutConfig = {
  topItemOrder: [...ACTIVITY_BAR_TOP_ITEM_KEYS],
  bottomItemOrder: [...ACTIVITY_BAR_BOTTOM_ITEM_KEYS],
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const normalized = entry.trim();
    if (!normalized) {
      continue;
    }
    unique.add(normalized);
  }

  return [...unique];
}

function normalizeItemOrder<T extends string>(value: unknown, defaults: readonly T[]): T[] {
  const allowed = new Set(defaults);
  const ordered = normalizeStringArray(value).filter((entry): entry is T => allowed.has(entry as T));
  return [...ordered, ...defaults.filter((entry) => !ordered.includes(entry))];
}

function normalizeTopItemOrder(value: unknown): ActivityBarTopItemKey[] {
  const entries = normalizeStringArray(value);
  return normalizeItemOrder(entries, ACTIVITY_BAR_TOP_ITEM_KEYS);
}

function normalizeBottomItemOrder(value: unknown): ActivityBarBottomItemKey[] {
  return normalizeItemOrder(value, ACTIVITY_BAR_BOTTOM_ITEM_KEYS);
}

export function normalizeActivityBarLayoutConfig(value: unknown): ActivityBarLayoutConfig {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    topItemOrder: normalizeTopItemOrder(source.topItemOrder),
    bottomItemOrder: normalizeBottomItemOrder(source.bottomItemOrder),
  };
}

export function getVisibleOrderedItems<T extends string>(
  order: readonly T[],
  available: readonly T[],
): T[] {
  const availableSet = new Set(available);
  const visible = order.filter((entry): entry is T => availableSet.has(entry));
  return [...visible, ...available.filter((entry) => !visible.includes(entry))];
}

export function moveOrderedItem<T>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const targetIndex = index + direction;
  if (
    index < 0
    || index >= items.length
    || targetIndex < 0
    || targetIndex >= items.length
  ) {
    return [...items];
  }

  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
