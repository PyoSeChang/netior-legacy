import { describe, expect, it } from 'vitest';
import {
  createOntologyDisplayResolver,
  getOntologyDisplayDescriptionKey,
  getOntologyDisplayLabelKey,
  toModelDisplaySource,
} from '../display';

const translations: Record<string, string> = {
  'semantic.model.contains.label': 'Contains',
  'semantic.model.contains.description': 'Shows containment',
  'semantic.category.time.label': 'Time',
  'semantic.category.time.description': 'Temporal category',
};

const t = (key: string) => translations[key] ?? key;

describe('ontology display resolver', () => {
  it('resolves built-in model display text from source metadata', () => {
    const display = createOntologyDisplayResolver(t);
    const model = {
      id: 'm1',
      key: 'contains',
      name: 'Fallback Contains',
      description: 'Fallback description',
      source_kind: 'system' as const,
      source_ref: 'model.contains',
    };

    expect(display.modelName(model)).toBe('Contains');
    expect(display.modelDescription(model)).toBe('Shows containment');
    expect(display.modelOption(model)).toEqual({
      value: 'm1',
      label: 'Contains',
      description: 'Shows containment',
    });
  });

  it('uses instance source_ref for model category instances', () => {
    const display = createOntologyDisplayResolver(t);
    const source = {
      kind: 'instance' as const,
      title: 'Fallback Time',
      description: 'Fallback description',
      source_kind: 'system' as const,
      source_ref: 'model-category.time',
    };

    expect(getOntologyDisplayLabelKey(source)).toBe('semantic.category.time.label');
    expect(getOntologyDisplayDescriptionKey(source)).toBe('semantic.category.time.description');
    expect(display.name(source)).toBe('Time');
    expect(display.description(source)).toBe('Temporal category');
  });

  it('falls back to stored text when localization is missing', () => {
    const display = createOntologyDisplayResolver(t);
    const source = toModelDisplaySource({
      key: 'custom.model',
      name: 'Custom Model',
      description: 'Project-owned model',
      source_kind: 'project',
      source_ref: null,
    });

    expect(display.name(source)).toBe('Custom Model');
    expect(display.description(source)).toBe('Project-owned model');
  });
});
