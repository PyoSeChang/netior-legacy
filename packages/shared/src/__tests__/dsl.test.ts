import { describe, expect, it } from 'vitest';
import {
  validateNetiorDslExpression,
  validateNetiorDslFieldBehaviorConfig,
} from '../dsl';

describe('Netior DSL validation', () => {
  it('accepts known-target relative queries', () => {
    expect(validateNetiorDslExpression({
      op: 'relative',
      direction: 'next',
      scope: { op: 'instances', schemaId: 'schema-problem' },
      current: { op: 'context.object' },
      orderBy: { fieldId: 'field-order' },
    })).toEqual({ ok: true });
  });

  it('rejects field value expressions without a selector', () => {
    const result = validateNetiorDslExpression({
      op: 'field.value',
      of: { op: 'context.object' },
    });

    expect(result.ok).toBe(false);
  });

  it('accepts field object dereference expressions', () => {
    expect(validateNetiorDslExpression({
      op: 'field.value',
      of: {
        op: 'field.object',
        of: { op: 'context.object' },
        fieldId: 'field-character',
      },
      fieldId: 'field-job',
    })).toEqual({ ok: true });
  });

  it('accepts network concern scope expressions', () => {
    expect(validateNetiorDslExpression({
      op: 'objects.inNetwork',
      networkId: 'network-1',
    })).toEqual({ ok: true });
  });

  it('accepts field behavior config wrappers', () => {
    expect(validateNetiorDslFieldBehaviorConfig({
      version: 1,
      kind: 'conditional_field',
      effect: 'visible',
      expression: {
        op: 'equals',
        left: { op: 'field.value', of: { op: 'context.object' }, fieldId: 'field-status' },
        right: { op: 'literal', value: 'active' },
      },
    })).toEqual({ ok: true });
  });
});
