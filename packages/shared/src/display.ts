import type { TranslationKey } from './i18n';
import type { SourceKind } from './types';
import { getKindDisplayKey, getRelationKindDisplayKey } from './constants';

export type OntologyDisplayKind = 'world' | 'model' | 'kind' | 'relation_kind' | 'mcp_tool' | 'agent';

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface OntologyDisplaySource {
  kind: OntologyDisplayKind;
  key?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  source_kind?: SourceKind | null;
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

export interface DefinitionDisplaySource {
  key: string;
  name: string;
  description?: string | null;
  source_kind?: SourceKind | null;
  source_ref?: string | null;
}

function sourceRefTail(sourceRef: string, prefix: string): string | null {
  return sourceRef.startsWith(prefix) ? sourceRef.slice(prefix.length) : null;
}

function normalizeToolRef(source: OntologyDisplaySource): string | null {
  return source.source_ref ?? source.key ?? null;
}

export function toKindDisplaySource(kind: DefinitionDisplaySource): OntologyDisplaySource {
  return {
    kind: 'kind',
    key: kind.key,
    name: kind.name,
    description: kind.description ?? null,
    source_kind: kind.source_kind,
    source_ref: kind.source_ref,
  };
}

export function toRelationKindDisplaySource(relationKind: DefinitionDisplaySource): OntologyDisplaySource {
  return {
    kind: 'relation_kind',
    key: relationKind.key,
    name: relationKind.name,
    description: relationKind.description ?? null,
    source_kind: relationKind.source_kind,
    source_ref: relationKind.source_ref,
  };
}

export function getOntologyDisplayLabelKey(source: OntologyDisplaySource): string | null {
  if (source.kind === 'kind') {
    const key = sourceRefTail(source.source_ref ?? '', 'kind.') ?? source.key;
    return key ? `${getKindDisplayKey(key)}.name` : null;
  }

  if (source.kind === 'relation_kind') {
    const key = sourceRefTail(source.source_ref ?? '', 'relation-kind.') ?? source.key;
    return key ? `${getRelationKindDisplayKey(key)}.name` : null;
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
  if (source.kind === 'kind') {
    const key = sourceRefTail(source.source_ref ?? '', 'kind.') ?? source.key;
    return key ? `${getKindDisplayKey(key)}.description` : null;
  }

  if (source.kind === 'relation_kind') {
    const key = sourceRefTail(source.source_ref ?? '', 'relation-kind.') ?? source.key;
    return key ? `${getRelationKindDisplayKey(key)}.description` : null;
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
    kindName: (kind: DefinitionDisplaySource): string => getOntologyDisplayName(toKindDisplaySource(kind), t),
    kindDescription: (kind: DefinitionDisplaySource): string | null => getOntologyDisplayDescription(toKindDisplaySource(kind), t),
    kindOption: (kind: DefinitionDisplaySource & { id: string }): OntologyDisplayOption => ({
      value: kind.id,
      label: getOntologyDisplayName(toKindDisplaySource(kind), t),
      description: getOntologyDisplayDescription(toKindDisplaySource(kind), t),
    }),
    relationKindName: (relationKind: DefinitionDisplaySource): string => getOntologyDisplayName(toRelationKindDisplaySource(relationKind), t),
    relationKindDescription: (relationKind: DefinitionDisplaySource): string | null => getOntologyDisplayDescription(toRelationKindDisplaySource(relationKind), t),
  };
}
