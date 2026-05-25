import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createEdge,
  deleteEdge,
  getEdge,
  updateEdge,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';

export function registerEdgeTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'create_edge',
    {
      network_id: z.string().describe('The network ID'),
      source_node_id: z.string().describe('Source node ID'),
      target_node_id: z.string().describe('Target node ID'),
      relationship_id: z.string().nullable().optional().describe('Optional relationship ID represented by this network edge'),
      meaning_id: z.string().optional().describe('Optional edge meaning ID'),
      edge_type_id: z.string().optional().describe('Representation edge type ID'),
      source_port_key: z.string().nullable().optional().describe('Optional source port key'),
      target_port_key: z.string().nullable().optional().describe('Optional target port key'),
      route_json: z.string().nullable().optional().describe('Optional edge route JSON'),
      description: z.string().optional().describe('Optional edge description'),
    },
    async ({ network_id, source_node_id, target_node_id, relationship_id, meaning_id, edge_type_id, source_port_key, target_port_key, route_json, description }) => {
      try {
        const result = await createEdge({
          network_id,
          source_node_id,
          target_node_id,
          relationship_id,
          meaning_id,
          edge_type_id,
          source_port_key,
          target_port_key,
          route_json,
          description,
        });
        emitChange({ type: 'edge', action: 'create', id: result.id });
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
    'get_edge',
    { edge_id: z.string().describe('The edge ID') },
    async ({ edge_id }) => {
      try {
        const result = await getEdge(edge_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Edge not found: ${edge_id}` }],
            isError: true,
          };
        }
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
    'update_edge',
    {
      edge_id: z.string().describe('The edge ID'),
      relationship_id: z.string().nullable().optional().describe('Relationship ID or null'),
      meaning_id: z.string().nullable().optional().describe('Edge meaning ID or null'),
      edge_type_id: z.string().nullable().optional().describe('Representation edge type ID or null'),
      source_port_key: z.string().nullable().optional().describe('Source port key or null'),
      target_port_key: z.string().nullable().optional().describe('Target port key or null'),
      route_json: z.string().nullable().optional().describe('Edge route JSON or null'),
      description: z.string().nullable().optional().describe('Edge description or null'),
    },
    async ({ edge_id, relationship_id, meaning_id, edge_type_id, source_port_key, target_port_key, route_json, description }) => {
      try {
        const result = await updateEdge(edge_id, {
          relationship_id,
          meaning_id,
          edge_type_id,
          source_port_key,
          target_port_key,
          route_json,
          description,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Edge not found: ${edge_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'edge', action: 'update', id: edge_id });
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
    'delete_edge',
    { edge_id: z.string().describe('The edge ID') },
    async ({ edge_id }) => {
      try {
        const deleted = await deleteEdge(edge_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Edge not found: ${edge_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'edge', action: 'delete', id: edge_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: edge_id }) }],
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
