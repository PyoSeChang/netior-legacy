import type { NetworkTreeNode, Model, Schema, SchemaField, SchemaMeaning } from '@netior/shared/types';
import type { SystemPromptParams } from './system-prompt.js';
import {
  getProjectOntologyNetwork,
  getNetworkTree,
  getProjectById,
  getUniverseNetwork,
  listNetworkTypes,
  listModelCategories,
  listModels,
  listSchemaFields,
  listSchemaMeanings,
  listSchemas,
} from './netior-service-client.js';

function mapNetworkTree(nodes: NetworkTreeNode[]): NonNullable<SystemPromptParams['networkTree']> {
  return nodes.map((node) => ({
    id: node.network.id,
    name: node.network.name,
    kind: node.network.kind,
    children: mapNetworkTree(node.children),
  }));
}

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
): NonNullable<SystemPromptParams['schemas'][number]['fields']> {
  const fieldNames = new Map(fields.map((field) => [field.id, field.name]));
  return fields.map((field) => {
    const optionsPreview = buildOptionsPreview(field.options);

    return {
      name: field.name,
      field_type: field.field_type,
      required: field.required,
      ...(field.meaning_bindings.length > 0 ? { meaning_bindings: field.meaning_bindings } : {}),
      ...(field.generated_by_model ? { generated_by_model: true } : {}),
      ...(field.bindings.length > 0
        ? {
          bindings: field.bindings.map((binding) => ({
            kind: binding.binding_kind,
            source_schema_name: binding.source_schema_id ? schemaNames.get(binding.source_schema_id) ?? binding.source_schema_id : null,
            source_field_name: binding.source_field_id ? fieldNames.get(binding.source_field_id) ?? binding.source_field_id : null,
            cardinality: binding.cardinality,
            read_only: binding.read_only,
            config: binding.config,
          })),
        }
        : {}),
      ...(optionsPreview ? { options_preview: optionsPreview } : {}),
    };
  });
}

function mapSchemaMeanings(
  meanings: SchemaMeaning[],
): NonNullable<SystemPromptParams['schemas'][number]['meanings']> {
  return meanings.map((meaning) => ({
    key: meaning.meaning_key,
    label: meaning.label,
    source: meaning.source,
    source_model: meaning.source_model,
    fields: meaning.slots
      .filter((slot) => slot.target_kind === 'field' && slot.field_id)
      .map((slot) => ({
        binding_id: slot.id,
        field_id: slot.field_id as string,
        required: slot.required,
      })),
  }));
}

function mapSchemas(
  schemas: Schema[],
  schemaFieldsById: Map<string, SchemaField[]>,
  schemaMeaningsById: Map<string, SchemaMeaning[]>,
  schemaNameMap: Map<string, string>,
): SystemPromptParams['schemas'] {
  return schemas.map((schema) => ({
    id: schema.id,
    name: schema.name,
    description: schema.description,
    models: schema.models,
    icon: schema.icon,
    color: schema.color,
    fields: mapSchemaFields(schemaFieldsById.get(schema.id) ?? [], schemaNameMap),
    meanings: mapSchemaMeanings(schemaMeaningsById.get(schema.id) ?? []),
  }));
}

function mapModels(models: Model[]): SystemPromptParams['models'] {
  return models.map((model) => ({
    id: model.id,
    key: model.key,
    name: model.name,
    description: model.description,
    category_instance_id: model.category_instance_id,
    category_instance_title: model.category_instance_title,
    category_instance_source_ref: model.category_instance_source_ref,
    target_kind: model.target_kind,
    meaning_keys: model.meaning_keys,
    line_style: model.line_style,
    directed: model.directed,
    built_in: model.built_in,
    source_kind: model.source_kind,
    source_id: model.source_id,
    source_ref: model.source_ref,
    source_version: model.source_version,
    recipe_meanings: model.recipe.meanings.map((meaning) => ({
      key: meaning.key,
      name: meaning.name,
      representation: meaning.representation,
      fields: meaning.fields.map((field) => ({
        key: field.key,
        name: field.name,
        field_types: field.field_types,
        required: field.required,
      })),
    })),
  }));
}

function mapModelCategories(categories: Awaited<ReturnType<typeof listModelCategories>>): SystemPromptParams['modelCategories'] {
  return categories.map((category) => ({
    id: category.id,
    title: category.title,
    source_kind: category.source_kind,
    source_id: category.source_id,
    source_ref: category.source_ref,
    source_version: category.source_version,
  }));
}

export async function buildProjectPromptMetadata(projectId: string): Promise<SystemPromptParams> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const [
    models,
    modelCategories,
    schemas,
    universeNetwork,
    ontologyNetwork,
    networkTree,
    networkTypes,
  ] = await Promise.all([
    listModels(projectId),
    listModelCategories(projectId),
    listSchemas(projectId),
    getUniverseNetwork(),
    getProjectOntologyNetwork(projectId),
    getNetworkTree(projectId),
    listNetworkTypes(projectId),
  ]);

  const schemaNameMap = new Map<string, string>(schemas.map((schema) => [schema.id, schema.name]));
  const schemaFieldsById = new Map<string, SchemaField[]>(
    await Promise.all(
      schemas.map(async (schema) => [schema.id, await listSchemaFields(schema.id)] as const),
    ),
  );
  const schemaMeaningsById = new Map<string, SchemaMeaning[]>(
    await Promise.all(
      schemas.map(async (schema) => [schema.id, await listSchemaMeanings(schema.id)] as const),
    ),
  );
  return {
    projectId,
    projectName: project.name,
    projectRootDir: project.root_dir,
    schemas: mapSchemas(schemas, schemaFieldsById, schemaMeaningsById, schemaNameMap),
    models: mapModels(models),
    modelCategories: mapModelCategories(modelCategories),
    universeNetwork: universeNetwork
      ? { id: universeNetwork.id, name: universeNetwork.name }
      : null,
    ontologyNetwork: ontologyNetwork
      ? { id: ontologyNetwork.id, name: ontologyNetwork.name }
      : null,
    networkTree: mapNetworkTree(networkTree),
    networkTypes: networkTypes.map((networkType) => ({
      id: networkType.id,
      key: networkType.key,
      name: networkType.name,
      source_kind: networkType.source_kind,
      surface_runtime: networkType.surface_runtime,
    })),
  };
}
