import { describe, expect, it } from 'vitest';
import { parseFromAgent } from '../services/instance-content-sync';
import type { SchemaField } from '@netior/shared/types';

const field = {
  id: 'field-status',
  name: 'Status',
} as SchemaField;

describe('instance-content-sync', () => {
  it('does not import resolved content references back into instance content', () => {
    const parsed = parseFromAgent([
      '# Task',
      '',
      '## Properties',
      '- Status: Active',
      '',
      '## Content',
      'Body with [[target:instance:inst-1|Instance One]].',
      '',
      '## Resolved Content References',
      '1. mention',
      '- raw: [[target:instance:inst-1|Instance One]]',
      '- target: Instance One',
    ].join('\n'), [field]);

    expect(parsed.title).toBe('Task');
    expect(parsed.properties).toEqual({ 'field-status': 'Active' });
    expect(parsed.content).toBe('Body with [[target:instance:inst-1|Instance One]].');
  });
});
