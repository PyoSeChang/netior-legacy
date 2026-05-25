import type { TranslationKey } from './i18n';
import type {
  Meaning,
  MeaningKey,
  OntologySourceKind,
  SemanticCategoryKey,
} from './types';
import {
  getMeaningDescriptionKey,
  getMeaningLabelKey,
  getSemanticCategoryDescriptionKey,
  getSemanticCategoryLabelKey,
} from './constants';

export type OntologyDisplayKind = 'meaning' | 'schema' | 'instance' | 'mcp_tool' | 'agent';

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface OntologyDisplaySource {
  kind: OntologyDisplayKind;
  key?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  source_kind?: OntologySourceKind | null;
  source_ref?: string | null;
}

export interface OntologyDisplayText {
  name: string;
  description: string | null;
  localized: boolean;
}

export interface OntologyDisplayOption {
  value: string;
  label: string;
  description: string | null;
}

export type MeaningDisplaySource = Pick<
  Meaning,
  'key' | 'name' | 'description' | 'source_kind' | 'source_ref'
>;

function sourceRefTail(sourceRef: string, prefix: string): string | null {
  return sourceRef.startsWith(prefix) ? sourceRef.slice(prefix.length) : null;
}

function normalizeToolRef(source: OntologyDisplaySource): string | null {
  return source.source_ref ?? source.key ?? null;
}

export function toMeaningDisplaySource(meaning: MeaningDisplaySource): OntologyDisplaySource {
  return {
    kind: 'meaning',
    key: meaning.key,
    name: meaning.name,
    description: meaning.description,
    source_kind: meaning.source_kind,
    source_ref: meaning.source_ref,
  };
}

export function getOntologyDisplayLabelKey(source: OntologyDisplaySource): string | null {
  if (source.kind === 'meaning') {
    const meaningKey = sourceRefTail(source.source_ref ?? '', 'meaning.') ?? source.key;
    return meaningKey ? getMeaningLabelKey(meaningKey as MeaningKey) : null;
  }

  if (source.kind === 'instance') {
    const categoryKey = sourceRefTail(source.source_ref ?? '', 'meaning-category.');
    return categoryKey ? getSemanticCategoryLabelKey(categoryKey as SemanticCategoryKey) : null;
  }

  if (source.kind === 'schema' && source.source_ref === 'schema.meaning_category') {
    return 'meaningCategory.schema.label';
  }

  if (source.kind === 'mcp_tool') {
    const toolRef = normalizeToolRef(source);
    return toolRef ? `narre.tools.${toolRef}.name` : null;
  }

  if (source.kind === 'agent') {
    const agentRef = normalizeToolRef(source);
    return agentRef ? `narre.agents.${agentRef}.name` : null;
  }

  return null;
}

export function getOntologyDisplayDescriptionKey(source: OntologyDisplaySource): string | null {
  if (source.kind === 'meaning') {
    const meaningKey = sourceRefTail(source.source_ref ?? '', 'meaning.') ?? source.key;
    return meaningKey ? getMeaningDescriptionKey(meaningKey as MeaningKey) : null;
  }

  if (source.kind === 'instance') {
    const categoryKey = sourceRefTail(source.source_ref ?? '', 'meaning-category.');
    return categoryKey ? getSemanticCategoryDescriptionKey(categoryKey as SemanticCategoryKey) : null;
  }

  if (source.kind === 'schema' && source.source_ref === 'schema.meaning_category') {
    return 'meaningCategory.schema.description';
  }

  if (source.kind === 'mcp_tool') {
    const toolRef = normalizeToolRef(source);
    return toolRef ? `narre.tools.${toolRef}.description` : null;
  }

  if (source.kind === 'agent') {
    const agentRef = normalizeToolRef(source);
    return agentRef ? `narre.agents.${agentRef}.description` : null;
  }

  return null;
}

function translateOptional(key: string | null, t: Translate): { value: string | null; localized: boolean } {
  if (!key) return { value: null, localized: false };
  const translated = t(key as TranslationKey);
  return translated === key
    ? { value: null, localized: false }
    : { value: translated, localized: true };
}

export function getOntologyDisplayName(source: OntologyDisplaySource, t: Translate): string {
  return translateOptional(getOntologyDisplayLabelKey(source), t).value
    ?? source.name
    ?? source.title
    ?? source.key
    ?? source.source_ref
    ?? '';
}

export function getOntologyDisplayDescription(source: OntologyDisplaySource, t: Translate): string | null {
  return translateOptional(getOntologyDisplayDescriptionKey(source), t).value
    ?? source.description
    ?? null;
}

export function getOntologyDisplayText(source: OntologyDisplaySource, t: Translate): OntologyDisplayText {
  const label = translateOptional(getOntologyDisplayLabelKey(source), t);
  const description = translateOptional(getOntologyDisplayDescriptionKey(source), t);
  return {
    name: label.value ?? source.name ?? source.title ?? source.key ?? source.source_ref ?? '',
    description: description.value ?? source.description ?? null,
    localized: label.localized || description.localized,
  };
}

export function createOntologyDisplayResolver(t: Translate) {
  return {
    name: (source: OntologyDisplaySource): string => getOntologyDisplayName(source, t),
    description: (source: OntologyDisplaySource): string | null => getOntologyDisplayDescription(source, t),
    text: (source: OntologyDisplaySource): OntologyDisplayText => getOntologyDisplayText(source, t),
    option: (value: string, source: OntologyDisplaySource): OntologyDisplayOption => ({
      value,
      label: getOntologyDisplayName(source, t),
      description: getOntologyDisplayDescription(source, t),
    }),
    meaningName: (meaning: MeaningDisplaySource): string => getOntologyDisplayName(toMeaningDisplaySource(meaning), t),
    meaningDescription: (meaning: MeaningDisplaySource): string | null => getOntologyDisplayDescription(toMeaningDisplaySource(meaning), t),
    meaningText: (meaning: MeaningDisplaySource): OntologyDisplayText => getOntologyDisplayText(toMeaningDisplaySource(meaning), t),
    meaningOption: (meaning: MeaningDisplaySource & { id: string }): OntologyDisplayOption => ({
      value: meaning.id,
      label: getOntologyDisplayName(toMeaningDisplaySource(meaning), t),
      description: getOntologyDisplayDescription(toMeaningDisplaySource(meaning), t),
    }),
  };
}
