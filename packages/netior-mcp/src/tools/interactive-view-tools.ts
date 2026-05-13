import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { validateInteractiveViewSource } from '@netior/shared/interactive-view';
import { z } from 'zod';
import {
  createInteractiveViewTemplate,
  getInteractiveViewTemplate,
  listInteractiveViewTemplates,
  updateInteractiveViewTemplate,
  upsertInteractiveViewPreference,
  upsertInteractiveViewSchemaPreference,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';

const targetKindSchema = z.enum(['schema', 'instance']);
const sourceKindSchema = z.enum(['manual', 'narre']);
const trustLevelSchema = z.enum(['untrusted', 'validated', 'trusted']);
const runtimeSchema = z.enum(['host', 'sandbox']);
const validationStatusSchema = z.enum(['unknown', 'passed', 'failed']);

function formatValidationErrors(sourceCode: string, manifestJson: string): {
  default_runtime: 'host' | 'sandbox';
  validation_status: 'passed';
  validation_errors_json: string;
} {
  const validation = validateInteractiveViewSource(sourceCode, manifestJson);
  if (!validation.ok) {
    const detail = validation.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join('\n');
    throw new Error(`Interactive View contract validation failed:\n${detail}`);
  }

  return {
    default_runtime: validation.runtime,
    validation_status: 'passed',
    validation_errors_json: JSON.stringify(validation.issues),
  };
}

function dryRunInteractiveView(sourceCode: string, manifestJson: string): {
  ok: boolean;
  runtime: 'host' | 'sandbox';
  issues: ReturnType<typeof validateInteractiveViewSource>['issues'];
  guidance: string[];
} {
  const validation = validateInteractiveViewSource(sourceCode, manifestJson);
  const issueCodes = new Set(validation.issues.map((issue) => issue.code));
  const guidance: string[] = [];
  if (issueCodes.has('source.dsl_operator_not_available')) {
    guidance.push('Use exact Netior DSL operators: instances, field.value, field.object, filter, equals, sort, aggregate, relative.');
  }
  if (issueCodes.has('source.dsl_projection_not_available')) {
    guidance.push('Do not use select/projection clauses. Fetch object refs with DSL and read display fields with useField/useFieldValue or a supported follow-up DSL expression.');
  }
  if (issueCodes.has('source.dsl_order_by_array_not_available')) {
    guidance.push('Use relative.orderBy as a single field selector object, for example { fieldId: "order-field-id" }.');
  }
  if (issueCodes.has('source.sdk_export_not_available')) {
    guidance.push('Use only exports provided by @netior/interactive-sdk; inspect the validation issue messages for invalid names.');
  }
  if (issueCodes.has('permissions.dsl_not_declared')) {
    guidance.push('Set manifest.permissions.dsl=true whenever useDslValue, useDslObject, or useDslObjects is used.');
  }

  return {
    ok: validation.ok,
    runtime: validation.runtime,
    issues: validation.issues,
    guidance,
  };
}

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
    'dry_run_interactive_view_template',
    {
      source_code: z.string().describe('Restricted TSX source to validate before creating or updating an Interactive View template'),
      manifest_json: z.string().describe('Interactive View manifest JSON to validate before creating or updating a template'),
    },
    async ({ source_code, manifest_json }) => {
      try {
        const result = dryRunInteractiveView(source_code, manifest_json);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], isError: !result.ok };
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
        const validation = formatValidationErrors(input.source_code, input.manifest_json);
        const result = await createInteractiveViewTemplate({
          project_id: resolveProjectId(project_id),
          ...input,
          ...validation,
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
        let validation: ReturnType<typeof formatValidationErrors> | undefined;
        if (input.source_code !== undefined || input.manifest_json !== undefined) {
          const existing = await getInteractiveViewTemplate(template_id);
          if (!existing) {
            return { content: [{ type: 'text' as const, text: `Error: Template not found: ${template_id}` }], isError: true };
          }
          validation = formatValidationErrors(
            input.source_code ?? existing.source_code,
            input.manifest_json ?? existing.manifest_json,
          );
        }
        const result = await updateInteractiveViewTemplate(template_id, {
          ...input,
          ...(validation ?? {}),
        });
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
