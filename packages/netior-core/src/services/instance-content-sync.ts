import {
  getSemanticTargetDisplayFallback,
  parseSemanticEditorTokens,
  type SemanticEditorToken,
} from '@netior/shared';
import type { Schema, SchemaField, Instance } from '@netior/shared/types';
import { getDatabase, tableExists } from '../connection';

interface SerializeParams {
  instance: Instance;
  schema: Schema | null;
  fields: SchemaField[];
  properties: Record<string, string | null>;
}

/**
 * Serialize instance data to agent-readable flat text.
 *
 * Format:
 * # {title}
 * schema: {name}
 *
 * ## Properties
 * - {field}: {value}
 *
 * ## Content
 * {body}
 */
export function serializeToAgent(params: SerializeParams): string {
  const { instance, schema, fields, properties } = params;
  const lines: string[] = [];

  lines.push(`# ${instance.title}`);
  if (schema) {
    lines.push(`schema: ${schema.name}`);
  }
  lines.push('');

  if (fields.length > 0) {
    lines.push('## Properties');
    for (const field of fields) {
      const value = properties[field.name] ?? field.default_value ?? '';
      lines.push(`- ${field.name}: ${value}`);
    }
    lines.push('');
  }

  lines.push('## Content');
  lines.push(instance.content ?? '');

  const semanticReferences = resolveSemanticContentReferences(instance.content ?? '');
  if (semanticReferences.length > 0) {
    lines.push('');
    lines.push('## Resolved Content References');
    lines.push('The instance content contains Netior Editor semantic tokens. Use these resolved references instead of guessing from the raw token text.');
    semanticReferences.forEach((reference, index) => {
      lines.push('');
      lines.push(`${index + 1}. ${reference.occurrenceType}${reference.projection ? ` (${reference.projection})` : ''}`);
      lines.push(`- raw: ${reference.raw}`);
      lines.push(`- target: ${reference.targetLabel}`);
      if (reference.resolved.length > 0) {
        for (const item of reference.resolved) {
          lines.push(`- ${item.label}: ${item.value}`);
        }
      }
      if (reference.relationship.length > 0) {
        lines.push('- relationship:');
        for (const item of reference.relationship) {
          lines.push(`  - ${item.label}: ${item.value}`);
        }
      }
    });
  }

  return lines.join('\n');
}

interface ResolvedLine {
  label: string;
  value: string;
}

interface ResolvedSemanticContentReference {
  raw: string;
  occurrenceType: SemanticEditorToken['occurrenceType'];
  projection?: string;
  targetLabel: string;
  resolved: ResolvedLine[];
  relationship: ResolvedLine[];
}

function rowValue(row: Record<string, unknown> | undefined, key: string): string | null {
  const value = row?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function jsonPreview(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'string') return parsed;
    return JSON.stringify(parsed);
  } catch {
    return value;
  }
}

function resolveRelationshipLines(relationshipId: string | undefined): ResolvedLine[] {
  if (!relationshipId) return [];
  const db = getDatabase();
  if (!tableExists(db, 'relationships')) return [{ label: 'id', value: relationshipId }];

  const relationship = db.prepare(`
    SELECT r.id, r.meaning_id, r.description, r.properties_json, m.name AS meaning_name, m.key AS meaning_key
      FROM relationships r
      LEFT JOIN meanings m ON m.id = r.meaning_id
     WHERE r.id = ?
  `).get(relationshipId) as Record<string, unknown> | undefined;

  if (!relationship) return [{ label: 'id', value: `${relationshipId} (missing)` }];

  const lines: ResolvedLine[] = [{ label: 'id', value: relationshipId }];
  const meaningName = rowValue(relationship, 'meaning_name');
  const meaningKey = rowValue(relationship, 'meaning_key');
  if (meaningName || meaningKey) lines.push({ label: 'meaning', value: meaningKey ? `${meaningName ?? meaningKey} (${meaningKey})` : meaningName as string });
  const description = rowValue(relationship, 'description');
  if (description) lines.push({ label: 'description', value: description });
  const properties = jsonPreview(rowValue(relationship, 'properties_json'));
  if (properties) lines.push({ label: 'properties', value: properties });
  return lines;
}

function resolveSemanticTargetLines(token: SemanticEditorToken): ResolvedLine[] {
  const db = getDatabase();
  const target = token.target;

  if (target.kind === 'object') {
    const tableByType: Partial<Record<typeof target.objectType, { table: string; labelColumn: string; kindLabel: string }>> = {
      instance: { table: 'instances', labelColumn: 'title', kindLabel: 'instance' },
      schema: { table: 'schemas', labelColumn: 'name', kindLabel: 'schema' },
      meaning: { table: 'meanings', labelColumn: 'name', kindLabel: 'meaning' },
      network: { table: 'networks', labelColumn: 'name', kindLabel: 'network' },
      project: { table: 'projects', labelColumn: 'name', kindLabel: 'project' },
      file: { table: 'files', labelColumn: 'path', kindLabel: 'file' },
    };
    const config = tableByType[target.objectType];
    if (!config || !tableExists(db, config.table)) return [];
    const row = db.prepare(`SELECT ${config.labelColumn} AS label FROM ${config.table} WHERE id = ?`).get(target.objectId) as Record<string, unknown> | undefined;
    return [
      { label: 'kind', value: config.kindLabel },
      { label: 'id', value: target.objectId },
      ...(rowValue(row, 'label') ? [{ label: 'name', value: rowValue(row, 'label') as string }] : []),
    ];
  }

  if (target.kind === 'instance_content') {
    const row = db.prepare('SELECT title, content FROM instances WHERE id = ?').get(target.instanceId) as Record<string, unknown> | undefined;
    const content = rowValue(row, 'content');
    return [
      { label: 'kind', value: 'instance_content' },
      { label: 'instance_id', value: target.instanceId },
      ...(rowValue(row, 'title') ? [{ label: 'instance_title', value: rowValue(row, 'title') as string }] : []),
      ...(target.anchor?.id ? [{ label: 'anchor', value: target.anchor.id }] : []),
      ...(content ? [{ label: 'content_preview', value: content.slice(0, 500) }] : []),
    ];
  }

  if (target.kind === 'instance_property') {
    const row = db.prepare(`
      SELECT i.title AS instance_title, f.name AS field_name, p.value AS property_value
        FROM instances i
        LEFT JOIN schema_fields f ON f.id = ?
        LEFT JOIN instance_properties p ON p.instance_id = i.id AND p.field_id = ?
       WHERE i.id = ?
    `).get(target.fieldId, target.fieldId, target.instanceId) as Record<string, unknown> | undefined;
    return [
      { label: 'kind', value: 'instance_property' },
      { label: 'instance_id', value: target.instanceId },
      ...(rowValue(row, 'instance_title') ? [{ label: 'instance_title', value: rowValue(row, 'instance_title') as string }] : []),
      { label: 'field_id', value: target.fieldId },
      ...(rowValue(row, 'field_name') ? [{ label: 'field_name', value: rowValue(row, 'field_name') as string }] : []),
      ...(jsonPreview(rowValue(row, 'property_value')) ? [{ label: 'value', value: jsonPreview(rowValue(row, 'property_value')) as string }] : []),
    ];
  }

  if (target.kind === 'instance_properties') {
    const instance = db.prepare('SELECT title FROM instances WHERE id = ?').get(target.instanceId) as Record<string, unknown> | undefined;
    const rows = db.prepare(`
      SELECT f.id AS field_id, f.name AS field_name, p.value AS property_value
        FROM instance_properties p
        JOIN schema_fields f ON f.id = p.field_id
       WHERE p.instance_id = ?
       ORDER BY f.sort_order, f.name
    `).all(target.instanceId) as Record<string, unknown>[];
    const fieldFilter = target.fieldIds ? new Set(target.fieldIds) : null;
    const values = rows
      .filter((row) => !fieldFilter || fieldFilter.has(rowValue(row, 'field_id') ?? ''))
      .slice(0, 20)
      .map((row) => `${rowValue(row, 'field_name') ?? rowValue(row, 'field_id')}: ${jsonPreview(rowValue(row, 'property_value')) ?? ''}`);
    return [
      { label: 'kind', value: 'instance_properties' },
      { label: 'instance_id', value: target.instanceId },
      ...(rowValue(instance, 'title') ? [{ label: 'instance_title', value: rowValue(instance, 'title') as string }] : []),
      ...(values.length > 0 ? [{ label: 'values', value: values.join('; ') }] : []),
    ];
  }

  if (target.kind === 'interactive_view') {
    const instance = db.prepare('SELECT title FROM instances WHERE id = ?').get(target.instanceId) as Record<string, unknown> | undefined;
    const template = target.templateId && tableExists(db, 'interactive_view_templates')
      ? db.prepare('SELECT name, description FROM interactive_view_templates WHERE id = ?').get(target.templateId) as Record<string, unknown> | undefined
      : undefined;
    return [
      { label: 'kind', value: 'interactive_view' },
      { label: 'instance_id', value: target.instanceId },
      ...(rowValue(instance, 'title') ? [{ label: 'instance_title', value: rowValue(instance, 'title') as string }] : []),
      ...(target.templateId ? [{ label: 'template_id', value: target.templateId }] : []),
      ...(rowValue(template, 'name') ? [{ label: 'template_name', value: rowValue(template, 'name') as string }] : []),
      ...(rowValue(template, 'description') ? [{ label: 'template_description', value: rowValue(template, 'description') as string }] : []),
    ];
  }

  if (target.kind === 'network_view') {
    const row = db.prepare('SELECT name, kind FROM networks WHERE id = ?').get(target.networkId) as Record<string, unknown> | undefined;
    return [
      { label: 'kind', value: 'network_view' },
      { label: 'network_id', value: target.networkId },
      ...(rowValue(row, 'name') ? [{ label: 'network_name', value: rowValue(row, 'name') as string }] : []),
      ...(rowValue(row, 'kind') ? [{ label: 'network_kind', value: rowValue(row, 'kind') as string }] : []),
    ];
  }

  if (target.kind === 'file_preview') {
    const row = db.prepare('SELECT path, type FROM files WHERE id = ?').get(target.fileId) as Record<string, unknown> | undefined;
    return [
      { label: 'kind', value: 'file_preview' },
      { label: 'file_id', value: target.fileId },
      ...(rowValue(row, 'path') ? [{ label: 'path', value: rowValue(row, 'path') as string }] : []),
      ...(rowValue(row, 'type') ? [{ label: 'file_type', value: rowValue(row, 'type') as string }] : []),
    ];
  }

  return [];
}

export function resolveSemanticContentReferences(content: string): ResolvedSemanticContentReference[] {
  return parseSemanticEditorTokens(content).map((token) => ({
    raw: token.raw,
    occurrenceType: token.occurrenceType,
    projection: token.projection,
    targetLabel: token.label ?? getSemanticTargetDisplayFallback(token.target),
    resolved: resolveSemanticTargetLines(token),
    relationship: resolveRelationshipLines(token.relationshipId),
  }));
}

interface ParsedResult {
  title: string | null;
  properties: Record<string, string>;
  content: string | null;
}

/**
 * Parse agent flat text back into structured data.
 */
export function parseFromAgent(agentContent: string, fields: SchemaField[]): ParsedResult {
  const result: ParsedResult = {
    title: null,
    properties: {},
    content: null,
  };

  const lines = agentContent.split('\n');
  let section: 'header' | 'properties' | 'content' | 'resolvedReferences' = 'header';
  const contentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ') && section === 'header') {
      result.title = line.slice(2).trim();
      continue;
    }

    if (line.trim() === '## Properties') {
      section = 'properties';
      continue;
    }

    if (line.trim() === '## Content') {
      section = 'content';
      continue;
    }

    if (line.trim() === '## Resolved Content References') {
      section = 'resolvedReferences';
      continue;
    }

    if (section === 'properties' && line.startsWith('- ')) {
      const colonIdx = line.indexOf(':', 2);
      if (colonIdx !== -1) {
        const key = line.slice(2, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        // Match by field name
        const field = fields.find((f) => f.name === key);
        if (field) {
          result.properties[field.id] = value;
        }
      }
    }

    if (section === 'content') {
      contentLines.push(line);
    }
  }

  result.content = contentLines.join('\n').trim() || null;

  return result;
}

/**
 * Render a file template by replacing {{field_name}} placeholders with values.
 */
export function renderTemplate(
  template: string,
  fields: SchemaField[],
  properties: Record<string, string | null>,
): string {
  let result = template;
  for (const field of fields) {
    const value = properties[field.name] ?? field.default_value ?? '';
    result = result.replace(new RegExp(`\\{\\{${field.name}\\}\\}`, 'g'), value);
  }
  return result;
}
