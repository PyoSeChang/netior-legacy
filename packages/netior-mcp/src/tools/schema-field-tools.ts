import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { FieldMeaningBindingKey, SchemaFieldBindingCreate } from '@netior/shared/types';
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
const fieldBindingSchema = z.object({
  model_id: z.string().nullable().optional(),
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

const ADVANCED_FIELD_BEHAVIORS = new Set(['conditional_field', 'computed_field', 'derived_collection']);

function normalizeFieldBindings(bindings?: FieldBindingInput[]): SchemaFieldBindingCreate[] | undefined {
  if (!bindings) return undefined;
  return bindings.map((binding) => {
    const { dsl_config, ...rest } = binding;
    if (!ADVANCED_FIELD_BEHAVIORS.has(binding.binding_kind)) {
      return rest;
    }

    const config = dsl_config ?? parseRawDslConfig(binding.config, binding.binding_kind);
    const validation = validateNetiorDslFieldBehaviorConfig(config);
    if (!validation.ok) {
      const details = validation.errors.map((error) => `${error.path}: ${error.message}`).join('; ');
      throw new Error(`${binding.binding_kind} requires a valid Netior DSL field behavior config (${details})`);
    }
    if (config.kind !== binding.binding_kind) {
      throw new Error(`Field behavior config kind "${config.kind}" does not match binding kind "${binding.binding_kind}"`);
    }

    return {
      ...rest,
      config: JSON.stringify(config),
    };
  });
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
    model_id: binding.model_id,
    binding_kind: binding.binding_kind,
    source_schema_id: binding.source_schema_id,
    source_field_id: binding.source_field_id,
    cardinality: binding.cardinality,
    read_only: binding.read_only,
    config: binding.config,
    sort_order: binding.sort_order,
  };
}

const meaningBindingSchema = z.string().regex(
  /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
  'Meaning binding keys must be dotted lowercase paths such as time.due or temporal.deadline',
);

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
      meaning_bindings: z.array(meaningBindingSchema).optional().describe('Optional semantic meaning bindings for this field'),
      generated_by_model: z.boolean().optional().describe('Whether this field was generated by a model'),
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
      meaning_bindings,
      generated_by_model,
    }) => {
      try {
        const result = await createSchemaField({
          schema_id: schema_id,
          name,
          field_type: fromAgentFieldType(field_type as AgentFieldType),
          sort_order,
          required,
          default_value,
          options,
          bindings: normalizeFieldBindings(bindings),
          meaning_bindings: meaning_bindings as FieldMeaningBindingKey[] | undefined,
          generated_by_model,
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
      meaning_bindings: z.array(meaningBindingSchema).optional().describe('New semantic meaning bindings for this field'),
      generated_by_model: z.boolean().optional().describe('Whether this field was generated by a model'),
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
      meaning_bindings,
      generated_by_model,
    }) => {
      try {
        const result = await updateSchemaField(field_id, {
          name,
          field_type: field_type ? fromAgentFieldType(field_type as AgentFieldType) : undefined,
          sort_order,
          required,
          default_value,
          options,
          bindings: normalizeFieldBindings(bindings),
          meaning_bindings: meaning_bindings as FieldMeaningBindingKey[] | undefined,
          generated_by_model,
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
        const fields = await listSchemaFields(schema_id);
        const field = fields.find((item) => item.id === field_id);
        if (!field) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema field not found in schema ${schema_id}: ${field_id}` }],
            isError: true,
          };
        }

        const dslConfig: NetiorDslFieldBehaviorConfig = {
          version: 1,
          kind,
          ...(effect ? { effect } : {}),
          expression: expression as NetiorDslFieldBehaviorConfig['expression'],
        };
        const bindings = normalizeFieldBindings([
          ...field.bindings.filter((binding) => binding.binding_kind !== kind).map(bindingToCreate),
          {
            binding_kind: kind,
            cardinality: 'none',
            read_only: kind !== 'conditional_field',
            dsl_config: dslConfig,
            sort_order: field.bindings.length,
          },
        ]);

        const result = await updateSchemaField(field_id, { bindings });
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
