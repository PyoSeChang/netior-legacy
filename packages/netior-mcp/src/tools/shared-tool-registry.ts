import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  DEFAULT_NETIOR_MCP_TOOL_PROFILE,
  getNetiorMcpToolSpec,
  isNetiorMcpToolEnabledForProfile,
  type NetiorMcpToolKey,
} from '@netior/shared/constants';
import type { NetiorMcpToolProfile } from '@netior/shared/types';
import { z } from 'zod';

type NetiorMcpToolSchema = z.ZodRawShape;

export function getActiveNetiorMcpToolProfile(): NetiorMcpToolProfile {
  const raw = process.env.NETIOR_MCP_TOOL_PROFILE?.trim();
  switch (raw) {
    case 'core':
    case 'discovery':
    case 'bootstrap-skill':
    case 'bootstrap-interview':
    case 'bootstrap-execution':
    case 'index-skill':
    case 'interactive-view-authoring':
    case 'network-representation-authoring':
    case 'schema-field-behavior':
      return raw;
    default:
      return DEFAULT_NETIOR_MCP_TOOL_PROFILE;
  }
}

export function rootNetworkIdSchema(): z.ZodOptional<z.ZodString> {
  return z.string().optional().describe(
    'World ID. Prefer omitting this to use the current active world binding. Provide it only for explicit cross-world work.',
  );
}

export function rootNetworkIdOrNullSchema(description: string): z.ZodOptional<z.ZodNullable<z.ZodString>> {
  return z.string().nullable().optional().describe(
    `${description}. Prefer omitting this to use the current active world binding. Provide it only for explicit cross-world work.`,
  );
}

export function resolveRootNetworkId(rootNetworkId?: string | null): string {
  const explicit = typeof rootNetworkId === 'string' ? rootNetworkId.trim() : '';
  if (explicit) {
    return explicit;
  }

  const fallback = process.env.NETIOR_MCP_DEFAULT_WORLD_ID?.trim();
  if (fallback) {
    return fallback;
  }

  throw new Error('No current active world is bound. Pass root_network_id only for explicit cross-world work.');
}

export function resolveNullableRootNetworkId(rootNetworkId?: string | null): string | null {
  if (rootNetworkId === null) {
    return null;
  }

  return resolveRootNetworkId(rootNetworkId);
}

export function registerNetiorTool<TSchema extends NetiorMcpToolSchema>(
  server: McpServer,
  toolKey: NetiorMcpToolKey,
  schema: TSchema,
  handler: (args: z.infer<z.ZodObject<TSchema>>) => Promise<unknown> | unknown,
): void {
  const profile = getActiveNetiorMcpToolProfile();
  if (!isNetiorMcpToolEnabledForProfile(toolKey, profile)) {
    return;
  }

  const spec = getNetiorMcpToolSpec(toolKey);
  server.tool(spec.key, spec.description, schema, handler as never);
}
