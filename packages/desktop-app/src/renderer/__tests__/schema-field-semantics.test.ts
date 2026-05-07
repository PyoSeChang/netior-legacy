import { describe, expect, it } from 'vitest';
import {
  fromInstanceOptionValue,
  parseSchemaFieldOptions,
  stringifySchemaFieldOptions,
  toInstanceOptionValue,
} from '../lib/schema-field-options';

describe('model field options', () => {
  it('parses empty field options as empty choices and instance sources', () => {
    expect(parseSchemaFieldOptions(null)).toEqual({
      choices: [],
      instanceOptionSourceIds: [],
    });
  });

  it('round-trips direct choices and instance option sources together', () => {
    const serialized = stringifySchemaFieldOptions({
      choices: ['manual'],
      instanceOptionSourceIds: ['job-model'],
    });

    expect(parseSchemaFieldOptions(serialized)).toEqual({
      choices: ['manual'],
      instanceOptionSourceIds: ['job-model'],
    });
  });

  it('namespaces instance option values', () => {
    expect(toInstanceOptionValue('instance-id')).toBe('instance:instance-id');
    expect(fromInstanceOptionValue('instance:instance-id')).toBe('instance-id');
    expect(fromInstanceOptionValue('manual')).toBeNull();
  });
});
