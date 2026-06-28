# packages/netior-mcp Audit

Status: scanning

## Initial Scope

- Target files: 30
- Existing test files: 0
- Shared MCP tool specs: 87

## Initial Feature Candidates

| Candidate | Evidence | Status |
|---|---|---|
| MCP server bootstrap | `src/index.ts` | unmapped |
| netior-service client | `src/netior-service-client.ts` | unmapped |
| Schema/model/instance tools | `src/tools/*-tools.ts` | unmapped |
| Network/node/edge/relationship tools | `src/tools/*-tools.ts` | unmapped |
| Filesystem/PDF tools | `src/tools/filesystem-tools.ts`, `pdf-tools.ts` | unmapped |
| Shared tool registry | `src/tools/shared-tool-registry.ts` | unmapped |
| Change event emission | `src/events.ts` | unmapped |

## Feature Records

### MCP-0001 MCP Stdio Server Bootstrap

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/index.ts`
  - `package.json`
- Type: MCP server lifecycle
- User/caller behavior: external MCP clients can launch `netior-mcp` over stdio and access Netior tools.
- System behavior: redirects `console.log` to stderr to preserve stdio protocol, checks netior-service health, creates `McpServer`, registers all tools, connects `StdioServerTransport`, logs active profile/default project/service URL, and exits on SIGINT/SIGTERM.
- Entry points:
  - package bin `netior-mcp`
  - `node packages/netior-mcp/dist/index.cjs`
- Inputs: `NETIOR_SERVICE_URL`, `NETIOR_SERVICE_PORT`, `NETIOR_MCP_TOOL_PROFILE`, `NETIOR_MCP_DEFAULT_PROJECT_ID`
- Outputs: MCP stdio server
- State changes: none directly
- Persistence: none
- Dependencies: `@modelcontextprotocol/sdk`, netior-service health endpoint
- Failure cases: netior-service unreachable, invalid stdio output, process signal shutdown, fatal registration/runtime error.
- Error handling: startup errors are logged to stderr and exit process with code 1.
- Async/loading behavior: async health check and stdio server connection
- i18n/display relevance: tool descriptions come from shared MCP specs.
- Linked indexes:
  - mcp-tools: all registered tools
  - service-endpoints: `/health`
- Notes: stdout is reserved for MCP protocol.

### MCP-0002 Tool Registration Profile Gate And Project Binding

- Status: verified
- Risk: medium
- Test status: indirectly-tested
- Package: `packages/netior-mcp`
- Locations:
  - `src/tools/index.ts`
  - `src/tools/shared-tool-registry.ts`
- Type: MCP tool registration contract
- User/caller behavior: only tools enabled for the active Narre/MCP profile are exposed, and tools can omit `project_id` when a default active project is bound.
- System behavior: resolves active tool profile, provides project ID zod schemas, resolves `NETIOR_MCP_DEFAULT_PROJECT_ID`, fetches shared tool spec, and calls `server.tool`.
- Entry points:
  - `registerAllTools`
  - `registerNetiorTool`
  - `getActiveNetiorMcpToolProfile`
  - `resolveProjectId`
  - `resolveNullableProjectId`
- Inputs: tool key, zod schema, handler, env profile/default project
- Outputs: MCP tool registrations or skipped tools
- State changes: MCP server tool registry
- Persistence: none
- Dependencies: SH-0006 MCP spec registry
- Failure cases: no active project binding, unknown/default profile fallback, profile hides expected tool.
- Error handling: missing project binding throws; disabled tools are silently not registered.
- Async/loading behavior: none in registration
- i18n/display relevance: uses shared spec description and key.
- Linked indexes:
  - mcp-tools: 87 tool registration calls
- Notes: Initial scan confirmed 87 `registerNetiorTool` calls, matching 87 shared specs.

### MCP-0003 netior-service HTTP Client

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/netior-service-client.ts`
- Type: HTTP client
- User/caller behavior: MCP tools can operate on Netior data by calling the local service instead of touching SQLite directly.
- System behavior: resolves service base URL, builds query strings, sends JSON requests, unwraps `NetiorServiceResponse`, throws on HTTP/non-JSON/service errors, and exposes typed client functions for projects, schemas, models, instances, networks, relationships, files, interactive views, and DSL.
- Entry points:
  - `getNetiorServiceUrl`
  - exported service client functions
- Inputs: service URL env vars, route paths, JSON payloads
- Outputs: typed service data or thrown errors
- State changes: through netior-service only
- Persistence: SQLite metadata DB via service
- Dependencies: SVC-0001 through SVC-0005
- Failure cases: service unavailable, non-JSON response, `{ ok: false }`, HTTP error, stale route contract.
- Error handling: throws `Error` for tool handlers to convert into MCP `isError` responses.
- Async/loading behavior: async `fetch`
- i18n/display relevance: none directly
- Linked indexes:
  - service-endpoints: netior-service route groups
- Notes: This preserves the DB ownership boundary.

### MCP-0004 Schema, Field, Meaning, Model, And Candidate Tools

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/tools/schema-tools.ts`
  - `src/tools/schema-field-tools.ts`
  - `src/tools/schema-meaning-tools.ts`
  - `src/tools/model-tools.ts`
  - `src/tools/candidate-source-tools.ts`
  - `src/tools/schema-surface.ts`
  - `src/tools/model-surface.ts`
- Type: MCP tools / ontology authoring
- User/caller behavior: agents can list/create/update/delete schemas, fields, meanings, models, model categories, and field candidates.
- System behavior: validates inputs with zod, resolves project ID, normalizes agent-facing field/model payloads, checks model/meaning keys, calls netior-service, emits change logs for mutations, and returns JSON text content.
- Entry points:
  - `list_schemas`, `create_schema`, `update_schema`, `delete_schema`
  - `list_schema_fields`, `create_schema_field`, `update_schema_field`, `set_field_behavior_dsl`, `set_conditional_field_visibility`, `delete_schema_field`, `reorder_schema_fields`
  - `list_schema_meanings`, `ensure_schema_meaning`, `update_schema_meaning`, `delete_schema_meaning`, `update_schema_meaning_slot`
  - `list_models`, `list_model_categories`, `get_model`, `create_model`, `update_model`, `delete_model`
  - `get_field_candidates`
- Inputs: project/schema/field/model IDs and authoring payloads
- Outputs: JSON text content or MCP error content
- State changes: schema, field, meaning, model, and binding rows via service
- Persistence: SQLite metadata DB via netior-service
- Dependencies: CORE-0006, CORE-0007, SVC-0003, SH-0005, SH-0006
- Failure cases: invalid key format, unknown built-in meaning, missing schema/model/field, circular schema behavior surfaced from service, missing active project.
- Error handling: catches errors and returns `{ isError: true }`; missing lookups return explicit error content.
- Async/loading behavior: async service calls
- i18n/display relevance: tool display metadata uses shared `narre.tools.*`; data display uses stable IDs/keys plus names.
- Linked indexes:
  - mcp-tools: schema/model/candidate tool groups
- Notes: Interactive behavior DSL tools are partly here and partly in DSL/interactive-view records.

### MCP-0005 Instance, Property, Object, Network, Node, Edge, Layout, And Relationship Tools

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/tools/instance-tools.ts`
  - `src/tools/instance-property-tools.ts`
  - `src/tools/object-tools.ts`
  - `src/tools/network-tools.ts`
  - `src/tools/network-node-tools.ts`
  - `src/tools/edge-tools.ts`
  - `src/tools/relationship-tools.ts`
- Type: MCP tools / graph data operations
- User/caller behavior: agents can browse and mutate instances, properties, objects, networks, network nodes, edges, and relationships.
- System behavior: validates zod schemas, resolves project binding, calls service client CRUD/read endpoints, returns JSON text, and logs changes for mutations.
- Entry points:
  - `list_instances`, `create_instance`, `update_instance`, `delete_instance`
  - `get_instance_properties`, `upsert_instance_property`, `delete_instance_property`
  - `get_object`, `get_object_by_ref`
  - `list_networks`, `create_network`, `update_network`, `delete_network`, `get_network_full`, `get_universe_network`, `get_project_ontology_network`, `get_network_tree`, `get_network_ancestors`
  - `create_network_node`, `update_network_node`, `delete_network_node`
  - `create_edge`, `get_edge`, `update_edge`, `delete_edge`
  - `list_relationships`, `get_relationship`, `create_relationship`, `update_relationship`, `delete_relationship`, `list_relationship_occurrences`
- Inputs: project IDs, object IDs, network IDs, relationship/edge payloads
- Outputs: JSON text content or MCP error content
- State changes: instance/property/network/node/edge/relationship rows via service
- Persistence: SQLite metadata DB via netior-service
- Dependencies: CORE-0004, CORE-0005, CORE-0008, CORE-0015, SVC-0003
- Failure cases: stale IDs, missing active project, duplicate object in network, service relationship gaps, cascade deletes.
- Error handling: catches errors and returns MCP error content.
- Async/loading behavior: async service calls
- i18n/display relevance: returns stable object refs and user-authored names for display consumers.
- Linked indexes:
  - mcp-tools: instance/network/object/edge/relationship groups
- Notes: Relationship core tests were not found in the initial scan, so tools relying on that path inherit that test gap.

### MCP-0006 Network Representation Tools

- Status: mapped
- Risk: medium
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/tools/network-representation-tools.ts`
- Type: MCP tools / network type authoring
- User/caller behavior: agents can inspect representation primitives and author network, node, and edge types.
- System behavior: registers tools for list/get/create/update/delete of network types, node types, and edge types using nullable project binding for app/project scope.
- Entry points:
  - `list_network_representation_primitives`
  - `list_network_types`, `get_network_type`, `create_network_type`, `update_network_type`, `delete_network_type`
  - `list_node_types`, `create_node_type`, `update_node_type`, `delete_node_type`
  - `list_edge_types`, `create_edge_type`, `update_edge_type`, `delete_edge_type`
- Inputs: project ID/null, type IDs, create/update payloads
- Outputs: JSON text content or MCP error content
- State changes: network representation type rows through service
- Persistence: SQLite metadata DB via netior-service
- Dependencies: CORE-0014, SVC-0003
- Failure cases: stale type IDs, project/app scope confusion, service/core untested behavior.
- Error handling: catches errors and returns MCP error content.
- Async/loading behavior: async service calls
- i18n/display relevance: returned type names are user/system display text; stable keys should drive behavior.
- Linked indexes:
  - mcp-tools: network representation groups
- Notes: This inherits CORE-0014's current direct test gap.

### MCP-0007 DSL And Interactive View Authoring Tools

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/tools/dsl-tools.ts`
  - `src/tools/interactive-view-tools.ts`
- Type: MCP tools / dynamic behavior authoring
- User/caller behavior: agents can validate/evaluate DSL and author interactive view templates/preferences.
- System behavior: validates DSL through shared/core paths, lists model catalog, validates interactive view source/manifest before create/update, generates guidance for known validation issues, and persists templates/preferences through service.
- Entry points:
  - `validate_dsl`
  - `evaluate_dsl`
  - `list_model_catalog`
  - `list_interactive_view_templates`
  - `dry_run_interactive_view_template`
  - `create_interactive_view_template`
  - `update_interactive_view_template`
  - `set_interactive_view_preference`
  - `set_interactive_view_schema_preference`
- Inputs: DSL expression/config, interactive view source, manifest JSON, template/preference IDs
- Outputs: validation/evaluation/template JSON text or MCP error content
- State changes: interactive view template/preference rows through service
- Persistence: SQLite metadata DB via netior-service
- Dependencies: SH-0009, SH-0010, CORE-0012, CORE-0017, SVC-0004
- Failure cases: invalid DSL shape, DSL runtime error, forbidden interactive view source, invalid manifest, missing template, stale selected template.
- Error handling: validation errors become MCP error content with guidance; service errors are caught.
- Async/loading behavior: async service calls
- i18n/display relevance: validation messages/guidance are literal English.
- Linked indexes:
  - mcp-tools: DSL and interactive view groups
- Notes: `create_interactive_view_template` and update with source/manifest validate before persistence.

### MCP-0008 Filesystem And PDF Tools With Path Validation

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/tools/filesystem-tools.ts`
  - `src/tools/pdf-tools.ts`
  - `src/tools/path-validation.ts`
- Type: MCP tools / filesystem and document access
- User/caller behavior: agents can list/read/search registered project files, read PDF text or rendered pages, inspect file metadata, and write PDF TOC metadata.
- System behavior: validates paths against module directories or project root, uses `fast-glob`, synchronous file reads, `pdfjs-dist`, optional `canvas` rendering, and updates file metadata through service.
- Entry points:
  - `list_directory`
  - `read_file`
  - `glob_files`
  - `grep_files`
  - `read_pdf_pages`
  - `read_pdf_pages_vision`
  - `get_file_metadata`
  - `update_file_pdf_toc`
  - `validatePath`
  - `validateProjectRootPath`
- Inputs: project ID, absolute paths, glob/regex patterns, page ranges, file ID, TOC payload
- Outputs: JSON/text/image MCP content or MCP error content
- State changes: `update_file_pdf_toc` writes file metadata through service; other tools read filesystem.
- Persistence: file metadata in SQLite; file contents are read from project filesystem.
- Dependencies: CORE-0010, SVC-0003, `fast-glob`, `pdfjs-dist`, optional `canvas`
- Failure cases: path outside allowed roots, no module paths, unreadable/binary files, invalid regex, PDF page out of bounds, missing `canvas`, missing file entity.
- Error handling: validation returns explicit MCP error content; unreadable grep files are skipped; other errors are caught.
- Async/loading behavior: async glob/PDF/service calls with synchronous file reads inside handlers.
- i18n/display relevance: none
- Linked indexes:
  - filesystem-effects: file reads/search and PDF TOC metadata write
  - mcp-tools: filesystem/PDF groups
- Notes: This is the MCP surface with the clearest security boundary.

### MCP-0009 Project Summary Tool

- Status: traced
- Risk: medium
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/tools/project-tools.ts`
- Type: MCP tool / project summary
- User/caller behavior: agents can obtain a compact project overview before planning work.
- System behavior: resolves project, concurrently fetches schemas, models, instances, networks, network types, relationships, system networks, network tree, and schema fields, then returns a summarized JSON document.
- Entry points:
  - `get_project_summary`
- Inputs: optional project ID
- Outputs: project summary JSON text or MCP error content
- State changes: none
- Persistence: reads SQLite metadata DB through service
- Dependencies: many netior-service client read endpoints
- Failure cases: missing project, stale network/schema data, large projects truncated for relationships only.
- Error handling: missing project returns MCP error content; other errors caught.
- Async/loading behavior: concurrent async service calls
- i18n/display relevance: returns user/system names but behavior should use IDs/keys.
- Linked indexes:
  - mcp-tools: project summary
- Notes: Relationship items are capped at 50 in summary output.

### MCP-0010 Change Event Logging

- Status: traced
- Risk: low
- Test status: untested
- Package: `packages/netior-mcp`
- Locations:
  - `src/events.ts`
- Type: change notification placeholder
- User/caller behavior: mutation tools produce a stderr change log for observability.
- System behavior: formats `type.action id=...` to stderr; no actual event bus or SSE broadcast exists here yet.
- Entry points:
  - `emitChange(event)`
- Inputs: `{ type, action, id }`
- Outputs: stderr log
- State changes: none
- Persistence: none
- Dependencies: mutation tool handlers
- Failure cases: none meaningful beyond lost log output.
- Error handling: none
- Async/loading behavior: none
- i18n/display relevance: none
- Linked indexes:
  - narre-events: future change streaming placeholder
- Notes: The source comment says actual SSE broadcasting would be added if HTTP transport is needed.
