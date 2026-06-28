import { describe, expect, it } from 'vitest';
import {
  createOntologyDisplayResolver,
  getOntologyDisplayDescriptionKey,
  getOntologyDisplayLabelKey,
  toKindDisplaySource,
  toRelationKindDisplaySource,
} from '../display';

const translations: Record<string, string> = {
  'domain.kind.character.name': 'Character',
  'domain.kind.character.description': 'A story character',
  'domain.relationKind.appears_in.name': 'Appears In',
  'domain.relationKind.appears_in.description': 'Connects a character to a scene',
  'narre.tools.instance_create.name': 'Create Instance',
  'narre.tools.instance_create.description': 'Creates instances',
};

const t = (key: string) => translations[key] ?? key;

describe('ontology display resolver', () => {
  it('resolves built-in kind display text from source metadata', () => {
    const display = createOntologyDisplayResolver(t);
    const kind = {
      id: 'k1',
      key: 'character',
      name: 'Fallback Character',
      description: 'Fallback description',
      source_kind: 'system' as const,
      source_ref: 'kind.character',
    };

    expect(display.kindName(kind)).toBe('Character');
    expect(display.kindDescription(kind)).toBe('A story character');
    expect(display.kindOption(kind)).toEqual({
      value: 'k1',
      label: 'Character',
      description: 'A story character',
    });
  });

  it('resolves relation kind display text', () => {
    const display = createOntologyDisplayResolver(t);
    const source = toRelationKindDisplaySource({
      key: 'appears_in',
      name: 'Fallback Appears In',
      description: 'Fallback description',
      source_kind: 'system',
      source_ref: 'relation-kind.appears_in',
    });

    expect(getOntologyDisplayLabelKey(source)).toBe('domain.relationKind.appears_in.name');
    expect(getOntologyDisplayDescriptionKey(source)).toBe('domain.relationKind.appears_in.description');
    expect(display.name(source)).toBe('Appears In');
    expect(display.description(source)).toBe('Connects a character to a scene');
  });

  it('falls back to stored text when localization is missing', () => {
    const display = createOntologyDisplayResolver(t);
    const source = toKindDisplaySource({
      key: 'custom.kind',
      name: 'Custom Kind',
      description: 'World-owned kind',
      source_kind: 'user',
      source_ref: null,
    });

    expect(display.name(source)).toBe('Custom Kind');
    expect(display.description(source)).toBe('World-owned kind');
  });

  it('resolves MCP tool display text through the shared Narre tool namespace', () => {
    const display = createOntologyDisplayResolver(t);
    const source = {
      kind: 'mcp_tool' as const,
      key: 'instance_create',
      name: 'Fallback Create Instance',
      description: 'Fallback description',
    };

    expect(getOntologyDisplayLabelKey(source)).toBe('narre.tools.instance_create.name');
    expect(getOntologyDisplayDescriptionKey(source)).toBe('narre.tools.instance_create.description');
    expect(display.name(source)).toBe('Create Instance');
    expect(display.description(source)).toBe('Creates instances');
  });
});
