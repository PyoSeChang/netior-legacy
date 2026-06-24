import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listModules } from '../netior-service-client.js';
import { rootNetworkIdSchema, registerNetiorTool, resolveRootNetworkId } from './shared-tool-registry.js';

export function registerModuleTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_modules',
    { root_network_id: rootNetworkIdSchema() },
    async ({ root_network_id }) => {
      try {
        const result = await listModules(resolveRootNetworkId(root_network_id));
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

}
