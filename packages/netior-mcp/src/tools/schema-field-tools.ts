import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { FieldMeaningBindingKey, SchemaField, SchemaFieldBindingCreate } from '@netior/shared/types';
import type { NetiorDslFieldBehaviorConfig } from '@netior/shared/dsl';
import { validateNetiorDslFieldBehaviorConfig } from '@netior/shared/dsl';
import {
  createSchemaField,
  deleteSchemaField,
  listSchemaFields,
  reorderSchemaFields,
  updateSchemaField,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';
import { fromAgentFieldType, toAgentSchemaField, type AgentFieldType } from './schema-surface.js';

const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi-select',
  'radio',
  'relation',
  'object',
  'file',
  'url',
  'color',
  'rating',
  'tags',
]);
const bindingKindSchema = z.enum([
  'instance_select',
  'instance_multi_select',
  'schema_composition',
  'schema_extension',
  'conditional_field',
  'computed_field',
  'derived_collection',
]);
const bindingCardinalitySchema = z.enum(['none', 'one', 'many', 'object']);
const dslConfigSchema = z.record(z.string(), z.unknown());
const dslScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const fieldBehaviorSchema = z.enum([
  'none',
  'schema_composition',
  'schema_extension',
  'conditional_field',
  'computed_field',
  'derived_collection',
]);
const fieldBindingSchema = z.object({
  meaning_id: z.string().nullable().optional(),
  binding_kind: bindingKindSchema,
  source_schema_id: z.string().nullable().optional(),
  source_field_id: z.string().nullable().optional(),
  cardinality: bindingCardinalitySchema.optional(),
  read_only: z.boolean().optional(),
  config: z.string().nullable().optional().describe('Legacy raw JSON string config. Prefer dsl_config for advanced field behaviors.'),
  dsl_config: dslConfigSchema.optional().describe('Required structured Netior DSL config for conditional_field, computed_field, or derived_collection bindings.'),
  sort_order: z.number().optional(),
});

type FieldBindingInput = z.infer<typeof fieldBindingSchema>;
type FieldBehaviorInput = z.infer<typeof fieldBehaviorSchema>;

const ADVANCED_FIELD_BEHAVIORS = new Set(['conditional_field', 'computed_field', 'derived_collection']);

function normalizeFieldBindings(bindings?: FieldBindingInput[]): SchemaFieldBindingCreate[] | undefined {
  if (!bindings) return undefined;
  return bindings.map((binding) => {
    const base: SchemaFieldBindingCreate = {
      meaning_id: binding.meaning_id,
      binding_kind: binding.binding_kind,
      source_schema_id: binding.source_schema_id,
      source_field_id: binding.source_field_id,
      cardinality: binding.cardinality,
      read_only: binding.read_only,
      config: binding.config,
      sort_order: binding.sort_order,
    };
    if (!ADVANCED_FIELD_BEHAVIORS.has(binding.binding_kind)) {
      return base;
    }

    const config = binding.dsl_config ?? parseRawDslConfig(binding.config, binding.binding_kind);
    const validation = validateNetiorDslFieldBehaviorConfig(config);
    if (!validation.ok) {
      const details = validation.errors.map((error) => `${error.path}: ${error.message}`).join('; ');
      throw new Error(`${binding.binding_kind} requires a valid Netior DSL field behavior config (${details})`);
    }
    if (config.kind !== binding.binding_kind) {
      throw new Error(`Field behavior config kind "${config.kind}" does not match binding kind "${binding.binding_kind}"`);
    }

    return {
      ...base,
      config: JSON.stringify(config),
    };
  });
}

function createBindingFromBehavior(
  behavior: FieldBehaviorInput | undefined,
  sourceSchemaId?: string | null,
): FieldBindingInput[] | undefined {
  if (!behavior) return undefined;
  if (behavior === 'none') return [];
  if (behavior === 'schema_composition') {
    return [{
      binding_kind: 'schema_composition',
      source_schema_id: sourceSchemaId,
      cardinality: 'object',
    }];
  }
  if (behavior === 'schema_extension') {
    return [{
      binding_kind: 'schema_extension',
      source_schema_id: sourceSchemaId,
      cardinality: 'object',
    }];
  }
  throw new Error(`${behavior} requires set_field_behavior_dsl or a bindings entry with dsl_config.`);
}

function createChoiceSourceBinding(
  fieldType: AgentFieldType | undefined,
  sourceSchemaId?: string | null,
): FieldBindingInput[] | undefined {
  if (!fieldType || !sourceSchemaId) {
    return undefined;
  }
  if (fieldType === 'multi-select') {
    return [{
      binding_kind: 'instance_multi_select',
      source_schema_id: sourceSchemaId,
      cardinality: 'many',
    }];
  }
  if (fieldType === 'select' || fieldType === 'radio' || fieldType === 'relation') {
    return [{
      binding_kind: 'instance_select',
      source_schema_id: sourceSchemaId,
      cardinality: 'one',
    }];
  }
  return undefined;
}

function parseRawDslConfig(config: string | null | undefined, bindingKind: string): NetiorDslFieldBehaviorConfig {
  if (!config || config.trim().length === 0) {
    throw new Error(`${bindingKind} binding requires dsl_config. Users should describe the domain; Narre must generate this config.`);
  }
  try {
    return JSON.parse(config) as NetiorDslFieldBehaviorConfig;
  } catch {
    throw new Error(`${bindingKind} binding config must be valid JSON DSL, not prose or an empty placeholder.`);
  }
}

function bindingToCreate(binding: FieldBindingInput | NonNullable<Awaited<ReturnType<typeof listSchemaFields>>[number]['bindings']>[number]): SchemaFieldBindingCreate {
  return {
    meaning_id: binding.meaning_id,
    binding_kind: binding.binding_kind,
    source_schema_id: binding.source_schema_id,
    source_field_id: binding.source_field_id,
    cardinality: binding.cardinality,
    read_only: binding.read_only,
    config: binding.config,
    sort_order: binding.sort_order,
  };
}

async function setFieldBehaviorDsl(
  schemaId: string,
  fieldId: string,
  config: NetiorDslFieldBehaviorConfig,
): Promise<SchemaField | null> {
  const fields = await listSchemaFields(schemaId);
  const field = fields.find((item) => item.id === fieldId);
  if (!field) return null;

  const bindings = normalizeFieldBindings([
    ...field.bindings.filter((binding) => binding.binding_kind !== config.kind).map(bindingToCreate),
    {
      binding_kind: config.kind,
      cardinality: 'none',
      read_only: config.kind !== 'conditional_field',
      config: JSON.stringify(config),
      sort_order: field.bindings.length,
    },
  ]);

  return updateSchemaField(fieldId, { bindings });
}

const meaningBindingSchema = z.string().regex(
  /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
  'Meaning binding keys must be dotted lowercase paths such as time.due or temporal.deadline',
);

function normalizeChoiceOptions(options: string | null | undefined): string | null | undefined {
  if (options === undefined || options === null) {
    return options;
  }

  const trimmed = options.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as { choices?: unknown };
    if (Array.isArray(parsed.choices)) {
      const choices = parsed.choices.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      return choices.length > 0 ? JSON.stringify({ choices }) : null;
    }
  } catch {
    // Accept the documented comma-separated form and persist Netior's structured option shape.
  }

  const choices = trimmed
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return choices.length > 0 ? JSON.stringify({ choices }) : null;
}

export function registerSchemaFieldTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_schema_fields',
    { schema_id: z.string().describe('The schema ID') },
    async ({ schema_id }) => {
      try {
        const result = (await listSchemaFields(schema_id)).map(toAgentSchemaField);
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
    'create_schema_field',
    {
      schema_id: z.string().describe('The schema ID'),
      name: z.string().describe('Field name'),
      field_type: fieldTypeSchema.describe('Field value type'),
      sort_order: z.number().describe('Field order index'),
      required: z.boolean().optional().describe('Whether the field is required'),
      default_value: z.string().optional().describe('Default value'),
      options: z.string().optional().describe('Comma-separated inline options for select-like fields'),
      bindings: z.array(fieldBindingSchema).optional().describe('Field interpretation bindings. conditional_field, computed_field, and derived_collection require valid dsl_config; users should never provide this manually.'),
      behavior: fieldBehaviorSchema.optional().describe('Convenience UI behavior. Prefer bindings for full control; schema_composition and schema_extension are converted into field bindings. Advanced behaviors require set_field_behavior_dsl.'),
      source_schema_id: z.string().nullable().optional().describe('Source schema used with behavior or instance-select bindings.'),
      meaning_bindings: z.array(meaningBindingSchema).optional().describe('Optional semantic meaning bindings for this field'),
      generated_by_meaning: z.boolean().optional().describe('Whether this field was generated by a meaning'),
    },
    async ({
      schema_id,
      name,
      field_type,
      sort_order,
      required,
      default_value,
      options,
      bindings,
      behavior,
      source_schema_id,
      meaning_bindings,
      generated_by_meaning,
    }) => {
      try {
        const resolvedBindings = bindings
          ?? createBindingFromBehavior(behavior, source_schema_id)
          ?? createChoiceSourceBinding(field_type as AgentFieldType, source_schema_id);
        const result = await createSchemaField({
          schema_id: schema_id,
          name,
          field_type: fromAgentFieldType(field_type as AgentFieldType),
          sort_order,
          required,
          default_value,
          options: normalizeChoiceOptions(options) ?? undefined,
          bindings: normalizeFieldBindings(resolvedBindings),
          meaning_bindings: meaning_bindings as FieldMeaningBindingKey[] | undefined,
          generated_by_meaning,
        });
        emitChange({ type: 'schemaField', action: 'create', id: result.id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentSchemaField(result), null, 2) }],
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
    'update_schema_field',
    {
      field_id: z.string().describe('The field ID to update'),
      name: z.string().optional().describe('New field name'),
      field_type: fieldTypeSchema.optional().describe('New field value type'),
      sort_order: z.number().optional().describe('New field order index'),
      required: z.boolean().optional().describe('Whether the field is required'),
      default_value: z.string().nullable().optional().describe('New default value'),
      options: z.string().nullable().optional().describe('New comma-separated inline options'),
      bindings: z.array(fieldBindingSchema).optional().describe('Replace field interpretation bindings. conditional_field, computed_field, and derived_collection require valid dsl_config; prefer set_field_behavior_dsl.'),
      behavior: fieldBehaviorSchema.optional().describe('Convenience UI behavior. Prefer bindings for full control; schema_composition and schema_extension are converted into field bindings. Advanced behaviors require set_field_behavior_dsl.'),
      source_schema_id: z.string().nullable().optional().describe('Source schema used with behavior or instance-select bindings.'),
      meaning_bindings: z.array(meaningBindingSchema).optional().describe('New semantic meaning bindings for this field'),
      generated_by_meaning: z.boolean().optional().describe('Whether this field was generated by a meaning'),
    },
    async ({
      field_id,
      name,
      field_type,
      sort_order,
      required,
      default_value,
      options,
      bindings,
      behavior,
      source_schema_id,
      meaning_bindings,
      generated_by_meaning,
    }) => {
      try {
        const resolvedBindings = bindings
          ?? createBindingFromBehavior(behavior, source_schema_id)
          ?? createChoiceSourceBinding(field_type as AgentFieldType | undefined, source_schema_id);
        const result = await updateSchemaField(field_id, {
          name,
          field_type: field_type ? fromAgentFieldType(field_type as AgentFieldType) : undefined,
          sort_order,
          required,
          default_value,
          options: normalizeChoiceOptions(options),
          bindings: normalizeFieldBindings(resolvedBindings),
          meaning_bindings: meaning_bindings as FieldMeaningBindingKey[] | undefined,
          generated_by_meaning,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema field not found: ${field_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schemaField', action: 'update', id: field_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentSchemaField(result), null, 2) }],
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
    'set_conditional_field_visibility',
    {
      schema_id: z.string().describe('Schema that owns the field whose visibility is being configured.'),
      target_field_id: z.string().describe('Field that should be shown or hidden.'),
      condition_field_id: z.string().describe('Field to compare. If via_field_id is provided, this field belongs to the referenced instance.'),
      equals: dslScalarSchema.describe('Value that makes the target field visible.'),
      via_field_id: z.string().optional().describe('Optional relation/instance-select field on the current object that points to the object containing condition_field_id.'),
    },
    async ({ schema_id, target_field_id, condition_field_id, equals, via_field_id }) => {
      try {
        const subject = via_field_id
          ? { op: 'field.object' as const, of: { op: 'context.object' as const }, fieldId: via_field_id }
          : { op: 'context.object' as const };
        const result = await setFieldBehaviorDsl(schema_id, target_field_id, {
          version: 1,
          kind: 'conditional_field',
          effect: 'visible',
          expression: {
            op: 'equals',
            left: {
              op: 'field.value',
              of: subject,
              fieldId: condition_field_id,
            },
            right: {
              op: 'literal',
              value: equals,
            },
          },
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema field not found in schema ${schema_id}: ${target_field_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schemaField', action: 'update', id: target_field_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentSchemaField(result), null, 2) }],
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
    'set_field_behavior_dsl',
    {
      schema_id: z.string().describe('Schema that owns the field. Narre should use the schema it just inspected or created.'),
      field_id: z.string().describe('Concrete field ID to configure. Use exact IDs from list_schema_fields or create_schema_field output.'),
      kind: z.enum(['conditional_field', 'computed_field', 'derived_collection']).describe('Advanced field behavior to configure.'),
      effect: z.enum(['visible', 'required']).optional().describe('Effect for conditional_field. Use visible for "only show when..." requests.'),
      expression: dslConfigSchema.describe('Netior DSL JSON AST expression generated by Narre from the user domain request.'),
    },
    async ({ schema_id, field_id, kind, effect, expression }) => {
      try {
        const dslConfig: NetiorDslFieldBehaviorConfig = {
          version: 1,
          kind,
          ...(effect ? { effect } : {}),
          expression: expression as unknown as NetiorDslFieldBehaviorConfig['expression'],
        };
        const result = await setFieldBehaviorDsl(schema_id, field_id, dslConfig);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema field not found in schema ${schema_id}: ${field_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schemaField', action: 'update', id: field_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentSchemaField(result), null, 2) }],
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
    'delete_schema_field',
    { field_id: z.string().describe('The field ID to delete') },
    async ({ field_id }) => {
      try {
        const deleted = await deleteSchemaField(field_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema field not found: ${field_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schemaField', action: 'delete', id: field_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: field_id }) }],
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
    'reorder_schema_fields',
    {
      schema_id: z.string().describe('The schema ID'),
      ordered_ids: z.array(z.string()).describe('Field IDs in the desired order'),
    },
    async ({ schema_id, ordered_ids }) => {
      try {
        const success = await reorderSchemaFields(schema_id, ordered_ids);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success, schema_id, ordered_ids }, null, 2) }],
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
