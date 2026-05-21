import { describe, expect, it } from 'vitest';
import {
  parseSemanticEditorTokens,
  parseSemanticTarget,
  serializeSemanticTarget,
} from '../semantic-editor';

describe('semantic editor tokens', () => {
  it('parses object and sub-target mentions', () => {
    const tokens = parseSemanticEditorTokens([
      'See [[target:instance:inst-1|Instance One]].',
      'Status is [[target:instance-property:inst-1:field-status|status]].',
    ].join('\n'));

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({
      occurrenceType: 'mention',
      label: 'Instance One',
      target: { kind: 'object', objectType: 'instance', objectId: 'inst-1' },
    });
    expect(tokens[1]).toMatchObject({
      occurrenceType: 'mention',
      label: 'status',
      target: { kind: 'instance_property', instanceId: 'inst-1', fieldId: 'field-status' },
    });
  });

  it('parses embed directives with projection and relationship id', () => {
    const tokens = parseSemanticEditorTokens(
      '::netior-embed{target="interactive-view:inst-1:tpl-1" projection="interactive_view" relationshipId="rel-1" label="Timeline"}',
    );

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      occurrenceType: 'embed',
      label: 'Timeline',
      projection: 'interactive_view',
      relationshipId: 'rel-1',
      target: { kind: 'interactive_view', instanceId: 'inst-1', templateId: 'tpl-1' },
    });
  });

  it('round-trips semantic targets', () => {
    const target = parseSemanticTarget('instance-properties:inst-1:field-a,field-b');
    expect(target).toEqual({
      kind: 'instance_properties',
      instanceId: 'inst-1',
      fieldIds: ['field-a', 'field-b'],
    });
    expect(target ? serializeSemanticTarget(target) : null).toBe('instance-properties:inst-1:field-a,field-b');
  });

  it('keeps object mentions separate from projection targets', () => {
    expect(parseSemanticTarget('file:file-1')).toEqual({
      kind: 'object',
      objectType: 'file',
      objectId: 'file-1',
    });
    expect(parseSemanticTarget('file-preview:file-1')).toEqual({
      kind: 'file_preview',
      fileId: 'file-1',
    });
  });
});
