import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG,
  getVisibleOrderedItems,
  moveOrderedItem,
  normalizeActivityBarLayoutConfig,
} from '../lib/activity-bar-layout';

describe('normalizeActivityBarLayoutConfig', () => {
  it('fills missing built-in items and removes duplicate bookmark ids', () => {
    const normalized = normalizeActivityBarLayoutConfig({
      topItemOrder: ['files', 'networks', 'objects', 'sessions', 'files', 'unknown'],
      bottomItemOrder: ['sessions', 'settings'],
    });

    expect(normalized.topItemOrder).toEqual([
      'files',
      'sessions',
      'worlds',
      'models',
    ]);
    expect(normalized.bottomItemOrder).toEqual(['settings', 'narre', 'terminal', 'agents', 'browser']);
  });

  it('falls back to defaults for invalid input', () => {
    expect(normalizeActivityBarLayoutConfig(null)).toEqual(DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG);
  });
});

describe('getVisibleOrderedItems', () => {
  it('keeps the stored order for currently available items only', () => {
    expect(
      getVisibleOrderedItems(['files', 'sessions', 'worlds', 'models'], ['worlds', 'files']),
    ).toEqual(['files', 'worlds']);
  });
});

describe('moveOrderedItem', () => {
  it('moves an item one slot in the requested direction', () => {
    expect(moveOrderedItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveOrderedItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
  });

  it('returns a copy when the move would leave bounds', () => {
    expect(moveOrderedItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});

