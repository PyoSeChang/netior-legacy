import { describe, expect, it } from 'vitest';
import {
  fromConceptOptionValue,
  parseSchemaFieldOptions,
  stringifySchemaFieldOptions,
  toConceptOptionValue,
} from '../lib/schema-field-options';

describe('model field options', () => {
  it('parses empty field options as empty choices and concept sources', () => {
    expect(parseSchemaFieldOptions(null)).toEqual({
      choices: [],
      conceptOptionSourceIds: [],
    });
  });

  it('round-trips direct choices and concept option sources together', () => {
    const serialized = stringifySchemaFieldOptions({
      choices: ['manual'],
      conceptOptionSourceIds: ['job-model'],
    });

    expect(parseSchemaFieldOptions(serialized)).toEqual({
      choices: ['manual'],
      conceptOptionSourceIds: ['job-model'],
    });
  });

  it('namespaces concept option values', () => {
    expect(toConceptOptionValue('concept-id')).toBe('concept:concept-id');
    expect(fromConceptOptionValue('concept:concept-id')).toBe('concept-id');
    expect(fromConceptOptionValue('manual')).toBeNull();
  });
});
