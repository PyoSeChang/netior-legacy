import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createInteractiveViewTemplate,
  listInteractiveViewTemplates,
  updateInteractiveViewTemplate,
  upsertInteractiveViewPreference,
  upsertInteractiveViewSchemaPreference,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';

const targetKindSchema = z.enum(['project', 'schema', 'instance']);
const sourceKindSchema = z.enum(['manual', 'narre']);
const trustLevelSchema = z.enum(['untrusted', 'validated', 'trusted']);
const runtimeSchema = z.enum(['host', 'sandbox']);
const validationStatusSchema = z.enum(['unknown', 'passed', 'failed']);

export function registerInteractiveViewTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_interactive_view_templates',
    {
      project_id: projectIdSchema(),
      schema_id: z.string().nullable().optional().describe('Optional schema ID to include schema-scoped templates'),
      instance_id: z.string().nullable().optional().describe('Optional instance ID to include instance-level override templates'),
    },
    async ({ project_id, schema_id, instance_id }) => {
      try {
        const result = await listInteractiveViewTemplates({
          projectId: resolveProjectId(project_id),
          schemaId: schema_id ?? undefined,
          instanceId: instance_id ?? undefined,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  registerNetiorTool(
    server,
    'create_interactive_view_template',
    {
      project_id: projectIdSchema(),
      target_kind: targetKindSchema.describe('Scope for the template'),
      target_id: z.string().nullable().optional().describe('Required for schema or instance templates; omit for project templates'),
      name: z.string().describe('User-facing template name'),
      description: z.string().nullable().optional(),
      source_code: z.string().describe('Restricted TSX source that exports View, InteractiveView, or default'),
      manifest_json: z.string().describe('Interactive view manifest JSON'),
      source_kind: sourceKindSchema.optional().describe('Use narre for Narre-generated templates'),
      trust_level: trustLevelSchema.optional(),
      default_runtime: runtimeSchema.optional(),
      enabled: z.number().optional(),
      validation_status: validationStatusSchema.optional(),
      validation_errors_json: z.string().optional(),
    },
    async ({ project_id, ...input }) => {
      try {
        const result = await createInteractiveViewTemplate({
          project_id: resolveProjectId(project_id),
          ...input,
        });
        emitChange({ type: 'interactiveViewTemplate', action: 'create', id: result.id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  registerNetiorTool(
    server,
    'update_interactive_view_template',
    {
      template_id: z.string().describe('Interactive view template ID'),
      target_kind: targetKindSchema.optional(),
      target_id: z.string().nullable().optional(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      source_code: z.string().optional(),
      manifest_json: z.string().optional(),
      source_kind: sourceKindSchema.optional(),
      trust_level: trustLevelSchema.optional(),
      default_runtime: runtimeSchema.optional(),
      enabled: z.number().optional(),
      validation_status: validationStatusSchema.optional(),
      validation_errors_json: z.string().optional(),
    },
    async ({ template_id, ...input }) => {
      try {
        const result = await updateInteractiveViewTemplate(template_id, input);
        if (!result) {
          return { content: [{ type: 'text' as const, text: `Error: Template not found: ${template_id}` }], isError: true };
        }
        emitChange({ type: 'interactiveViewTemplate', action: 'update', id: template_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  registerNetiorTool(
    server,
    'set_interactive_view_preference',
    {
      instance_id: z.string().describe('Instance ID'),
      preference_mode: z.enum(['inherit', 'template', 'none']).optional().describe('inherit uses the schema default, template overrides with a selected template, none disables the view for this instance'),
      selected_view_template_id: z.string().nullable().describe('Template ID for template override, or null for inherit/none'),
    },
    async ({ instance_id, preference_mode, selected_view_template_id }) => {
      try {
        const result = await upsertInteractiveViewPreference({ instance_id, preference_mode, selected_view_template_id });
        emitChange({ type: 'interactiveViewPreference', action: 'upsert', id: result.id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  registerNetiorTool(
    server,
    'set_interactive_view_schema_preference',
    {
      schema_id: z.string().describe('Schema ID that owns the default Interactive View'),
      selected_view_template_id: z.string().nullable().describe('Schema default template ID, or null to clear the schema default'),
    },
    async ({ schema_id, selected_view_template_id }) => {
      try {
        const result = await upsertInteractiveViewSchemaPreference({ schema_id, selected_view_template_id });
        emitChange({ type: 'interactiveViewSchemaPreference', action: 'upsert', id: result.id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );
}
