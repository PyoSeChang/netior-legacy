import { getNarreToolMetadata, normalizeNetiorToolName } from '@netior/shared/constants';
import type { NarreOperationPreview } from '@netior/shared/types';
import {
  getNetworkTree,
  listModels,
  listSchemaFields,
  listSchemas,
  listTypeGroups,
} from './netior-service-client.js';

interface OperationPreviewContext {
  projectId: string;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function formatOptional(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return null;
}

function genericMutationPreview(toolName: string, input: Record<string, unknown>): NarreOperationPreview | null {
  const metadata = getNarreToolMetadata(toolName);
  if (!metadata.isMutation) return null;

  const items = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .slice(0, 8)
    .map(([label, value]) => ({
      label,
      value: formatOptional(value) ?? JSON.stringify(value),
      ...(label === 'icon' ? { kind: 'icon' as const } : {}),
      ...(label === 'color' ? { kind: 'color' as const } : {}),
      ...(label === 'node_shape' ? { kind: 'node_shape' as const } : {}),
    }));

  return {
    toolKey: normalizeNetiorToolName(toolName),
    title: metadata.displayName,
    ...(metadata.description ? { description: metadata.description } : {}),
    summary: metadata.description ?? `Run ${normalizeNetiorToolName(toolName)}`,
    ...(items.length > 0 ? { items } : {}),
  };
}

function createPreview(
  toolName: string,
  preview: Omit<NarreOperationPreview, 'toolKey' | 'description'>,
): NarreOperationPreview {
  const metadata = getNarreToolMetadata(toolName);
  return {
    toolKey: normalizeNetiorToolName(toolName),
    ...preview,
    ...(metadata.description ? { description: metadata.description } : {}),
  };
}

async function appendSchemaContext(
  context: OperationPreviewContext,
  preview: NarreOperationPreview,
  input: Record<string, unknown>,
): Promise<NarreOperationPreview> {
  const schemas = await listSchemas(context.projectId);
  const schemaId = asString(input.schema_id);
  const requestedName = asString(input.name);
  const existing = requestedName
    ? schemas.find((schema) => schema.name.toLowerCase() === requestedName.toLowerCase())
    : null;
  const modelKeys = asStringList(input.models);
  const groupId = asString(input.group_id);

  preview.items = (preview.items ?? []).filter((item) => {
    const normalizedLabel = item.label.toLowerCase();
    return normalizedLabel !== 'schema id'
      && normalizedLabel !== 'schema_id'
      && normalizedLabel !== 'group id'
      && normalizedLabel !== 'group_id'
      && normalizedLabel !== 'models';
  });

  if (groupId) {
    const groups = await listTypeGroups(context.projectId, 'schema');
    const group = groups.find((candidate) => candidate.id === groupId);
    preview.items = [
      ...(preview.items ?? []),
      { label: 'Group', value: group?.name ?? 'Unknown group' },
    ];
  }

  if (modelKeys.length > 0) {
    const models = await listModels(context.projectId);
    const previewModels = modelKeys.map((key) => {
      const model = models.find((candidate) => candidate.key === key || candidate.id === key);
      return model
        ? {
          key: String(model.key),
          name: model.name,
          description: model.description,
          built_in: model.built_in,
        }
        : {
          key,
          name: key,
          built_in: false,
        };
    });
    preview.items = [
      ...(preview.items ?? []).filter((item) => item.label.toLowerCase() !== 'models'),
      {
        label: 'Models',
        value: previewModels.map((model) => model.name).join(', '),
        kind: 'model_list',
        models: previewModels,
      },
    ];
  }

  if (!requestedName && schemaId) {
    const schema = schemas.find((candidate) => candidate.id === schemaId);
    if (schema) {
      preview.title = `${preview.title}: ${schema.name}`;
    }
  }

  if (existing) {
    preview.details = [
      ...(preview.details ?? []),
      `A schema named "${existing.name}" already exists.`,
    ];
  }

  return preview;
}

async function appendSchemaFieldContext(
  context: OperationPreviewContext,
  preview: NarreOperationPreview,
  input: Record<string, unknown>,
): Promise<NarreOperationPreview> {
  const schemaId = asString(input.schema_id);
  if (!schemaId) return preview;

  const schemas = await listSchemas(context.projectId);
  const schema = schemas.find((candidate) => candidate.id === schemaId);
  const fields = await listSchemaFields(schemaId);
  const requestedName = asString(input.name);
  const existingField = requestedName
    ? fields.find((field) => field.name.toLowerCase() === requestedName.toLowerCase())
    : null;
  const referenceSchemaId = asString(input.ref_schema_id);
  const referenceSchema = referenceSchemaId
    ? schemas.find((candidate) => candidate.id === referenceSchemaId)
    : null;

  preview.items = [
    { label: 'Schema', value: schema ? schema.name : schemaId },
    ...(preview.items ?? [])
      .filter((item) => item.label !== 'Schema ID' && item.label !== 'Schema')
      .map((item) => (
        item.label === 'Reference schema' && referenceSchema
          ? { ...item, value: referenceSchema.name }
          : item
      )),
  ];

  if (existingField) {
    preview.details = [
      ...(preview.details ?? []),
      `A field named "${existingField.name}" already exists on this schema.`,
    ];
  }

  return preview;
}

async function appendConceptContext(
  context: OperationPreviewContext,
  preview: NarreOperationPreview,
  input: Record<string, unknown>,
): Promise<NarreOperationPreview> {
  const schemaId = asString(input.schema_id);
  if (!schemaId) return preview;

  const schemas = await listSchemas(context.projectId);
  const schema = schemas.find((candidate) => candidate.id === schemaId);
  if (!schema) return preview;

  preview.items = [
    ...(preview.items ?? []).filter((item) => item.label !== 'Schema ID'),
    { label: 'Schema', value: schema.name },
  ];
  return preview;
}

async function appendNetworkContext(
  context: OperationPreviewContext,
  preview: NarreOperationPreview,
  input: Record<string, unknown>,
): Promise<NarreOperationPreview> {
  const requestedName = asString(input.name);
  const parentId = asString(input.parent_network_id);
  if (!requestedName && !parentId) return preview;

  const tree = await getNetworkTree(context.projectId);
  const flat = flattenNetworkTree(tree);
  const existing = requestedName
    ? flat.find((network) => network.name.toLowerCase() === requestedName.toLowerCase())
    : null;
  const parent = parentId ? flat.find((network) => network.id === parentId) : null;

  preview.items = [
    ...(preview.items ?? []).filter((item) => item.label !== 'Parent network'),
    ...(parentId ? [{ label: 'Parent network', value: parent?.name ?? parentId }] : []),
  ];

  if (existing) {
    preview.details = [
      ...(preview.details ?? []),
      `A network named "${existing.name}" already exists.`,
    ];
  }

  return preview;
}

function flattenNetworkTree(nodes: Awaited<ReturnType<typeof getNetworkTree>>): Array<{ id: string; name: string }> {
  const result: Array<{ id: string; name: string }> = [];
  const visit = (node: Awaited<ReturnType<typeof getNetworkTree>>[number]): void => {
    result.push({ id: node.id, name: node.name });
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  nodes.forEach(visit);
  return result;
}

async function withContext(
  context: OperationPreviewContext,
  toolName: string,
  input: Record<string, unknown>,
  preview: NarreOperationPreview,
): Promise<NarreOperationPreview> {
  try {
    switch (normalizeNetiorToolName(toolName)) {
      case 'create_schema':
      case 'update_schema':
        return await appendSchemaContext(context, preview, input);
      case 'create_schema_field':
        return await appendSchemaFieldContext(context, preview, input);
      case 'create_concept':
        return await appendConceptContext(context, preview, input);
      case 'create_network':
        return await appendNetworkContext(context, preview, input);
      default:
        return preview;
    }
  } catch {
    return preview;
  }
}

export async function buildNarreOperationPreview(
  context: OperationPreviewContext,
  toolName: string,
  input: Record<string, unknown>,
): Promise<NarreOperationPreview | null> {
  const normalizedToolName = normalizeNetiorToolName(toolName);

  switch (normalizedToolName) {
    case 'create_schema': {
      const name = asString(input.name) ?? 'Untitled schema';
      const models = asStringList(input.models);
      const items: NarreOperationPreview['items'] = [
        { label: 'Name', value: name },
        ...(asString(input.description) ? [{ label: 'Description', value: asString(input.description)! }] : []),
        ...(asString(input.icon) ? [{ label: 'Icon', value: asString(input.icon)!, kind: 'icon' as const }] : []),
        ...(asString(input.color) ? [{ label: 'Color', value: asString(input.color)!, kind: 'color' as const }] : []),
        ...(asString(input.node_shape) ? [{ label: 'Node shape', value: asString(input.node_shape)!, kind: 'node_shape' as const }] : []),
        ...(models.length > 0 ? [{ label: 'Models', value: models.join(', '), kind: 'model_list' as const }] : []),
        ...(input.file_template !== undefined ? [{ label: 'File template', value: formatOptional(input.file_template) ?? 'set' }] : []),
      ];
      return withContext(context, normalizedToolName, input, createPreview(normalizedToolName, {
        title: `Create schema: ${name}`,
        summary: models.length > 0
          ? `createSchemaWithModels:${models.length}`
          : 'createSchema',
        items,
      }));
    }

    case 'update_schema': {
      const changes = ['name', 'description', 'icon', 'color', 'node_shape', 'file_template', 'group_id', 'models']
        .filter((key) => input[key] !== undefined);
      return withContext(context, normalizedToolName, input, createPreview(normalizedToolName, {
        title: `Update schema${asString(input.name) ? `: ${asString(input.name)}` : ''}`,
        summary: `updateSchemaSettings:${changes.length || 1}`,
        items: [
          { label: 'Schema ID', value: asString(input.schema_id) ?? 'unknown' },
          ...changes.map((key) => ({
            label: key,
            value: Array.isArray(input[key])
              ? input[key].join(', ')
              : formatOptional(input[key]) ?? JSON.stringify(input[key]),
            ...(key === 'models' ? { kind: 'model_list' as const } : {}),
            ...(key === 'icon' ? { kind: 'icon' as const } : {}),
            ...(key === 'color' ? { kind: 'color' as const } : {}),
            ...(key === 'node_shape' ? { kind: 'node_shape' as const } : {}),
          })),
        ],
      }));
    }

    case 'create_schema_field': {
      const name = asString(input.name) ?? 'Untitled field';
      const meanings = asStringList(input.meaning_bindings);
      const optionalItems: NarreOperationPreview['items'] = [
        ...(asString(input.options) ? [{ label: 'Options', value: asString(input.options)! }] : []),
        ...(asString(input.ref_schema_id) ? [{ label: 'Reference schema', value: asString(input.ref_schema_id)! }] : []),
        ...(meanings.length > 0 ? [{ label: 'Meaning bindings', value: meanings.join(', ') }] : []),
      ];
      return withContext(context, normalizedToolName, input, createPreview(normalizedToolName, {
        title: `Create field: ${name}`,
        summary: 'createSchemaField',
        items: [
          { label: 'Schema ID', value: asString(input.schema_id) ?? 'unknown' },
          { label: 'Name', value: name },
          ...(asString(input.description) ? [{ label: 'Description', value: asString(input.description)! }] : []),
          { label: 'Field type', value: asString(input.field_type) ?? 'unknown' },
          ...optionalItems,
          ...(input.required !== undefined ? [{ label: 'Required', value: String(Boolean(input.required)) }] : []),
        ],
      }));
    }

    case 'create_model': {
      const name = asString(input.name) ?? asString(input.key) ?? 'Untitled model';
      const meanings = asStringList(input.meaning_keys);
      return withContext(context, normalizedToolName, input, createPreview(normalizedToolName, {
        title: `Create model: ${name}`,
        summary: 'createModel',
        items: [
          ...(asString(input.key) ? [{ label: 'Key', value: asString(input.key)! }] : []),
          ...(asString(input.category) ? [{ label: 'Category', value: asString(input.category)! }] : []),
          ...(asString(input.target_kind) ? [{ label: 'Target', value: asString(input.target_kind)! }] : []),
          ...(meanings.length > 0 ? [{ label: 'Meanings', value: meanings.join(', ') }] : []),
          ...(input.recipe ? [{ label: 'Recipe', value: 'Custom recipe included' }] : []),
        ],
      }));
    }

    case 'create_concept': {
      const title = asString(input.title) ?? 'Untitled concept';
      return withContext(context, normalizedToolName, input, createPreview(normalizedToolName, {
        title: `Create concept: ${title}`,
        summary: 'createConcept',
        items: [
          ...(asString(input.schema_id) ? [{ label: 'Schema ID', value: asString(input.schema_id)! }] : []),
          ...(asString(input.icon) ? [{ label: 'Icon', value: asString(input.icon)!, kind: 'icon' as const }] : []),
          ...(asString(input.color) ? [{ label: 'Color', value: asString(input.color)!, kind: 'color' as const }] : []),
          ...(asString(input.profile_image) ? [{ label: 'Profile image', value: asString(input.profile_image)! }] : []),
        ],
      }));
    }

    case 'create_network': {
      const name = asString(input.name) ?? 'Untitled network';
      return withContext(context, normalizedToolName, input, createPreview(normalizedToolName, {
        title: `Create network: ${name}`,
        summary: input.project_id === null ? 'createAppNetwork' : 'createProjectNetwork',
        items: [
          ...(asString(input.scope) ? [{ label: 'Scope', value: asString(input.scope)! }] : []),
          ...(asString(input.parent_network_id) ? [{ label: 'Parent network', value: asString(input.parent_network_id)! }] : []),
        ],
      }));
    }

    case 'create_type_group': {
      const name = asString(input.name) ?? 'Untitled group';
      return createPreview(normalizedToolName, {
        title: `Create type group: ${name}`,
        summary: 'createTypeGroup',
        items: [
          ...(asString(input.kind) ? [{ label: 'Kind', value: asString(input.kind)! }] : []),
          { label: 'Name', value: name },
          ...(input.sort_order !== undefined ? [{ label: 'Sort order', value: formatOptional(input.sort_order) ?? '0' }] : []),
        ],
      });
    }

    case 'update_type_group': {
      const changes = ['name', 'sort_order'].filter((key) => input[key] !== undefined);
      return createPreview(normalizedToolName, {
        title: `Update type group${asString(input.name) ? `: ${asString(input.name)}` : ''}`,
        summary: `updateTypeGroup:${changes.length || 1}`,
        items: [
          ...(asString(input.group_id) ? [{ label: 'Group ID', value: asString(input.group_id)! }] : []),
          ...changes.map((key) => ({
            label: key,
            value: formatOptional(input[key]) ?? JSON.stringify(input[key]),
          })),
        ],
      });
    }

    default:
      return genericMutationPreview(normalizedToolName, input);
  }
}
