import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  validateNetiorDslExpression,
  validateNetiorDslFieldBehaviorConfig,
} from '@netior/shared/dsl';
import { listModels, evaluateDsl } from '../netior-service-client.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { toAgentModel } from './model-surface.js';

const jsonObject = z.record(z.string(), z.unknown());

export function registerDslTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'validate_dsl',
    {
      expression: jsonObject.optional().describe('DSL JSON AST expression to validate.'),
      field_behavior_config: jsonObject.optional().describe('Field behavior DSL config wrapper to validate.'),
    },
    async ({ expression, field_behavior_config }) => {
      const result = field_behavior_config
        ? validateNetiorDslFieldBehaviorConfig(field_behavior_config)
        : validateNetiorDslExpression(expression);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'evaluate_dsl',
    {
      project_id: projectIdSchema(),
      context: jsonObject.optional().describe('DSL evaluation context. projectId is filled from project_id when omitted.'),
      expression: jsonObject.describe('DSL JSON AST expression to evaluate.'),
    },
    async ({ project_id, context, expression }) => {
      try {
        const projectId = resolveProjectId(project_id);
        const result = await evaluateDsl({
          context: {
            projectId,
            ...(context ?? {}),
          } as never,
          expression: expression as never,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
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
    'list_model_catalog',
    { project_id: projectIdSchema() },
    async ({ project_id }) => {
      try {
        const models = await listModels(resolveProjectId(project_id));
        const result = models
          .filter((model) => model.built_in || model.source_kind === 'system' || model.source_kind === 'package')
          .map(toAgentModel);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
