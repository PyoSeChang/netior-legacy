import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MeaningRefKey } from '@netior/shared/types';
import {
  listSchemas,
  createSchema,
  updateSchema,
  deleteSchema,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { toAgentSchema } from './schema-surface.js';

const modelKeySchema = z.string().regex(
  /^[a-z][a-z0-9_]*$/,
  'Meaning keys must be lowercase snake_case, such as task_flow',
);
const modelKeysSchema = z.array(modelKeySchema);

export function registerSchemaTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_schemas',
    { project_id: projectIdSchema() },
    async ({ project_id }) => {
      try {
        const result = (await listSchemas(resolveProjectId(project_id))).map(toAgentSchema);
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
    'create_schema',
    {
      project_id: projectIdSchema(),
      name: z.string().describe('Schema name'),
      icon: z.string().optional().describe('Icon identifier'),
      color: z.string().optional().describe('Color value'),
      description: z.string().optional().describe('Schema description'),
      file_template: z.string().nullable().optional().describe('Optional file template for new instances'),
      meanings: modelKeysSchema.optional().describe('Meaning keys attached to this schema'),
    },
    async ({ project_id, name, icon, color, description, file_template, meanings }) => {
      try {
        const result = await createSchema({
          project_id: resolveProjectId(project_id),
          name,
          icon,
          color,
          description,
          file_template: file_template ?? undefined,
          meanings: meanings as MeaningRefKey[] | undefined,
        });
        emitChange({ type: 'schema', action: 'create', id: result.id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentSchema(result), null, 2) }],
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
    'update_schema',
    {
      schema_id: z.string().describe('The schema ID to update'),
      name: z.string().optional().describe('New name'),
      icon: z.string().optional().describe('New icon identifier'),
      color: z.string().optional().describe('New color value'),
      description: z.string().optional().describe('New description'),
      file_template: z.string().nullable().optional().describe('New file template or null'),
      meanings: modelKeysSchema.optional().describe('New meaning keys attached to this schema'),
    },
    async ({ schema_id, name, icon, color, description, file_template, meanings }) => {
      try {
        const result = await updateSchema(schema_id, {
          name,
          icon,
          color,
          description,
          file_template,
          meanings: meanings as MeaningRefKey[] | undefined,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema not found: ${schema_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schema', action: 'update', id: schema_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentSchema(result), null, 2) }],
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
    'delete_schema',
    { schema_id: z.string().describe('The schema ID to delete') },
    async ({ schema_id }) => {
      try {
        const deleted = await deleteSchema(schema_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema not found: ${schema_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schema', action: 'delete', id: schema_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: schema_id }) }],
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
