import { describe, expect, it } from 'vitest';
import { validateInteractiveViewSource } from '../lib/interactive-view-validator';

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

describe('interactive view validator', () => {
  it('allows SDK-only source with declared field writes', () => {
    const result = validateInteractiveViewSource(`
      import { useUpdateField, Button } from '@netior/interactive-sdk';
      export function View() {
        const updateField = useUpdateField();
        return <Button onClick={() => updateField('field-a', 'ok')}>Save</Button>;
      }
    `, manifest);

    expect(result.ok).toBe(true);
    expect(result.runtime).toBe('host');
  });

  it('blocks renderer imports and forbidden globals', () => {
    const result = validateInteractiveViewSource(`
      import { useInstanceStore } from '@renderer/stores/instance-store';
      export function View() {
        window.electron.instance.getByProject('project');
        return null;
      }
    `, manifest);

    expect(result.ok).toBe(false);
    expect(result.runtime).toBe('sandbox');
    expect(result.issues.map((issue) => issue.code)).toContain('source.import_not_allowed');
    expect(result.issues.map((issue) => issue.code)).toContain('source.forbidden_global');
  });

  it('blocks field writes that are not declared in the manifest', () => {
    const result = validateInteractiveViewSource(`
      import { useUpdateField } from '@netior/interactive-sdk';
      export function View() {
        const updateField = useUpdateField();
        updateField('field-b', 'not declared');
        return null;
      }
    `, manifest);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('permissions.write_field_not_declared');
  });
});
