import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SchemaField } from '@netior/shared/types';
import { z } from 'zod';
import {
  getInstancesByProject,
  listSchemaFields,
  searchInstances,
} from '../netior-service-client.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { toAgentFieldType } from './schema-surface.js';

function parseInlineOptions(options: string | null): string[] {
  if (!options) {
    return [];
  }

  try {
    const parsed = JSON.parse(options) as { choices?: unknown };
    if (Array.isArray(parsed.choices)) {
      return parsed.choices.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    // Legacy inline options were stored as comma-separated text.
  }

  return options
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function findField(fields: SchemaField[], fieldId: string): SchemaField | undefined {
  return fields.find((field) => field.id === fieldId);
}

function getCandidateSourceSchemaId(field: SchemaField): string | null {
  return field.bindings.find((binding) => (
    binding.binding_kind === 'instance_select' || binding.binding_kind === 'instance_multi_select'
  ))?.source_schema_id ?? null;
}

export function registerCandidateSourceTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'get_field_candidates',
    {
      project_id: projectIdSchema(),
      schema_id: z.string().describe('The schema that owns the field'),
      field_id: z.string().describe('The field ID'),
      query: z.string().optional().describe('Optional search query for candidate instances'),
      max_results: z.number().optional().describe('Optional maximum number of candidates to return'),
    },
    async ({ project_id, schema_id, field_id, query, max_results }) => {
      try {
        const targetProjectId = resolveProjectId(project_id);
        const fields = await listSchemaFields(schema_id);
        const field = findField(fields, field_id);

        if (!field) {
          return {
            content: [{ type: 'text' as const, text: `Error: Field not found: ${field_id}` }],
            isError: true,
          };
        }

        const limit = Math.max(1, max_results ?? 50);

        const sourceSchemaId = getCandidateSourceSchemaId(field);
        if (sourceSchemaId) {
          const instances = query
            ? await searchInstances(targetProjectId, query)
            : await getInstancesByProject(targetProjectId);
          const filtered = instances
            .filter((instance) => instance.schema_id === sourceSchemaId)
            .slice(0, limit)
            .map((instance) => ({
              id: instance.id,
              title: instance.title,
              schema_id: instance.schema_id,
            }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                field: {
                  id: field.id,
                  name: field.name,
                  field_type: toAgentFieldType(field.field_type),
                  required: field.required,
                  source_schema_id: sourceSchemaId,
                },
                candidate_mode: 'instances_by_schema',
                candidates: filtered,
              }, null, 2),
            }],
          };
        }

        const inlineOptions = parseInlineOptions(field.options).slice(0, limit);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              field: {
                id: field.id,
                name: field.name,
                field_type: toAgentFieldType(field.field_type),
                required: field.required,
              },
              candidate_mode: 'inline_options',
              candidates: inlineOptions,
            }, null, 2),
          }],
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
