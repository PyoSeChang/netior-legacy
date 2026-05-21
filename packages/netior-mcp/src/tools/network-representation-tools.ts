import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createEdgeType,
  createNetworkType,
  createNodeType,
  deleteEdgeType,
  deleteNetworkType,
  deleteNodeType,
  getNetworkType,
  listEdgeTypes,
  listNetworkTypes,
  listNodeTypes,
  updateEdgeType,
  updateNetworkType,
  updateNodeType,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { projectIdOrNullSchema, registerNetiorTool, resolveNullableProjectId } from './shared-tool-registry.js';

const surfaceRuntimeModel = z.enum(['canvas', 'grid']);
const sourceKindModel = z.enum(['system', 'package', 'project', 'imported']);

const jsonObjectTextModel = z.string().optional().describe('JSON object text. Omit to use {}.');

function parseJsonObjectText(raw: string | undefined, label: string): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return '{}';

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`${label} must be valid JSON object text: ${(error as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must decode to a JSON object`);
  }

  return JSON.stringify(parsed);
}

export function registerNetworkRepresentationTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_network_representation_primitives',
    {},
    async () => ({
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          surface_runtimes: [
            { key: 'canvas', description: 'Freeform coordinate surface with nodes, ports, and routed edges.' },
            { key: 'grid', description: 'System grid surface used by built-in calendar-like layouts.' },
          ],
          node_renderers: ['basic-card', 'portal-card', 'group-container', 'hierarchy-container', 'grid-item-card'],
          edge_renderers: ['edge-line'],
          projection_sources: ['instance.title', 'field', 'meaning', 'dsl'],
          port_sides: ['top', 'right', 'bottom', 'left', 'center'],
          port_roles: ['input', 'output', 'bidirectional'],
          routing_strategies: ['shortest', 'straight', 'orthogonal', 'bezier', 'manual'],
        }, null, 2),
      }],
    }),
  );

  registerNetiorTool(
    server,
    'list_network_types',
    { project_id: projectIdOrNullSchema('Project ID or null for only global built-ins') },
    async ({ project_id }) => {
      const result = await listNetworkTypes(resolveNullableProjectId(project_id));
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'get_network_type',
    { network_type_id: z.string().describe('Network type ID') },
    async ({ network_type_id }) => {
      const result = await getNetworkType(network_type_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'create_network_type',
    {
      project_id: projectIdOrNullSchema('Project ID or null for app/global scope'),
      key: z.string().describe('Stable project-local network type key'),
      name: z.string().describe('Display name'),
      description: z.string().nullable().optional(),
      surface_runtime: surfaceRuntimeModel,
      grammar_json: jsonObjectTextModel,
    },
    async ({ project_id, key, name, description, surface_runtime, grammar_json }) => {
      const result = await createNetworkType({
        project_id: resolveNullableProjectId(project_id),
        key,
        name,
        description,
        source_kind: 'project',
        surface_runtime,
        grammar_json: parseJsonObjectText(grammar_json, 'grammar_json'),
      });
      emitChange({ type: 'network', action: 'update', id: result.id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'update_network_type',
    {
      network_type_id: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      grammar_json: jsonObjectTextModel,
    },
    async ({ network_type_id, name, description, grammar_json }) => {
      const result = await updateNetworkType(network_type_id, {
        name,
        description,
        grammar_json: parseJsonObjectText(grammar_json, 'grammar_json'),
      });
      emitChange({ type: 'network', action: 'update', id: network_type_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'delete_network_type',
    { network_type_id: z.string() },
    async ({ network_type_id }) => {
      const result = await deleteNetworkType(network_type_id);
      emitChange({ type: 'network', action: 'delete', id: network_type_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: result }, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'list_node_types',
    { network_type_id: z.string() },
    async ({ network_type_id }) => {
      const result = await listNodeTypes(network_type_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'create_node_type',
    {
      network_type_id: z.string(),
      key: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      source_kind: sourceKindModel.optional(),
      renderer_key: z.string(),
      presentation_json: jsonObjectTextModel,
      projection_json: jsonObjectTextModel,
      interface_json: jsonObjectTextModel,
      placement_json: jsonObjectTextModel,
      interaction_json: jsonObjectTextModel,
    },
    async (args) => {
      const result = await createNodeType({
        ...args,
        source_kind: args.source_kind ?? 'project',
        presentation_json: parseJsonObjectText(args.presentation_json, 'presentation_json'),
        projection_json: parseJsonObjectText(args.projection_json, 'projection_json'),
        interface_json: parseJsonObjectText(args.interface_json, 'interface_json'),
        placement_json: parseJsonObjectText(args.placement_json, 'placement_json'),
        interaction_json: parseJsonObjectText(args.interaction_json, 'interaction_json'),
      });
      emitChange({ type: 'network', action: 'update', id: args.network_type_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'update_node_type',
    {
      node_type_id: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      renderer_key: z.string().optional(),
      presentation_json: jsonObjectTextModel,
      projection_json: jsonObjectTextModel,
      interface_json: jsonObjectTextModel,
      placement_json: jsonObjectTextModel,
      interaction_json: jsonObjectTextModel,
    },
    async ({ node_type_id, ...args }) => {
      const result = await updateNodeType(node_type_id, {
        ...args,
        presentation_json: parseJsonObjectText(args.presentation_json, 'presentation_json'),
        projection_json: parseJsonObjectText(args.projection_json, 'projection_json'),
        interface_json: parseJsonObjectText(args.interface_json, 'interface_json'),
        placement_json: parseJsonObjectText(args.placement_json, 'placement_json'),
        interaction_json: parseJsonObjectText(args.interaction_json, 'interaction_json'),
      });
      emitChange({ type: 'networkNode', action: 'update', id: node_type_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'delete_node_type',
    { node_type_id: z.string() },
    async ({ node_type_id }) => {
      const result = await deleteNodeType(node_type_id);
      emitChange({ type: 'networkNode', action: 'delete', id: node_type_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: result }, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'list_edge_types',
    { network_type_id: z.string() },
    async ({ network_type_id }) => {
      const result = await listEdgeTypes(network_type_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'create_edge_type',
    {
      network_type_id: z.string(),
      key: z.string(),
      name: z.string(),
      description: z.string().nullable().optional(),
      source_kind: sourceKindModel.optional(),
      renderer_key: z.string(),
      presentation_json: jsonObjectTextModel,
      routing_json: jsonObjectTextModel,
      interface_json: jsonObjectTextModel,
      interaction_json: jsonObjectTextModel,
    },
    async (args) => {
      const result = await createEdgeType({
        ...args,
        source_kind: args.source_kind ?? 'project',
        presentation_json: parseJsonObjectText(args.presentation_json, 'presentation_json'),
        routing_json: parseJsonObjectText(args.routing_json, 'routing_json'),
        interface_json: parseJsonObjectText(args.interface_json, 'interface_json'),
        interaction_json: parseJsonObjectText(args.interaction_json, 'interaction_json'),
      });
      emitChange({ type: 'edge', action: 'update', id: args.network_type_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'update_edge_type',
    {
      edge_type_id: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      renderer_key: z.string().optional(),
      presentation_json: jsonObjectTextModel,
      routing_json: jsonObjectTextModel,
      interface_json: jsonObjectTextModel,
      interaction_json: jsonObjectTextModel,
    },
    async ({ edge_type_id, ...args }) => {
      const result = await updateEdgeType(edge_type_id, {
        ...args,
        presentation_json: parseJsonObjectText(args.presentation_json, 'presentation_json'),
        routing_json: parseJsonObjectText(args.routing_json, 'routing_json'),
        interface_json: parseJsonObjectText(args.interface_json, 'interface_json'),
        interaction_json: parseJsonObjectText(args.interaction_json, 'interaction_json'),
      });
      emitChange({ type: 'edge', action: 'update', id: edge_type_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  registerNetiorTool(
    server,
    'delete_edge_type',
    { edge_type_id: z.string() },
    async ({ edge_type_id }) => {
      const result = await deleteEdgeType(edge_type_id);
      emitChange({ type: 'edge', action: 'delete', id: edge_type_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: result }, null, 2) }] };
    },
  );
}
