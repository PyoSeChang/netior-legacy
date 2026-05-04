import { describe, expect, it } from 'vitest';

import { getLayout, listLayouts } from '../components/workspace/layout-plugins/registry';

describe('layout registry', () => {
  it('returns freeform for unknown layout keys', () => {
    expect(getLayout('missing-layout').key).toBe('freeform');
  });

  it('maps the legacy horizontal timeline key to gantt', () => {
    const plugin = getLayout('horizontal-timeline');
    expect(plugin.key).toBe('gantt');
    expect(plugin.displayName).toBe('Gantt Chart');
  });

  it('registers timeline, calendar, and gantt as separate families', () => {
    const keys = listLayouts().map((plugin) => plugin.key);
    expect(keys).toEqual(['freeform', 'timeline', 'calendar', 'gantt']);
  });
});
