import type {
  NarreToolApprovalMode,
  NarreToolCategory,
  NarreToolKind,
  NarreToolMetadata,
  NetiorMcpToolProfile,
  NetiorMcpToolScope,
  NetiorMcpToolSpec,
} from '../types/index.js';

type NetiorMcpToolSpecEntry = Omit<NetiorMcpToolSpec, 'key' | 'isMutation' | 'approvalMode'> & {
  isMutation?: boolean;
  approvalMode?: NarreToolApprovalMode;
};

export const NETIOR_MCP_TOOL_SPECS = {
  world_list: {
    displayName: 'List Worlds',
    description: 'List registered worlds.',
    category: 'world',
    kind: 'query',
    scope: 'app',
    profiles: ['discovery'],
  },
  world_get: {
    displayName: 'Get World',
    description: 'Get a world root node and settings.',
    category: 'world',
    kind: 'query',
    scope: 'world',
    defaultWorldBinding: true,
  },
  world_create: {
    displayName: 'Create World',
    description: 'Create a world and bind its root directory.',
    category: 'world',
    kind: 'mutation',
    scope: 'app',
  },
  world_rename: {
    displayName: 'Rename World',
    description: 'Rename a world root node.',
    category: 'world',
    kind: 'mutation',
    scope: 'world',
    defaultWorldBinding: true,
  },
  world_archive: {
    displayName: 'Archive World',
    description: 'Archive a world without deleting its history.',
    category: 'world',
    kind: 'mutation',
    scope: 'world',
    defaultWorldBinding: true,
  },

  model_create: {
    displayName: 'Create Model',
    description: 'Create a model under a world or another model.',
    category: 'model',
    kind: 'mutation',
    scope: 'world',
    defaultWorldBinding: true,
  },
  model_list: {
    displayName: 'List Models',
    description: 'List models in a world.',
    category: 'model',
    kind: 'query',
    scope: 'world',
    profiles: ['discovery'],
    defaultWorldBinding: true,
  },
  model_summary: {
    displayName: 'Model Summary',
    description: 'Summarize definitions, instances, resources, and relations for a model.',
    category: 'model',
    kind: 'analysis',
    scope: 'model',
    profiles: ['discovery'],
  },
  model_list_definitions: {
    displayName: 'List Model Definitions',
    description: 'List visible kinds, properties, and relation kinds for a model.',
    category: 'definition',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },
  model_bind_directory: {
    displayName: 'Bind Model Directory',
    description: 'Bind a directory subtree to a model.',
    category: 'model',
    kind: 'mutation',
    scope: 'model',
  },
  model_validate_directory_bindings: {
    displayName: 'Validate Directory Bindings',
    description: 'Validate model directory binding uniqueness and overlap constraints.',
    category: 'model',
    kind: 'analysis',
    scope: 'model',
  },
  world_node_get_tree: {
    displayName: 'World Tree',
    description: 'Get the world/model tree.',
    category: 'model',
    kind: 'query',
    scope: 'world',
    profiles: ['discovery'],
    defaultWorldBinding: true,
  },
  world_node_get_visible_definitions: {
    displayName: 'Visible Definitions',
    description: 'Get definitions visible from a world/model node, including ancestors.',
    category: 'definition',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },

  kind_create: {
    displayName: 'Create Kind',
    description: 'Define a kind in a world/model node.',
    category: 'definition',
    kind: 'mutation',
    scope: 'model',
  },
  kind_list: {
    displayName: 'List Kinds',
    description: 'List kinds directly defined in a world/model node.',
    category: 'definition',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },
  kind_list_visible: {
    displayName: 'List Visible Kinds',
    description: 'List kinds visible from a model, including ancestors.',
    category: 'definition',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },
  kind_archive: {
    displayName: 'Archive Kind',
    description: 'Archive a kind definition.',
    category: 'definition',
    kind: 'mutation',
    scope: 'model',
  },

  property_create: {
    displayName: 'Create Property',
    description: 'Define a property on a kind.',
    category: 'definition',
    kind: 'mutation',
    scope: 'model',
  },
  property_list: {
    displayName: 'List Properties',
    description: 'List properties for a kind.',
    category: 'definition',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },
  property_update_value_type: {
    displayName: 'Update Property Type',
    description: 'Change the value type for a property definition.',
    category: 'definition',
    kind: 'mutation',
    scope: 'model',
  },
  property_reorder: {
    displayName: 'Reorder Properties',
    description: 'Change display order of properties within a kind.',
    category: 'definition',
    kind: 'mutation',
    scope: 'model',
  },

  relation_kind_create: {
    displayName: 'Create Relation Kind',
    description: 'Define a relation kind with subject/object endpoint policies.',
    category: 'relation',
    kind: 'mutation',
    scope: 'model',
  },
  relation_kind_list: {
    displayName: 'List Relation Kinds',
    description: 'List relation kinds directly defined in a world/model node.',
    category: 'relation',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },
  relation_kind_list_visible: {
    displayName: 'List Visible Relation Kinds',
    description: 'List relation kinds visible from a model, including ancestors.',
    category: 'relation',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },
  relation_kind_update_endpoint_policy: {
    displayName: 'Update Endpoint Policy',
    description: 'Update subject/object kind policies for a relation kind.',
    category: 'relation',
    kind: 'mutation',
    scope: 'model',
  },

  instance_create: {
    displayName: 'Create Instance',
    description: 'Create an instance in a home model.',
    category: 'instance',
    kind: 'mutation',
    scope: 'model',
  },
  instance_list: {
    displayName: 'List Instances',
    description: 'List instances in a model.',
    category: 'instance',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },
  instance_assign_kind: {
    displayName: 'Assign Kind',
    description: 'Assign a kind to an instance as a candidate or accepted assignment.',
    category: 'instance',
    kind: 'mutation',
    scope: 'object',
  },
  instance_link_resource: {
    displayName: 'Link Resource',
    description: 'Link an instance to a resource as source mapping.',
    category: 'resource',
    kind: 'mutation',
    scope: 'object',
  },
  instance_neighborhood: {
    displayName: 'Instance Neighborhood',
    description: 'Get related instances, relations, and resources around an instance.',
    category: 'instance',
    kind: 'analysis',
    scope: 'object',
    profiles: ['discovery'],
  },

  property_value_create: {
    displayName: 'Create Property Value',
    description: 'Record a candidate or accepted property value on an instance.',
    category: 'instance',
    kind: 'mutation',
    scope: 'object',
  },
  property_value_list: {
    displayName: 'List Property Values',
    description: 'List property values for an instance.',
    category: 'instance',
    kind: 'query',
    scope: 'object',
  },
  relation_create: {
    displayName: 'Create Relation',
    description: 'Record a relation assertion between two instances.',
    category: 'relation',
    kind: 'mutation',
    scope: 'model',
  },
  relation_list: {
    displayName: 'List Relations',
    description: 'List relation assertions by model or instance.',
    category: 'relation',
    kind: 'query',
    scope: 'model',
    profiles: ['discovery'],
  },
  resource_register: {
    displayName: 'Register Resource',
    description: 'Register a file, folder, URL, service object, or sub-resource.',
    category: 'resource',
    kind: 'mutation',
    scope: 'world',
    defaultWorldBinding: true,
  },
  resource_list: {
    displayName: 'List Resources',
    description: 'List resources by world or model.',
    category: 'resource',
    kind: 'query',
    scope: 'world',
    profiles: ['discovery'],
    defaultWorldBinding: true,
  },
  resource_update_observed_status: {
    displayName: 'Update Resource Status',
    description: 'Update observed, changed, missing, ignored, or archived resource status.',
    category: 'resource',
    kind: 'mutation',
    scope: 'resource',
  },

  evidence_create: {
    displayName: 'Create Evidence',
    description: 'Create evidence from a resource locator, user input, AI reasoning, calculation, or external sync.',
    category: 'evidence',
    kind: 'mutation',
    scope: 'mixed',
  },
  evidence_list_for_target: {
    displayName: 'List Evidence',
    description: 'List evidence linked to an assignment, value, or relation.',
    category: 'evidence',
    kind: 'query',
    scope: 'object',
  },
  evidence_link_to_target: {
    displayName: 'Link Evidence',
    description: 'Link evidence to a kind assignment, property value, or relation.',
    category: 'evidence',
    kind: 'mutation',
    scope: 'object',
  },

  decision_record: {
    displayName: 'Record Decision',
    description: 'Record an accept, reject, revise, or supersede decision.',
    category: 'decision',
    kind: 'mutation',
    scope: 'object',
  },
  decision_list_for_target: {
    displayName: 'List Decisions',
    description: 'List decision history for a target.',
    category: 'decision',
    kind: 'query',
    scope: 'object',
  },

  domain_event_list: {
    displayName: 'List Domain Events',
    description: 'List domain events for a world or model.',
    category: 'event',
    kind: 'query',
    scope: 'world',
    profiles: ['discovery'],
    defaultWorldBinding: true,
  },
  view_create: {
    displayName: 'Create View',
    description: 'Create an explorer or canvas view owned by a model.',
    category: 'view',
    kind: 'mutation',
    scope: 'model',
  },
  view_project: {
    displayName: 'Project View',
    description: 'Compute display data for an explorer or canvas view.',
    category: 'view',
    kind: 'analysis',
    scope: 'model',
  },
  view_save_layout: {
    displayName: 'Save View Layout',
    description: 'Save layout state for a view.',
    category: 'view',
    kind: 'mutation',
    scope: 'model',
  },

  list_directory: {
    displayName: 'Browse Directory',
    description: 'List contents of a directory within a world root.',
    category: 'files',
    kind: 'query',
    profiles: ['bootstrap-skill', 'bootstrap-interview', 'bootstrap-execution'],
    scope: 'world',
    defaultWorldBinding: true,
  },
  read_file: {
    displayName: 'Read File',
    description: 'Read contents of a file within a world root.',
    category: 'files',
    kind: 'query',
    profiles: ['bootstrap-skill', 'bootstrap-interview', 'bootstrap-execution'],
    scope: 'world',
    defaultWorldBinding: true,
  },
  glob_files: {
    displayName: 'Find Files',
    description: 'Find files matching a glob pattern within a world root.',
    category: 'search',
    kind: 'query',
    profiles: ['bootstrap-skill', 'bootstrap-interview', 'bootstrap-execution'],
    scope: 'world',
    defaultWorldBinding: true,
  },
  grep_files: {
    displayName: 'Search File Contents',
    description: 'Search file contents with a regex pattern within a world root.',
    category: 'search',
    kind: 'analysis',
    profiles: ['bootstrap-skill', 'bootstrap-interview', 'bootstrap-execution'],
    scope: 'world',
    defaultWorldBinding: true,
  },
  read_pdf_pages: {
    displayName: 'Read PDF Pages',
    description: 'Extract text from specified page ranges of a PDF file.',
    category: 'files',
    kind: 'analysis',
    profiles: ['index-skill'],
    scope: 'file',
  },
} as const satisfies Record<string, NetiorMcpToolSpecEntry>;

export type NetiorMcpToolKey = keyof typeof NETIOR_MCP_TOOL_SPECS;
export const DEFAULT_NETIOR_MCP_TOOL_PROFILE: NetiorMcpToolProfile = 'core';

function humanizeToolName(toolName: string): string {
  return toolName
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function inferToolCategory(toolName: string): NarreToolCategory {
  if (toolName.includes('world')) return 'world';
  if (toolName.includes('model') || toolName.includes('directory')) return 'model';
  if (toolName.includes('kind') || toolName.includes('property')) return 'definition';
  if (toolName.includes('instance')) return 'instance';
  if (toolName.includes('resource')) return 'resource';
  if (toolName.includes('relation')) return 'relation';
  if (toolName.includes('evidence')) return 'evidence';
  if (toolName.includes('decision')) return 'decision';
  if (toolName.includes('event') || toolName.includes('assignment')) return 'event';
  if (toolName.includes('view')) return 'view';
  if (toolName.includes('file') || toolName.includes('pdf')) return 'files';
  if (toolName.includes('search') || toolName.includes('glob') || toolName.includes('grep')) return 'search';
  return 'analysis';
}

function inferToolKind(toolName: string): NarreToolKind {
  if (/_(create|rename|update|archive|restore|bind|unbind|move|reorder|register|link|unlink|accept|reject|supersede|record|save|set)/.test(toolName)) {
    return 'mutation';
  }
  if (/(list|get|read|project|summary|validate|diff)/.test(toolName)) {
    return 'query';
  }
  return 'analysis';
}

function inferToolScope(toolName: string): NetiorMcpToolScope {
  if (toolName.startsWith('world_')) return 'world';
  if (toolName.startsWith('model_') || toolName.startsWith('kind_') || toolName.startsWith('property_') || toolName.startsWith('relation_kind_') || toolName.startsWith('view_')) return 'model';
  if (toolName.includes('resource')) return 'resource';
  if (toolName.includes('file') || toolName.includes('pdf')) return 'file';
  if (toolName.includes('instance') || toolName.includes('assignment') || toolName.includes('decision')) return 'object';
  return 'mixed';
}

function buildToolSpec(toolName: string, entry: NetiorMcpToolSpecEntry): NetiorMcpToolSpec {
  const isMutation = entry.isMutation ?? entry.kind === 'mutation';
  return {
    key: toolName,
    ...(entry.displayName ? { displayName: entry.displayName } : {}),
    description: entry.description,
    category: entry.category,
    kind: entry.kind,
    isMutation,
    approvalMode: entry.approvalMode ?? (isMutation ? 'prompt' : 'auto'),
    profiles: entry.profiles ?? [DEFAULT_NETIOR_MCP_TOOL_PROFILE],
    scope: entry.scope ?? inferToolScope(toolName),
    defaultWorldBinding: entry.defaultWorldBinding ?? false,
  };
}

export function normalizeNetiorToolName(toolName: string): string {
  const trimmed = toolName.trim();
  if (!trimmed) return trimmed;
  return trimmed.split('.').at(-1)?.trim() ?? trimmed;
}

export function hasNetiorMcpToolSpec(toolName: string): toolName is NetiorMcpToolKey {
  return Object.prototype.hasOwnProperty.call(NETIOR_MCP_TOOL_SPECS, normalizeNetiorToolName(toolName));
}

export function getNetiorMcpToolSpec(toolName: NetiorMcpToolKey): NetiorMcpToolSpec;
export function getNetiorMcpToolSpec(toolName: string): NetiorMcpToolSpec | null;
export function getNetiorMcpToolSpec(toolName: string): NetiorMcpToolSpec | null {
  const normalizedToolName = normalizeNetiorToolName(toolName);
  if (!hasNetiorMcpToolSpec(normalizedToolName)) return null;
  return buildToolSpec(normalizedToolName, NETIOR_MCP_TOOL_SPECS[normalizedToolName]);
}

export function listNetiorMcpToolSpecs(): NetiorMcpToolSpec[] {
  return Object.entries(NETIOR_MCP_TOOL_SPECS).map(([toolName, entry]) => buildToolSpec(toolName, entry));
}

export function isNetiorMcpToolEnabledForProfile(toolName: string, profile: NetiorMcpToolProfile): boolean {
  const spec = getNetiorMcpToolSpec(toolName);
  if (!spec) return false;
  return (spec.profiles ?? [DEFAULT_NETIOR_MCP_TOOL_PROFILE]).includes(profile);
}

export function getNarreToolMetadata(toolName: string): NarreToolMetadata {
  const normalizedToolName = normalizeNetiorToolName(toolName);
  const spec = getNetiorMcpToolSpec(normalizedToolName);
  if (spec) {
    return {
      displayName: spec.displayName ?? humanizeToolName(spec.key),
      description: spec.description,
      category: spec.category,
      kind: spec.kind,
      isMutation: spec.isMutation,
      approvalMode: spec.approvalMode,
      profiles: spec.profiles,
      scope: spec.scope,
      defaultWorldBinding: spec.defaultWorldBinding,
    };
  }

  const kind = inferToolKind(normalizedToolName);
  return {
    displayName: humanizeToolName(normalizedToolName),
    category: inferToolCategory(normalizedToolName),
    kind,
    isMutation: kind === 'mutation',
    approvalMode: kind === 'mutation' ? 'prompt' : 'auto',
    profiles: [DEFAULT_NETIOR_MCP_TOOL_PROFILE],
    scope: inferToolScope(normalizedToolName),
    defaultWorldBinding: false,
  };
}
