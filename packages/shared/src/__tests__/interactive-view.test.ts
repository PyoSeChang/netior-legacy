import { describe, expect, it } from 'vitest';
import { validateInteractiveViewSource } from '../interactive-view';

const manifest = JSON.stringify({
  kind: 'interactive-view',
  sdkVersion: 1,
  permissions: {
    readFields: ['field-a'],
    writeFields: ['field-a'],
    viewState: true,
  },
  runtime: 'host',
});

describe('interactive view contract validator', () => {
  it('accepts current Interactive SDK source and manifest', () => {
    const result = validateInteractiveViewSource(`
      import { useUpdateField, Button, ViewRoot, IconButton, Chip, Select, Checkbox, Toggle, TextInput, TextArea, Divider } from '@netior/interactive-sdk';
      export function View() {
        const updateField = useUpdateField();
        return (
          <ViewRoot>
            <IconButton icon="chevron-left" label="Previous" />
            <Chip>Tag</Chip>
            <Select value="a" options={[{ value: 'a', label: 'A' }]} onChange={() => {}} />
            <Checkbox checked={false} onChange={() => {}} />
            <Toggle checked={false} onChange={() => {}} />
            <TextInput value="" onChange={() => {}} />
            <TextArea value="" onChange={() => {}} />
            <Divider />
            <Button onClick={() => updateField('field-a', 'ok')}>Save</Button>
          </ViewRoot>
        );
      }
    `, manifest);

    expect(result.ok).toBe(true);
    expect(result.runtime).toBe('host');
  });

  it('rejects stale Interactive View imports and manifest shapes', () => {
    const result = validateInteractiveViewSource(`
      import { useField } from '@netior/interactive';
      export function View() {
        return null;
      }
    `, JSON.stringify({
      target: { kind: 'schema', schemaId: 'schema-a' },
      permissions: { fields: { read: ['*'], write: [] } },
    }));

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'manifest.invalid_kind',
      'manifest.unsupported_sdk',
      'source.import_not_allowed',
    ]));
  });

  it('requires DSL permission when DSL hooks are used', () => {
    const result = validateInteractiveViewSource(`
      import { useDslValue } from '@netior/interactive-sdk';
      export function View() {
        useDslValue({ kind: 'literal', value: true });
        return null;
      }
    `, manifest);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('permissions.dsl_not_declared');
  });

  it('rejects Interactive SDK imports that are not exported by the runtime', () => {
    const result = validateInteractiveViewSource(`
      import { useMemo } from 'react';
      import { useNotReal, useField as readField } from '@netior/interactive-sdk';
      export function View() {
        useMemo(() => null, []);
        useNotReal();
        readField('field-a');
        return null;
      }
    `, manifest);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('source.sdk_export_not_available');
    expect(result.issues[0].message).toContain('useNotReal');
  });

  it('rejects invented Netior DSL operators before runtime', () => {
    const result = validateInteractiveViewSource(`
      import { useDslObjects } from '@netior/interactive-sdk';
      export function View() {
        useDslObjects({
          op: 'objects',
          where: { op: 'eq', left: { op: 'field', fieldId: 'a' }, right: { op: 'literal', value: 1 } },
          orderBy: [{ fieldId: 'order', direction: 'asc' }],
          select: [{ op: 'id', as: 'id' }]
        });
        return null;
      }
    `, JSON.stringify({
      kind: 'interactive-view',
      sdkVersion: 1,
      permissions: { readFields: ['*'], writeFields: [], dsl: true },
      runtime: 'sandbox',
    }));

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'source.dsl_operator_not_available',
      'source.dsl_projection_not_available',
      'source.dsl_order_by_array_not_available',
    ]));
  });
});
