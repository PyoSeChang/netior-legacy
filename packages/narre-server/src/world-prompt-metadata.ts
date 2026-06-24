import type { NetworkTreeNode, Meaning, Schema, SchemaField, SchemaMeaning } from '@netior/shared/types';
import type { SystemPromptParams } from './system-prompt.js';
import {
  getRootNetwork,
  getNetworkTree,
  getWorldById,
  getUniverseNetwork,
  listNetworkTypes,
  listMeaningCategories,
  listMeanings,
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
      ...(field.generated_by_meaning ? { generated_by_meaning: true } : {}),
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
    source_meaning: meaning.source_meaning,
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
    meaning_refs: schema.meanings,
    icon: schema.icon,
    color: schema.color,
    fields: mapSchemaFields(schemaFieldsById.get(schema.id) ?? [], schemaNameMap),
    meanings: mapSchemaMeanings(schemaMeaningsById.get(schema.id) ?? []),
  }));
}

function mapModels(meanings: Meaning[]): SystemPromptParams['meanings'] {
  return meanings.map((meaning) => ({
    id: meaning.id,
    key: meaning.key,
    name: meaning.name,
    description: meaning.description,
    category_instance_id: meaning.category_instance_id,
    category_instance_title: meaning.category_instance_title,
    category_instance_source_ref: meaning.category_instance_source_ref,
    target_kind: meaning.target_kind,
    meaning_keys: meaning.meaning_keys,
    line_style: meaning.line_style,
    directed: meaning.directed,
    built_in: meaning.built_in,
    source_kind: meaning.source_kind,
    source_id: meaning.source_id,
    source_ref: meaning.source_ref,
    source_version: meaning.source_version,
    recipe_meanings: meaning.recipe.meanings.map((meaning) => ({
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

function mapMeaningCategories(categories: Awaited<ReturnType<typeof listMeaningCategories>>): SystemPromptParams['meaningCategories'] {
  return categories.map((category) => ({
    id: category.id,
    title: category.title,
    source_kind: category.source_kind,
    source_id: category.source_id,
    source_ref: category.source_ref,
    source_version: category.source_version,
  }));
}

export async function buildWorldPromptMetadata(rootNetworkId: string): Promise<SystemPromptParams> {
  const world = await getWorldById(rootNetworkId);
  if (!world) {
    throw new Error(`World not found: ${rootNetworkId}`);
  }

  const [
    meanings,
    meaningCategories,
    schemas,
    universeNetwork,
    rootNetwork,
    networkTree,
    networkTypes,
  ] = await Promise.all([
    listMeanings(rootNetworkId),
    listMeaningCategories(rootNetworkId),
    listSchemas(rootNetworkId),
    getUniverseNetwork(),
    getRootNetwork(rootNetworkId),
    getNetworkTree(rootNetworkId),
    listNetworkTypes(rootNetworkId),
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
    rootNetworkId,
    worldName: world.name,
    worldRootDir: world.root_dir,
    schemas: mapSchemas(schemas, schemaFieldsById, schemaMeaningsById, schemaNameMap),
    meanings: mapModels(meanings),
    meaningCategories: mapMeaningCategories(meaningCategories),
    universeNetwork: universeNetwork
      ? { id: universeNetwork.id, name: universeNetwork.name }
      : null,
    rootNetwork: rootNetwork
      ? { id: rootNetwork.id, name: rootNetwork.name }
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
