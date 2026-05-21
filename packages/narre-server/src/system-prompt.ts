import type { NarreBehaviorSettings } from '@netior/shared/types';

export interface SystemPromptSchemaFieldSummary {
  name: string;
  field_type: string;
  required?: boolean;
  meaning_bindings?: string[];
  generated_by_model?: boolean;
  bindings?: Array<{
    kind: string;
    source_schema_name?: string | null;
    source_field_name?: string | null;
    cardinality?: string | null;
    read_only?: boolean;
    config?: string | null;
  }>;
  option_source_model_name?: string | null;
  options_preview?: string[] | null;
}

export interface SystemPromptSchemaMeaningSummary {
  key: string;
  label?: string | null;
  source?: string | null;
  source_model?: string | null;
  fields?: Array<{
    binding_id: string;
    field_id: string;
    required?: boolean;
  }>;
}

export interface SystemPromptSchemaSummary {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  models?: string[];
  meanings?: SystemPromptSchemaMeaningSummary[];
  fields?: SystemPromptSchemaFieldSummary[];
}

export interface SystemPromptModelSummary {
  id: string;
  key?: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  category_instance_id?: string | null;
  category_instance_title?: string | null;
  category_instance_source_ref?: string | null;
  target_kind?: 'object' | 'edge' | 'both' | string;
  meaning_keys?: string[];
  line_style?: string | null;
  directed?: boolean | null;
  built_in?: boolean;
  source_kind?: string | null;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
  recipe_meanings?: Array<{
    key: string;
    name: string;
    representation: string;
    fields: Array<{
      key: string;
      name: string;
      field_types: string[];
      required?: boolean;
    }>;
  }>;
}

export interface SystemPromptModelCategorySummary {
  id: string;
  title: string;
  source_kind?: string | null;
  source_id?: string | null;
  source_ref?: string | null;
  source_version?: string | null;
}

export interface SystemPromptNetworkSummary {
  id: string;
  name: string;
}

export interface SystemPromptNetworkTreeSummary {
  id: string;
  name: string;
  kind?: string;
  children?: SystemPromptNetworkTreeSummary[];
}

export interface SystemPromptNetworkTypeSummary {
  id: string;
  key: string;
  name: string;
  source_kind: string;
  surface_runtime: string;
}

export interface SystemPromptParams {
  projectId: string;
  projectName: string;
  projectRootDir?: string | null;
  schemas: SystemPromptSchemaSummary[];
  models: SystemPromptModelSummary[];
  modelCategories?: SystemPromptModelCategorySummary[];
  universeNetwork?: SystemPromptNetworkSummary | null;
  ontologyNetwork?: SystemPromptNetworkSummary | null;
  networkTree?: SystemPromptNetworkTreeSummary[];
  networkTypes?: SystemPromptNetworkTypeSummary[];
}

export const DEFAULT_NARRE_BEHAVIOR_SETTINGS: NarreBehaviorSettings = {
  graphPriority: 'strict',
  discourageLocalWorkspaceActions: true,
  extraInstructions: '',
};

export function normalizeNarreBehaviorSettings(value: unknown): NarreBehaviorSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NARRE_BEHAVIOR_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  const graphPriority = source.graphPriority === 'balanced' ? 'balanced' : 'strict';
  const discourageLocalWorkspaceActions = source.discourageLocalWorkspaceActions !== false;
  const extraInstructions = typeof source.extraInstructions === 'string'
    ? source.extraInstructions.trim()
    : '';

  return {
    graphPriority,
    discourageLocalWorkspaceActions,
    extraInstructions,
  };
}

export function buildBehaviorGuidanceSection(behavior: NarreBehaviorSettings): string {
  return [
    '- Your primary job is to manage Netior modeling state: schemas, semantic models, meanings, fields, instances, networks, edges, files, and related instance metadata.',
    '- You are not the author of the user domain. The user owns domain definitions, category boundaries, terminology, lifecycle meaning, and business rules.',
    '- Translate user-supplied domain knowledge into Netior objects, Netior DSL, and graph structure. Do not silently invent domain facts, taxonomies, workflows, policies, or examples.',
    '- You may propose structural interpretations as hypotheses, but label them as proposals and ask the user when domain meaning is missing or ambiguous.',
    '- Treat requests as Netior modeling work by default, not as general software engineering or local coding work.',
    '- Prefer Netior/MCP tools and graph-object operations over browsing arbitrary local workspace files.',
    '- Interpret the user intent before naming implementation details. Start from the user\'s stated outcome and domain language, not from internal field or route names.',
    '- Classify each request as schema/model, instance, graph, organization, or network-view work before choosing tools.',
    '- For schema work, distinguish scalar fields, typed schema references, instance-backed choice structures, and model-backed meanings.',
    '- Prefer a small set of primitive families: schema/model discovery and mutation, instance discovery and mutation, candidate source discovery, and graph discovery and mutation.',
    '- Do not proactively create or manage modules or contexts in this phase. They are out of scope for Narre-owned changes.',
    behavior.graphPriority === 'strict'
      ? '- Stay anchored to the project graph. Do not drift into generic repo analysis unless the user explicitly asks for local file inspection.'
      : '- Keep the project graph as the default center of gravity, even when discussing nearby files or documents.',
    behavior.discourageLocalWorkspaceActions
      ? '- Do not inspect, edit, or reason about unrelated local workspace files unless the user explicitly requests that file-level work.'
      : '- Use local workspace inspection only when it materially helps with the requested Netior task.',
    ...(behavior.extraInstructions ? [`- Additional Narre instructions: ${behavior.extraInstructions}`] : []),
  ].join('\n');
}

const SEARCHABLE_FIELD_TYPES = new Set([
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi-select',
  'radio',
  'relation',
  'object',
  'url',
  'rating',
  'tags',
]);

function isRelationalField(field: SystemPromptSchemaFieldSummary): boolean {
  return field.field_type === 'relation' || field.field_type === 'object' || (field.bindings?.length ?? 0) > 0;
}

function isSearchableField(field: SystemPromptSchemaFieldSummary): boolean {
  return (field.meaning_bindings?.length ?? 0) > 0 || SEARCHABLE_FIELD_TYPES.has(field.field_type);
}

function formatFieldType(fieldType: string): string {
  return fieldType;
}

function formatFieldSummary(field: SystemPromptSchemaFieldSummary): string {
  const models: string[] = [formatFieldType(field.field_type)];
  models.push(field.required ? 'required' : 'optional');

  if (field.meaning_bindings && field.meaning_bindings.length > 0) {
    models.push(`meanings=${field.meaning_bindings.join('|')}`);
  }

  if (field.generated_by_model) {
    models.push('model-generated');
  }

  if (field.bindings && field.bindings.length > 0) {
    models.push(`bindings=${field.bindings.map((binding) => {
      const source = binding.source_schema_name ? `:${binding.source_schema_name}` : '';
      const cardinality = binding.cardinality ? `/${binding.cardinality}` : '';
      const readOnly = binding.read_only ? '/read-only' : '';
      return `${binding.kind}${source}${cardinality}${readOnly}`;
    }).join('|')}`);
  }

  if (field.option_source_model_name) {
    models.push(`options-from=${field.option_source_model_name}`);
  } else if (field.options_preview && field.options_preview.length > 0) {
    models.push(`options=${field.options_preview.join('|')}`);
  }

  return `${field.name} (${models.join(', ')})`;
}

function buildSchemaSurfaceList(schemas: SystemPromptSchemaSummary[]): string {
  if (schemas.length === 0) {
    return '- (none defined yet)';
  }

  return schemas.map((schema) => {
    const fields = schema.fields ?? [];
    const propertyFields = fields.filter((field) => !isRelationalField(field));
    const relationalFields = fields.filter((field) => isRelationalField(field));
    const searchSurface = Array.from(new Set([
      'instance_title',
      ...fields
        .filter((field) => isSearchableField(field))
        .flatMap((field) => field.meaning_bindings && field.meaning_bindings.length > 0 ? field.meaning_bindings : [field.name]),
    ]));

    const profile = [
      `icon=${schema.icon ?? 'none'}`,
      `color=${schema.color ?? 'none'}`,
      ...(schema.models && schema.models.length > 0 ? [`models=${schema.models.join('|')}`] : []),
      ...(schema.description ? [`description=${schema.description}`] : []),
    ].join(', ');
    const overflow = fields.length > 10 ? `\n- more_fields=+${fields.length - 10}` : '';

    return [
      `### ${schema.name} [id=${schema.id}]`,
      `- profile=${profile}`,
      `- meanings=${schema.meanings && schema.meanings.length > 0 ? schema.meanings.map((meaning) => meaning.label ?? meaning.key).join('|') : '(none)'}`,
      `- properties=${propertyFields.length > 0 ? propertyFields.slice(0, 6).map(formatFieldSummary).join('; ') : '(none yet)'}`,
      `- field_interpretations=${relationalFields.length > 0 ? relationalFields.slice(0, 6).map(formatFieldSummary).join('; ') : '(none yet)'}`,
      `- search_surface=${searchSurface.join(', ')}`,
      overflow,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function buildModelList(models: SystemPromptModelSummary[]): string {
  if (models.length === 0) {
    return '- (none defined yet)';
  }

  return models.map((model) => {
    const meaningLabels = model.recipe_meanings && model.recipe_meanings.length > 0
      ? model.recipe_meanings.map((meaning) => {
        const fields = meaning.fields.length > 0
          ? ` fields=${meaning.fields.map((field) => `${field.name}:${field.field_types.join('|')}`).join(',')}`
          : '';
        return `${meaning.name}(${meaning.representation}${fields})`;
      }).join('; ')
      : model.meaning_keys && model.meaning_keys.length > 0
        ? model.meaning_keys.join('|')
        : '(none)';
    const details = [
      `key=${model.key}`,
      `category=${model.category_instance_title ?? model.category_instance_source_ref ?? 'none'}`,
      `target=${model.target_kind ?? 'object'}`,
    `source=${model.source_kind ?? 'project'}${model.source_ref ? `:${model.source_ref}` : ''}`,
      ...(model.description ? [`description=${model.description}`] : []),
    ];
    return `- ${model.name} [id=${model.id}]: ${details.join(', ')}; meanings=${meaningLabels}`;
  }).join('\n');
}

function buildModelCategoryList(categories: SystemPromptModelCategorySummary[] | undefined): string {
  if (!categories || categories.length === 0) {
    return '- (none defined yet)';
  }
  return categories.map((category) => {
    const source = `${category.source_kind ?? 'project'}${category.source_ref ? `:${category.source_ref}` : ''}`;
    return `- ${category.title} [id=${category.id}, source=${source}]`;
  }).join('\n');
}

function buildEdgeModelList(models: SystemPromptModelSummary[]): string {
  const edgeModels = models.filter((model) => model.target_kind === 'edge' || model.target_kind === 'both');
  if (edgeModels.length === 0) {
    return '- (none defined yet)';
  }

  return edgeModels.map((model) => {
    const details = [
      `key=${model.key}`,
      `directed=${model.directed ?? false}`,
      `style=${model.line_style ?? 'solid'}`,
      ...(model.description ? [`description=${model.description}`] : []),
    ];
    return `- ${model.name} [id=${model.id}]: ${details.join(', ')}`;
  }).join('\n');
}

function buildRelationalSchemaSection(schemas: SystemPromptSchemaSummary[]): string {
  const lines: string[] = [];

  for (const schema of schemas) {
    for (const field of schema.fields ?? []) {
      if (!isRelationalField(field)) {
        continue;
      }

      const models = [
        `type=${formatFieldType(field.field_type)}`,
        field.required ? 'required' : 'optional',
        ...(field.meaning_bindings && field.meaning_bindings.length > 0 ? [`meanings=${field.meaning_bindings.join('|')}`] : []),
        ...(field.generated_by_model ? ['model-generated'] : []),
        ...(field.bindings && field.bindings.length > 0
          ? [`bindings=${field.bindings.map((binding) => `${binding.kind}${binding.source_schema_name ? `:${binding.source_schema_name}` : ''}`).join('|')}`]
          : []),
      ];
      lines.push(
        `- ${schema.name}.${field.name} [${models.join(', ')}]`,
      );
    }
  }

  if (lines.length === 0) {
    return '- (none modeled yet)';
  }

  return lines.join('\n');
}

function collectNetworkTreeLines(
  nodes: SystemPromptNetworkTreeSummary[] | undefined,
  depth: number,
  lines: string[],
  maxLines: number,
): void {
  if (!nodes || nodes.length === 0 || lines.length >= maxLines) {
    return;
  }

  for (const node of nodes) {
    if (lines.length >= maxLines) {
      return;
    }
    const kind = node.kind ? `, kind=${node.kind}` : '';
    lines.push(`${'  '.repeat(depth)}- ${node.name} [id=${node.id}${kind}]`);
    collectNetworkTreeLines(node.children, depth + 1, lines, maxLines);
  }
}

function buildNetworkContextSection(
  universeNetwork: SystemPromptNetworkSummary | null | undefined,
  ontologyNetwork: SystemPromptNetworkSummary | null | undefined,
  networkTree: SystemPromptNetworkTreeSummary[] | undefined,
  networkTypes: SystemPromptNetworkTypeSummary[] | undefined,
): string {
  const lines: string[] = [
    `- universe=${universeNetwork ? `${universeNetwork.name} [id=${universeNetwork.id}]` : 'none'}`,
    `- ontology=${ontologyNetwork ? `${ontologyNetwork.name} [id=${ontologyNetwork.id}]` : 'none'}`,
    '- universe_role=app-wide project portal network; do not edit it like a normal network',
    '- ontology_role=project ontology network for schemas, semantic models, and their relations',
  ];

  const treeLines: string[] = [];
  collectNetworkTreeLines(networkTree, 0, treeLines, 12);
  lines.push(treeLines.length > 0 ? '- tree_preview:' : '- tree_preview: (none yet)');
  if (treeLines.length > 0) {
    lines.push(...treeLines);
    const hasOverflow = JSON.stringify(networkTree ?? []).length > 0 && treeLines.length === 12;
    if (hasOverflow) {
      lines.push('- ...');
    }
  }

  const typeLines = (networkTypes ?? []).slice(0, 12).map((networkType) =>
    `  - ${networkType.name} [id=${networkType.id}, key=${networkType.key}, runtime=${networkType.surface_runtime}, source=${networkType.source_kind}]`);
  lines.push(typeLines.length > 0 ? '- network_types:' : '- network_types: (none available)');
  lines.push(...typeLines);

  return lines.join('\n');
}

export function buildSystemPrompt(
  params: SystemPromptParams,
  behavior: NarreBehaviorSettings = DEFAULT_NARRE_BEHAVIOR_SETTINGS,
): string {
  const {
    projectId,
    projectName,
    projectRootDir,
    schemas,
    models,
    modelCategories,
    networkTree,
    networkTypes,
  } = params;
  const universeNetwork = params.universeNetwork;
  const ontologyNetwork = params.ontologyNetwork;

  const modelList = buildModelList(models);
  const modelCategoryList = buildModelCategoryList(modelCategories);
  const schemaSurfaceList = buildSchemaSurfaceList(schemas);
  const relationalSchema = buildRelationalSchemaSection(schemas);
  const edgeModelList = buildEdgeModelList(models);
  const networkContext = buildNetworkContextSection(universeNetwork, ontologyNetwork, networkTree, networkTypes);

  return `You are Narre, the AI assistant for Netior (Map of Instances).
You help users model and organize a Netior project graph.

## Current Execution
- current_project_id=${projectId}
- current_project_name=${projectName}
- current_project_root=${projectRootDir ?? '(unknown)'}

The active project is already fixed for this run. Do not search for which project to use unless the user explicitly asks for cross-project work.

## Project Modeling Digest
Use this digest as the primary search surface before calling tools.

## Semantic Models (${models.length})
${modelList}

## Model Category Instances (${modelCategories?.length ?? 0})
${modelCategoryList}

## Schema Search Surfaces (${schemas.length})
${schemaSurfaceList}

## Schema Field Relation Map
${relationalSchema}

## Edge Models (${models.filter((model) => model.target_kind === 'edge' || model.target_kind === 'both').length})
${edgeModelList}

## Network Context
${networkContext}

## Search Strategy
- Start from the modeling digest in this prompt: schemas, semantic models, meanings, fields, meaning bindings, field relations, edge models, and network hierarchy.
- For bootstrap or early-structure work, reason ontology-first: elicit entity kinds, relation kinds, artifact kinds, and workflow structure from the user before deciding network splits or schemas.
- Treat networks as a workspace projection of user-supplied ontology, not as the first thing the user must specify.
- Before searching instances, identify these three things from the user request and modeling digest first:
  1. likely target schema
  2. likely fields or meaning bindings
  3. whether another schema must be resolved first through a typed reference
- Treat field relations like an ORM map:
  - if Task.owner -> Person exists, resolve Person first when the user searches by owner
  - if Document.supersedes -> Document exists, use that typed field before inventing a graph edge search
- Distinguish these layers:
  - object, schema, or model change
  - instance instance search or mutation
  - node placement or network structure change
  - layout/view change
- Distinguish representation grammar from ontology:
  - schema/model defines what exists and what it means in the user's work world
  - network type defines the kind of work surface
  - node type and edge type define how objects and relations are represented inside that surface
  - detailed representation grammar authoring belongs in the network-representation skill
- Model categories are instances under the built-in Model Category schema. Do not store or invent model category strings.
- To classify a model, use a Model Category instance ID. If missing, inspect or create the category instance first.
- Network group nodes are projections from object fields or relations, not standalone taxonomy/type-group objects.
- Use edge-target models for graph-edge meaning.
- Use schema fields for instance property filtering, typed references, and type-level relations.
- Ask a short confirmation only when the structural meaning can materially diverge:
  - field vs edge
  - inline enum vs instance-backed choice
  - single vs multi
  - required vs optional
  - merge/split/refactor/migration that may change existing data

## Netior Editor Content Semantics
- Instance content may contain Netior Editor semantic tokens such as [[target:...]] mentions and ::netior-embed{...} blocks.
- These tokens are stored document occurrences, not Narre chat mentions. Do not merge their format with conversational mentions.
- When agent-readable instance content includes "Resolved Content References", treat that section as the authoritative resolved meaning for those raw editor tokens.
- Mention, embed, and annotation occurrences can point to an object, content section, property field/value, properties subset, interactive view, network view, or file preview.
- If a resolved editor occurrence has relationship_id, use that relationship as the semantic source of truth. The raw token is only the editor representation.
- To create or change relationships, use relationship tools. To make a relationship visible in a network, use edge tools with relationship_id. To change stored instance body text, use the high-level instance update flow rather than inventing low-level token-management operations.

## Tool Policy
- Stable project schemas, semantic models, field search surfaces, and network hierarchy index are already in this prompt. Do not broad-search for them again unless the live state may have diverged.
- Prefer this decision order:
  1. mentioned object
  2. prompt digest
  3. targeted lookup
  4. broad discovery
- Use tools for live state, IDs that are still missing, membership, current values, ambiguity resolution, candidate sets, and destructive-change verification.
- Do not re-fetch model lists or network hierarchy just because those tools exist.
- For custom network, node, or edge type authoring, use the network-representation skill instead of carrying detailed grammar rules in the base prompt.
- The active project is already bound for this run. Do not search for project identity or pass raw 'project_id' values unless the user explicitly asks for cross-project work.
- When a tool supports default project binding, omit 'project_id' and use the current project by default.
- Prefer one precise inspection over multiple exploratory searches.

## Schema Field Authoring
- For inline select, multi-select, and radio choices, pass options as comma-separated values or as {"choices":["..."]}; Netior stores these as structured choices, not prose.
- When a field's UI behavior is schema composition or schema extension, persist it as a field binding. You may pass behavior plus source_schema_id, or an explicit bindings array.
- When a select/radio/multi-select field should choose instances from another schema, pass source_schema_id so the field saves an instance_select or instance_multi_select binding.
- For conditional_field, computed_field, and derived_collection authoring, use the schema-field-behavior skill.
- Do not treat field_type alone as field behavior. field_type controls primitive value storage; behavior and instance-backed choice sources live in bindings.

## Interactive View Authoring
- Interactive View is specialized TSX/manifest authoring. Use the interactive-view skill when the user asks to create or revise an instance editor view.
- In the base prompt, do not carry Interactive View SDK, manifest, or dry-run details; those belong to the skill.

## Netior DSL Authoring
- Netior DSL is a JSON AST for read-only query/expression evaluation. It is not a business-specific function library and it is not a Rule object.
- Models are domain-independent meanings, not domain entities. Prefer built-in/curated models and existing meaning bindings before creating any custom model.
- Use list_model_catalog or list_models to inspect reusable model meaning. Do not create custom models unless the user explicitly asks or confirms that the catalog is insufficient.
- Detailed conditional/computed/derived field behavior DSL authoring belongs in the schema-field-behavior skill.
- If a DSL evaluation returns ambiguity, do not choose silently. Inspect candidates or ask the user.

## Guidelines
- When the project has little or no structure, proactively offer a bootstrap interview based on the project topic. Start from the user's domain answers, then project them into candidate networks, schemas, semantic models, meanings, and fields. Avoid making the user choose Netior-internal structures prematurely, but do not define the user's domain for them.
- Always confirm before destructive operations (delete, bulk modify).
- When deleting an entity with dependent data, warn about cascading effects.
- Respond in the same language the user uses.
- Be concise and action-oriented.
- Before searching or mutating instances, identify the target schema and likely fields or meaning bindings from the modeling digest first.
- For field-level schema work, inspect fields, meanings, and instance properties before changing relationship structure.
- Before assigning reference or choice values, inspect the candidate set instead of guessing from memory.
- Use graph primitives when the user is talking about network structure, navigation hierarchy, node placement, or independent object-to-object relations in the graph.
- Do not replace a true graph relation with a field just because a field tool exists, and do not replace a model field with an edge just because a graph tool exists.
- When creating multiple entities, execute tool calls sequentially and report progress.
${buildBehaviorGuidanceSection(behavior)}`;
}
