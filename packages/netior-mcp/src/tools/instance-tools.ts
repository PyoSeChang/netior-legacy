import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getInstancesByWorld,
  searchInstances,
  createInstance,
  updateInstance,
  deleteInstance,
  getInstanceProperties,
  listSchemaFields,
} from '../netior-service-client.js';
import type { Instance, InstanceProperty, SchemaField } from '@netior/shared/types';
import { emitChange } from '../events.js';
import { rootNetworkIdSchema, registerNetiorTool, resolveRootNetworkId } from './shared-tool-registry.js';
import { toAgentInstance } from './schema-surface.js';

const instancePropertyFilterSchema = z.object({
  field_id: z.string().optional().describe('Exact field ID to filter by'),
  field_name: z.string().optional().describe('Field name to resolve within the target schema'),
  meaning_binding: z.string().optional().describe('Meaning binding key to resolve within the target schema'),
  value: z.string().describe('Expected serialized value, instance ID, or option value'),
  match: z.enum(['equals', 'contains']).optional().describe('Whether to require exact match or substring/array containment'),
});

type InstancePropertyFilterInput = z.infer<typeof instancePropertyFilterSchema>;
type ResolvedInstancePropertyFilter = {
  field_id: string;
  value: string;
  match: 'equals' | 'contains';
};

function normalizeOptionalVisualValue(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveInstanceVisualValue(input: {
  icon?: string | null;
  profile_image?: string | null;
}): string | null | undefined {
  const icon = normalizeOptionalVisualValue(input.icon);
  const profileImage = normalizeOptionalVisualValue(input.profile_image);

  if (icon !== undefined && profileImage !== undefined) {
    if (icon && profileImage) {
      throw new Error('Provide either icon or profile_image, not both');
    }

    return profileImage ?? icon ?? null;
  }

  return profileImage !== undefined ? profileImage : icon;
}

function tryParseSerializedValue(value: string | null): unknown {
  if (value == null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function matchesNestedValue(actual: unknown, expectedLower: string, match: 'equals' | 'contains'): boolean {
  if (actual == null) {
    return false;
  }

  if (typeof actual === 'string') {
    const normalized = actual.toLowerCase();
    return match === 'equals' ? normalized === expectedLower : normalized.includes(expectedLower);
  }

  if (typeof actual === 'number' || typeof actual === 'boolean') {
    const normalized = String(actual).toLowerCase();
    return match === 'equals' ? normalized === expectedLower : normalized.includes(expectedLower);
  }

  if (Array.isArray(actual)) {
    return actual.some((item) => matchesNestedValue(item, expectedLower, match));
  }

  if (typeof actual === 'object') {
    return Object.values(actual as Record<string, unknown>).some((item) => matchesNestedValue(item, expectedLower, match));
  }

  return false;
}

function matchesPropertyValue(
  property: InstanceProperty | undefined,
  expected: string,
  match: 'equals' | 'contains',
): boolean {
  if (!property) {
    return false;
  }

  return matchesNestedValue(tryParseSerializedValue(property.value), expected.toLowerCase(), match);
}

async function resolvePropertyFilters(
  schemaId: string | undefined,
  propertyFilters: InstancePropertyFilterInput[] | undefined,
): Promise<ResolvedInstancePropertyFilter[]> {
  if (!propertyFilters || propertyFilters.length === 0) {
    return [];
  }

  const requiresSchemaResolution = propertyFilters.some((filter) => !filter.field_id);
  if (requiresSchemaResolution && !schemaId) {
    throw new Error('schema_id is required when filtering instances by field_name or meaning_binding');
  }

  const fieldMapById = new Map<string, SchemaField>();
  const fieldMapByName = new Map<string, SchemaField>();
  const fieldMapByMeaning = new Map<string, SchemaField>();

  if (schemaId) {
    const fields = await listSchemaFields(schemaId);
    for (const field of fields) {
      fieldMapById.set(field.id, field);
      fieldMapByName.set(field.name, field);
      for (const meaning of field.meaning_bindings ?? []) {
        if (!fieldMapByMeaning.has(meaning)) {
          fieldMapByMeaning.set(meaning, field);
        }
      }
    }
  }

  return propertyFilters.map((filter) => {
    const resolvedField = filter.field_id
      ? fieldMapById.get(filter.field_id) ?? ({ id: filter.field_id } as SchemaField)
      : filter.field_name
        ? fieldMapByName.get(filter.field_name)
        : filter.meaning_binding
          ? fieldMapByMeaning.get(filter.meaning_binding)
          : undefined;

    if (!resolvedField?.id) {
      const label = filter.field_name ?? filter.meaning_binding ?? filter.field_id ?? '(unknown filter)';
      throw new Error(`Could not resolve instance property filter: ${label}`);
    }

    return {
      field_id: resolvedField.id,
      value: filter.value,
      match: filter.match ?? 'equals',
    };
  });
}

async function filterInstancesByProperties(
  instances: Instance[],
  propertyFilters: ResolvedInstancePropertyFilter[],
): Promise<Instance[]> {
  if (propertyFilters.length === 0) {
    return instances;
  }

  const instancePropertiesById = new Map<string, InstanceProperty[]>(
    await Promise.all(
      instances.map(async (instance) => [instance.id, await getInstanceProperties(instance.id)] as const),
    ),
  );

  return instances.filter((instance) => {
    const properties = instancePropertiesById.get(instance.id) ?? [];
    const propertyMap = new Map(properties.map((property) => [property.field_id, property]));
    return propertyFilters.every((filter) =>
      matchesPropertyValue(propertyMap.get(filter.field_id), filter.value, filter.match),
    );
  });
}

export function registerInstanceTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_instances',
    {
      root_network_id: rootNetworkIdSchema(),
      query: z.string().optional().describe('Search query to filter instances by title'),
      schema_id: z.string().optional().describe('Optional schema ID to narrow the instance set'),
      property_filters: z.array(instancePropertyFilterSchema).optional().describe('Optional property filters resolved against the schema'),
    },
    async ({ root_network_id, query, schema_id, property_filters }) => {
      try {
        const targetRootNetworkId = resolveRootNetworkId(root_network_id);
        const baseInstances = query
          ? await searchInstances(targetRootNetworkId, query)
          : await getInstancesByWorld(targetRootNetworkId);
        const schemaInstances = schema_id
          ? baseInstances.filter((instance) => instance.schema_id === schema_id)
          : baseInstances;
        const resolvedFilters = await resolvePropertyFilters(schema_id, property_filters);
        const result = (await filterInstancesByProperties(schemaInstances, resolvedFilters)).map(toAgentInstance);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  registerNetiorTool(
    server,
    'create_instance',
    {
      root_network_id: rootNetworkIdSchema(),
      title: z.string().describe('Instance title'),
      schema_id: z.string().optional().describe('Schema ID to assign'),
      color: z.string().optional().describe('Color value'),
      icon: z.string().nullable().optional().describe('Icon identifier or emoji text. Use this when not setting profile_image.'),
      profile_image: z.string().nullable().optional().describe('Profile image source. Can be an image URL, data URL, file URL, or local file path. Stored in the instance icon field.'),
      content: z.string().nullable().optional().describe('Optional instance body content. May include Netior Editor semantic tokens such as [[target:...]] or ::netior-embed{...}.'),
    },
    async ({ root_network_id, title, schema_id, color, icon, profile_image, content }) => {
      try {
        const visual = resolveInstanceVisualValue({ icon, profile_image });
        const result = await createInstance({
          root_network_id: resolveRootNetworkId(root_network_id),
          title,
          schema_id: schema_id,
          color,
          ...(content !== undefined && content !== null ? { content } : {}),
          ...(visual !== undefined && visual !== null ? { icon: visual } : {}),
        });
        emitChange({ type: 'instance', action: 'create', id: result.id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentInstance(result), null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  registerNetiorTool(
    server,
    'update_instance',
    {
      instance_id: z.string().describe('The instance ID to update'),
      title: z.string().optional().describe('New title'),
      schema_id: z.string().optional().describe('New schema ID'),
      color: z.string().optional().describe('New color value'),
      icon: z.string().nullable().optional().describe('New icon identifier or emoji text. Use this when not setting profile_image.'),
      profile_image: z.string().nullable().optional().describe('New profile image source. Can be an image URL, data URL, file URL, or local file path. Stored in the instance icon field.'),
      content: z.string().nullable().optional().describe('New instance body content. May include Netior Editor semantic tokens such as [[target:...]] or ::netior-embed{...}.'),
    },
    async ({ instance_id, title, schema_id, color, icon, profile_image, content }) => {
      try {
        const visual = resolveInstanceVisualValue({ icon, profile_image });
        const result = await updateInstance(instance_id, {
          title,
          schema_id: schema_id,
          color,
          ...(content !== undefined ? { content } : {}),
          ...(visual !== undefined ? { icon: visual } : {}),
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Instance not found: ${instance_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'instance', action: 'update', id: instance_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentInstance(result), null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  registerNetiorTool(
    server,
    'delete_instance',
    { instance_id: z.string().describe('The instance ID to delete') },
    async ({ instance_id }) => {
      try {
        const deleted = await deleteInstance(instance_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Instance not found: ${instance_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'instance', action: 'delete', id: instance_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: instance_id }) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
