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
  listMeanings,
  getInstancesByProject,
  listNetworkTypes,
  listNetworks,
  listRelationships,
} from '../netior-service-client.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { toAgentInstance, toAgentFieldType } from './schema-surface.js';

function buildOptionsPreview(options: string | null): string[] | undefined {
  if (!options) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(options) as { choices?: unknown };
    if (Array.isArray(parsed.choices)) {
      const choices = parsed.choices.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      return choices.length > 0 ? choices.slice(0, 5) : undefined;
    }
  } catch {
    // Legacy inline options were stored as comma-separated text.
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
          meanings,
          instances,
          networks,
          networkTypes,
          relationships,
          universeNetwork,
          ontologyNetwork,
          networkTree,
        ] = await Promise.all([
          listSchemas(targetProjectId),
          listMeanings(targetProjectId),
          getInstancesByProject(targetProjectId),
          listNetworks(targetProjectId),
          listNetworkTypes(targetProjectId),
          listRelationships({ projectId: targetProjectId }),
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
        const relationMeanings = meanings.filter((meaning) => meaning.target_kind === 'relation' || meaning.target_kind === 'both');

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
              description: schema.description,
              fields: mapSchemaFields(schemaFieldsById.get(schema.id) ?? [], schemaNameMap),
            })),
          },
          relation_meanings: {
            count: relationMeanings.length,
            items: relationMeanings.map((meaning) => ({
              id: meaning.id,
              key: meaning.key,
              name: meaning.name,
              directed: meaning.directed,
              line_style: meaning.line_style,
              color: meaning.color,
              description: meaning.description,
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
            items: networks.map((n) => ({
              id: n.id,
              name: n.name,
              kind: n.kind,
              network_type_id: n.network_type_id,
              parent_network_id: n.parent_network_id,
            })),
          },
          network_types: {
            count: networkTypes.length,
            items: networkTypes.map((networkType) => ({
              id: networkType.id,
              key: networkType.key,
              name: networkType.name,
              source_kind: networkType.source_kind,
              surface_runtime: networkType.surface_runtime,
            })),
          },
          relationships: {
            count: relationships.length,
            items: relationships.slice(0, 50).map((relationship) => ({
              id: relationship.id,
              source_object_id: relationship.source_object_id,
              target_object_id: relationship.target_object_id,
              meaning_id: relationship.meaning_id,
              description: relationship.description,
            })),
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
