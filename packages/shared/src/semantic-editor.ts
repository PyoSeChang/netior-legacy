export type SemanticObjectType = 'instance' | 'file' | 'network' | 'schema' | 'model' | 'project' | 'agent' | 'context';

export interface ContentAnchor {
  kind: 'heading' | 'block' | 'text-range';
  id?: string;
  quote?: string;
  start?: number;
  end?: number;
}

export type SemanticTarget =
  | { kind: 'object'; objectType: SemanticObjectType; objectId: string }
  | { kind: 'instance_content'; instanceId: string; anchor?: ContentAnchor }
  | { kind: 'instance_properties'; instanceId: string; fieldIds?: string[] }
  | { kind: 'instance_property'; instanceId: string; fieldId: string }
  | { kind: 'interactive_view'; instanceId: string; templateId?: string | null }
  | { kind: 'network_view'; networkId: string }
  | { kind: 'file_preview'; fileId: string };

export type TargetProjection =
  | 'inline'
  | 'chip'
  | 'summary_card'
  | 'content'
  | 'property_value'
  | 'properties_table'
  | 'interactive_view'
  | 'network_preview'
  | 'file_preview';

export type EditorOccurrenceType = 'mention' | 'embed' | 'annotation';

export interface SemanticEditorToken {
  raw: string;
  from: number;
  to: number;
  occurrenceType: EditorOccurrenceType;
  target: SemanticTarget;
  label?: string;
  projection?: TargetProjection;
  fieldLabels?: string[];
  relationshipId?: string;
}

export interface SerializedSemanticTarget {
  target: string;
  label?: string;
  projection?: TargetProjection;
  fieldLabels?: string[];
  relationshipId?: string;
}

const MENTION_PATTERN = /\[\[target:([^[\]|]+)(?:\|([^\]]+))?\]\]/g;
const EMBED_PATTERN = /^::netior-embed\{([^}]*)\}[ \t]*$/gm;

function parseAttributeBody(body: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(body)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

export function parseSemanticTarget(value: string): SemanticTarget | null {
  const [head, anchor] = value.split('#', 2);
  const parts = head.split(':');
  const kind = parts[0];

  if (kind === 'instance' || kind === 'file' || kind === 'network' || kind === 'schema' || kind === 'model' || kind === 'project' || kind === 'agent' || kind === 'context') {
    const objectId = parts[1];
    if (!objectId) return null;
    return { kind: 'object', objectType: kind, objectId };
  }

  if (kind === 'instance-content') {
    const instanceId = parts[1];
    if (!instanceId) return null;
    return anchor
      ? { kind: 'instance_content', instanceId, anchor: { kind: 'heading', id: anchor } }
      : { kind: 'instance_content', instanceId };
  }

  if (kind === 'instance-properties') {
    const instanceId = parts[1];
    if (!instanceId) return null;
    const fieldIds = parts[2]?.split(',').map((item) => item.trim()).filter(Boolean);
    return fieldIds?.length
      ? { kind: 'instance_properties', instanceId, fieldIds }
      : { kind: 'instance_properties', instanceId };
  }

  if (kind === 'instance-property') {
    const instanceId = parts[1];
    const fieldId = parts[2];
    if (!instanceId || !fieldId) return null;
    return { kind: 'instance_property', instanceId, fieldId };
  }

  if (kind === 'interactive-view') {
    const instanceId = parts[1];
    if (!instanceId) return null;
    return { kind: 'interactive_view', instanceId, templateId: parts[2] ?? null };
  }

  if (kind === 'network-view') {
    const networkId = parts[1];
    return networkId ? { kind: 'network_view', networkId } : null;
  }

  if (kind === 'file-preview') {
    const fileId = parts[1];
    return fileId ? { kind: 'file_preview', fileId } : null;
  }

  return null;
}

export function serializeSemanticTarget(target: SemanticTarget): string {
  switch (target.kind) {
    case 'object':
      return `${target.objectType}:${target.objectId}`;
    case 'instance_content':
      return `instance-content:${target.instanceId}${target.anchor?.id ? `#${target.anchor.id}` : ''}`;
    case 'instance_properties':
      return `instance-properties:${target.instanceId}${target.fieldIds?.length ? `:${target.fieldIds.join(',')}` : ''}`;
    case 'instance_property':
      return `instance-property:${target.instanceId}:${target.fieldId}`;
    case 'interactive_view':
      return `interactive-view:${target.instanceId}${target.templateId ? `:${target.templateId}` : ''}`;
    case 'network_view':
      return `network-view:${target.networkId}`;
    case 'file_preview':
      return `file-preview:${target.fileId}`;
  }
}

export function createMentionToken({ target, label, relationshipId }: SerializedSemanticTarget): string {
  const rel = relationshipId ? `|rel:${relationshipId}` : '';
  return `[[target:${target}${label ? `|${label}${rel}` : rel ? rel.slice(1) : ''}]]`;
}

export function createEmbedToken({ target, projection, label, fieldLabels, relationshipId }: SerializedSemanticTarget): string {
  const attrs = [
    `target="${target}"`,
    projection ? `projection="${projection}"` : null,
    label ? `label="${label.replace(/"/g, '\\"')}"` : null,
    fieldLabels?.length ? `fieldLabels="${fieldLabels.map((item) => item.replace(/"/g, '\\"')).join('|')}"` : null,
    relationshipId ? `relationshipId="${relationshipId}"` : null,
  ].filter(Boolean);
  return `::netior-embed{${attrs.join(' ')}}`;
}

function splitLabelAndRelationship(rawLabel: string | undefined): { label?: string; relationshipId?: string } {
  if (!rawLabel) return {};
  const parts = rawLabel.split('|');
  const relPart = parts.find((part) => part.startsWith('rel:'));
  const label = parts.filter((part) => !part.startsWith('rel:')).join('|').trim();
  return {
    label: label || undefined,
    relationshipId: relPart?.slice(4) || undefined,
  };
}

export function parseSemanticEditorTokens(content: string): SemanticEditorToken[] {
  const tokens: SemanticEditorToken[] = [];
  let match: RegExpExecArray | null;

  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    const target = parseSemanticTarget(match[1]);
    if (!target) continue;
    const labelParts = splitLabelAndRelationship(match[2]);
    tokens.push({
      raw: match[0],
      from: match.index,
      to: match.index + match[0].length,
      occurrenceType: 'mention',
      target,
      ...labelParts,
    });
  }

  EMBED_PATTERN.lastIndex = 0;
  while ((match = EMBED_PATTERN.exec(content)) !== null) {
    const attrs = parseAttributeBody(match[1]);
    const target = attrs.target ? parseSemanticTarget(attrs.target) : null;
    if (!target) continue;
    tokens.push({
      raw: match[0],
      from: match.index,
      to: match.index + match[0].length,
      occurrenceType: 'embed',
      target,
      label: attrs.label || undefined,
      projection: attrs.projection as TargetProjection | undefined,
      fieldLabels: attrs.fieldLabels?.split('|').map((item) => item.trim()).filter(Boolean),
      relationshipId: attrs.relationshipId || undefined,
    });
  }

  return tokens.sort((left, right) => left.from - right.from);
}

export function getSemanticTargetDisplayFallback(target: SemanticTarget): string {
  switch (target.kind) {
    case 'object':
      return `${target.objectType}:${target.objectId}`;
    case 'instance_content':
      return target.anchor?.id ? `content:${target.instanceId}#${target.anchor.id}` : `content:${target.instanceId}`;
    case 'instance_properties':
      return target.fieldIds?.length ? `properties:${target.fieldIds.join(', ')}` : `properties:${target.instanceId}`;
    case 'instance_property':
      return `property:${target.fieldId}`;
    case 'interactive_view':
      return target.templateId ? `view:${target.templateId}` : `view:${target.instanceId}`;
    case 'network_view':
      return `network:${target.networkId}`;
    case 'file_preview':
      return `file:${target.fileId}`;
  }
}
