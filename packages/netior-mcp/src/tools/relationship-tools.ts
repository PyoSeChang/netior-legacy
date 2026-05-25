import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createRelationship,
  deleteRelationship,
  getRelationship,
  listRelationshipOccurrences,
  listRelationships,
  updateRelationship,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';

function parseJsonObjectText(raw: string | null | undefined, label: string): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw.trim() === '') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} must be valid JSON object text: ${(error as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must decode to a JSON object`);
  }

  return JSON.stringify(parsed);
}

export function registerRelationshipTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_relationships',
    {
      project_id: projectIdSchema(),
      source_object_id: z.string().optional().describe('Optional source object record ID'),
      target_object_id: z.string().optional().describe('Optional target object record ID'),
      meaning_id: z.string().optional().describe('Optional relationship meaning ID'),
    },
    async ({ project_id, source_object_id, target_object_id, meaning_id }) => {
      try {
        const result = await listRelationships({
          projectId: resolveProjectId(project_id),
          sourceObjectId: source_object_id,
          targetObjectId: target_object_id,
          meaningId: meaning_id,
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
    'get_relationship',
    { relationship_id: z.string().describe('Relationship ID') },
    async ({ relationship_id }) => {
      try {
        const result = await getRelationship(relationship_id);
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
    'create_relationship',
    {
      project_id: projectIdSchema(),
      source_object_id: z.string().describe('Source object record ID'),
      target_object_id: z.string().describe('Target object record ID'),
      meaning_id: z.string().nullable().optional().describe('Relationship meaning ID or null'),
      description: z.string().nullable().optional().describe('Relationship description'),
      properties_json: z.string().nullable().optional().describe('Optional relationship properties JSON object text'),
    },
    async ({ project_id, source_object_id, target_object_id, meaning_id, description, properties_json }) => {
      try {
        const result = await createRelationship({
          project_id: resolveProjectId(project_id),
          source_object_id,
          target_object_id,
          meaning_id,
          description,
          properties_json: parseJsonObjectText(properties_json, 'properties_json') ?? null,
        });
        emitChange({ type: 'edge', action: 'create', id: result.id });
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
    'update_relationship',
    {
      relationship_id: z.string(),
      meaning_id: z.string().nullable().optional().describe('Relationship meaning ID or null'),
      description: z.string().nullable().optional(),
      properties_json: z.string().nullable().optional().describe('Relationship properties JSON object text or null'),
    },
    async ({ relationship_id, meaning_id, description, properties_json }) => {
      try {
        const result = await updateRelationship(relationship_id, {
          meaning_id,
          description,
          properties_json: parseJsonObjectText(properties_json, 'properties_json'),
        });
        emitChange({ type: 'edge', action: 'update', id: relationship_id });
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
    'delete_relationship',
    { relationship_id: z.string() },
    async ({ relationship_id }) => {
      try {
        const result = await deleteRelationship(relationship_id);
        emitChange({ type: 'edge', action: 'delete', id: relationship_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: result, id: relationship_id }) }] };
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
    'list_relationship_occurrences',
    { relationship_id: z.string() },
    async ({ relationship_id }) => {
      try {
        const result = await listRelationshipOccurrences(relationship_id);
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
