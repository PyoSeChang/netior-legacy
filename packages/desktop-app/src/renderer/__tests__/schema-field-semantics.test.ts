import { describe, expect, it } from 'vitest';
import {
  fromInstanceOptionValue,
  parseSchemaFieldOptions,
  stringifySchemaFieldOptions,
  toInstanceOptionValue,
} from '../lib/schema-field-options';

describe('model field options', () => {
  it('parses empty field options as empty choices', () => {
    expect(parseSchemaFieldOptions(null)).toEqual({
      choices: [],
    });
  });

  it('round-trips direct choices', () => {
    const serialized = stringifySchemaFieldOptions({
      choices: ['manual'],
    });

    expect(parseSchemaFieldOptions(serialized)).toEqual({
      choices: ['manual'],
    });
  });

  it('namespaces instance option values', () => {
    expect(toInstanceOptionValue('instance-id')).toBe('instance:instance-id');
    expect(fromInstanceOptionValue('instance:instance-id')).toBe('instance-id');
    expect(fromInstanceOptionValue('manual')).toBeNull();
  });
});
