import { describe, expect, it } from 'vitest';
import {
  createOntologyDisplayResolver,
  getOntologyDisplayDescriptionKey,
  getOntologyDisplayLabelKey,
  toMeaningDisplaySource,
} from '../display';

const translations: Record<string, string> = {
  'semantic.meaning.contains.label': 'Contains',
  'semantic.meaning.contains.description': 'Shows containment',
  'semantic.category.time.label': 'Time',
  'semantic.category.time.description': 'Temporal category',
  'narre.tools.create_schema.name': 'Create Schema',
  'narre.tools.create_schema.description': 'Creates schemas',
};

const t = (key: string) => translations[key] ?? key;

describe('ontology display resolver', () => {
  it('resolves built-in meaning display text from source metadata', () => {
    const display = createOntologyDisplayResolver(t);
    const meaning = {
      id: 'm1',
      key: 'contains',
      name: 'Fallback Contains',
      description: 'Fallback description',
      source_kind: 'system' as const,
      source_ref: 'meaning.contains',
    };

    expect(display.meaningName(meaning)).toBe('Contains');
    expect(display.meaningDescription(meaning)).toBe('Shows containment');
    expect(display.meaningOption(meaning)).toEqual({
      value: 'm1',
      label: 'Contains',
      description: 'Shows containment',
    });
  });

  it('uses instance source_ref for meaning category instances', () => {
    const display = createOntologyDisplayResolver(t);
    const source = {
      kind: 'instance' as const,
      title: 'Fallback Time',
      description: 'Fallback description',
      source_kind: 'system' as const,
      source_ref: 'meaning-category.time',
    };

    expect(getOntologyDisplayLabelKey(source)).toBe('semantic.category.time.label');
    expect(getOntologyDisplayDescriptionKey(source)).toBe('semantic.category.time.description');
    expect(display.name(source)).toBe('Time');
    expect(display.description(source)).toBe('Temporal category');
  });

  it('falls back to stored text when localization is missing', () => {
    const display = createOntologyDisplayResolver(t);
    const source = toMeaningDisplaySource({
      key: 'custom.meaning',
      name: 'Custom Meaning',
      description: 'Project-owned meaning',
      source_kind: 'project',
      source_ref: null,
    });

    expect(display.name(source)).toBe('Custom Meaning');
    expect(display.description(source)).toBe('Project-owned meaning');
  });

  it('resolves MCP tool display text through the shared Narre tool namespace', () => {
    const display = createOntologyDisplayResolver(t);
    const source = {
      kind: 'mcp_tool' as const,
      key: 'create_schema',
      name: 'Fallback Create Schema',
      description: 'Fallback description',
    };

    expect(getOntologyDisplayLabelKey(source)).toBe('narre.tools.create_schema.name');
    expect(getOntologyDisplayDescriptionKey(source)).toBe('narre.tools.create_schema.description');
    expect(display.name(source)).toBe('Create Schema');
    expect(display.description(source)).toBe('Creates schemas');
  });
});
