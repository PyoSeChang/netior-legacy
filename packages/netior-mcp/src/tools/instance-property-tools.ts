import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  deleteInstanceProperty,
  getInstanceProperties,
  upsertInstanceProperty,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';

export function registerInstancePropertyTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'get_instance_properties',
    { instance_id: z.string().describe('The instance ID') },
    async ({ instance_id }) => {
      try {
        const result = await getInstanceProperties(instance_id);
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
    'upsert_instance_property',
    {
      instance_id: z.string().describe('The instance ID'),
      field_id: z.string().describe('The field ID'),
      value: z.string().nullable().describe('Serialized value for the field, or null'),
    },
    async ({ instance_id, field_id, value }) => {
      try {
        const result = await upsertInstanceProperty({
          instance_id,
          field_id,
          value,
        });
        emitChange({ type: 'instanceProperty', action: 'upsert', id: result.id });
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
    'delete_instance_property',
    { instance_property_id: z.string().describe('The instance property ID to delete') },
    async ({ instance_property_id }) => {
      try {
        const deleted = await deleteInstanceProperty(instance_property_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Instance property not found: ${instance_property_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'instanceProperty', action: 'delete', id: instance_property_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: instance_property_id }) }],
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
