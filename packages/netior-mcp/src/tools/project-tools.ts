import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SchemaField, NetworkTreeNode } from '@netior/shared/types';
import {
  getUniverseNetwork,
  getProjectById,
  getProjectOntologyNetwork,
  getNetworkTree,
  listSchemaFields,
  listSchemas,
  listModels,
  getInstancesByProject,
  listNetworks,
} from '../netior-service-client.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { toAgentInstance, toAgentFieldType } from './schema-surface.js';

function buildOptionsPreview(options: string | null): string[] | undefined {
  if (!options) {
    return undefined;
  }

  const values = options
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return undefined;
  }

  return values.slice(0, 5);
}

function mapSchemaFields(
  fields: SchemaField[],
  schemaNames: Map<string, string>,
): Array<{
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  bindings?: Array<{ kind: string; source_schema_name?: string; cardinality: string; read_only: boolean }>;
  options_preview?: string[];
}> {
  return fields.map((field) => {
    const optionsPreview = buildOptionsPreview(field.options);

    return {
      id: field.id,
      name: field.name,
      field_type: toAgentFieldType(field.field_type),
      required: field.required,
      ...(field.bindings.length > 0
        ? {
          bindings: field.bindings.map((binding) => ({
            kind: binding.binding_kind,
            source_schema_name: binding.source_schema_id ? schemaNames.get(binding.source_schema_id) ?? binding.source_schema_id : undefined,
            cardinality: binding.cardinality,
            read_only: binding.read_only,
          })),
        }
        : {}),
      ...(optionsPreview ? { options_preview: optionsPreview } : {}),
    };
  });
}

interface ProjectSummaryNetworkTreeNode {
  id: string;
  name: string;
  kind: string;
  children: ProjectSummaryNetworkTreeNode[];
}

function mapNetworkTree(nodes: NetworkTreeNode[]): ProjectSummaryNetworkTreeNode[] {
  return nodes.map((node) => ({
    id: node.network.id,
    name: node.network.name,
    kind: node.network.kind,
    children: mapNetworkTree(node.children),
  }));
}

export function registerProjectTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'get_project_summary',
    { project_id: projectIdSchema() },
    async ({ project_id }) => {
      try {
        const targetProjectId = resolveProjectId(project_id);
        const project = await getProjectById(targetProjectId);
        if (!project) {
          return {
            content: [{ type: 'text' as const, text: `Error: Project not found: ${targetProjectId}` }],
            isError: true,
          };
        }

        const [
          schemas,
          models,
          instances,
          networks,
          universeNetwork,
          ontologyNetwork,
          networkTree,
        ] = await Promise.all([
          listSchemas(targetProjectId),
          listModels(targetProjectId),
          getInstancesByProject(targetProjectId),
          listNetworks(targetProjectId),
          getUniverseNetwork(),
          getProjectOntologyNetwork(targetProjectId),
          getNetworkTree(targetProjectId),
        ]);
        const schemaNameMap = new Map<string, string>(schemas.map((schema) => [schema.id, schema.name]));
        const schemaFieldsById = new Map<string, SchemaField[]>(
          await Promise.all(
            schemas.map(async (schema) => [schema.id, await listSchemaFields(schema.id)] as const),
          ),
        );
        const edgeModels = models.filter((model) => model.target_kind === 'edge' || model.target_kind === 'both');

        const summary = {
          project: {
            id: project.id,
            name: project.name,
            root_dir: project.root_dir,
          },
          schemas: {
            count: schemas.length,
            items: schemas.map((schema) => ({
              id: schema.id,
              name: schema.name,
              icon: schema.icon,
              color: schema.color,
              node_shape: schema.node_shape,
              description: schema.description,
              fields: mapSchemaFields(schemaFieldsById.get(schema.id) ?? [], schemaNameMap),
            })),
          },
          edge_models: {
            count: edgeModels.length,
            items: edgeModels.map((model) => ({
              id: model.id,
              key: model.key,
              name: model.name,
              directed: model.directed,
              line_style: model.line_style,
              color: model.color,
              description: model.description,
            })),
          },
          instances: {
            count: instances.length,
            items: instances.map((instance) => {
              const agentInstance = toAgentInstance(instance);
              return { id: agentInstance.id, title: agentInstance.title, schema_id: agentInstance.schema_id };
            }),
          },
          networks: {
            count: networks.length,
            items: networks.map((n) => ({ id: n.id, name: n.name, kind: n.kind, parent_network_id: n.parent_network_id })),
          },
          system_networks: {
            universe: universeNetwork ? { id: universeNetwork.id, name: universeNetwork.name } : null,
            ontology: ontologyNetwork ? { id: ontologyNetwork.id, name: ontologyNetwork.name } : null,
          },
          network_tree: mapNetworkTree(networkTree),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
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
