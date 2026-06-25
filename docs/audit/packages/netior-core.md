# packages/netior-core Audit

Status: scanning

## Initial Scope

- Target files: 94
- Existing test files: 5
- Repository files: 19
- Migration files: 61

## Initial Feature Candidates

| Candidate | Evidence | Status |
|---|---|---|
| Database connection and initialization | `src/connection.ts` | unmapped |
| Migration execution and schema evolution | `src/migrations/*.ts` | unmapped |
| Project repository behavior | `src/repositories/project.ts` | unmapped |
| Instance and property persistence | `src/repositories/instance.ts`, `instance-property.ts` | unmapped |
| Schema, field, and meaning persistence | `src/repositories/schema.ts` | unmapped |
| Model and category persistence | `src/repositories/model.ts`, `model-category.ts` | unmapped |
| Network, node, layout, and edge persistence | `src/repositories/network.ts`, `layout.ts` | unmapped |
| Relationship persistence | `src/repositories/relationship.ts` | unmapped |
| File metadata persistence | `src/repositories/file.ts` | unmapped |
| Instance content sync | `src/services/instance-content-sync.ts` | unmapped |
| Netior DSL evaluation | `src/services/netior-dsl-evaluator.ts` | unmapped |

## Feature Records

### CORE-0001 Database Connection, Migration Runner, And Runtime DB Handle

- Status: traced
- Risk: high
- Test status: indirectly-tested
- Package: `packages/netior-core`
- Locations:
  - `src/connection.ts`
  - `src/index.ts`
  - `src/__tests__/test-db.ts`
- Type: DB lifecycle
- User/caller behavior: service/runtime initializes Netior metadata storage and obtains a SQLite handle through core.
- System behavior: opens `better-sqlite3`, enables WAL, foreign keys, and busy timeout, runs pending migrations, records `_migrations`, patches partial databases, and ensures system networks exist.
- Entry points:
  - `initDatabase(dbPath, options?)`
  - `getDatabase()`
  - `closeDatabase()`
  - `hasColumn(db, table, column)`
  - `tableExists(db, table)`
- Inputs: DB path and optional native binding path
- Outputs: initialized process-global SQLite connection
- State changes: creates/updates DB schema and system rows
- Persistence: SQLite metadata DB
- Dependencies: `better-sqlite3`, migration modules, system network repository
- Failure cases: missing native binding, migration failure, partial DB patch failure, `getDatabase` before init.
- Error handling: migration failures are logged and rethrown; uninitialized access throws.
- Async/loading behavior: synchronous SQLite operations
- i18n/display relevance: none directly; migrations seed source/display fields.
- Linked indexes:
  - db-tables: migration runner
  - service-endpoints: netior-service DB owner
- Notes: Desktop must not open DB directly; netior-service owns this runtime in production.

### CORE-0002 Schema Evolution Migrations

- Status: mapped
- Risk: high
- Test status: indirectly-tested
- Package: `packages/netior-core`
- Locations:
  - `src/migrations/*.ts`
  - `src/connection.ts`
- Type: DB migration
- User/caller behavior: existing installations upgrade metadata schema without manual user action.
- System behavior: ordered migration functions evolve projects, instances, schemas, models, networks, edges, files, objects, sources, field bindings, interactive views, and relationships.
- Entry points:
  - migration array inside `initDatabase`
- Inputs: current database schema and `_migrations` state
- Outputs: upgraded database schema/data
- State changes: DDL and backfill writes
- Persistence: SQLite metadata DB
- Dependencies: migration functions and source data conventions from shared constants
- Failure cases: failed DDL/backfill, duplicate version history, legacy schema mismatch, already-applied migration edited in place.
- Error handling: migration transaction throws and prevents version insert on failure.
- Async/loading behavior: synchronous SQLite transactions
- i18n/display relevance: source provenance and built-in ontology migrations are display-sensitive.
- Linked indexes:
  - db-tables: 61 migration files
- Notes: Migration files are now classified by domain group in `db-tables`; table/column-level extraction remains pending.

### CORE-0003 Project Repository And System Network Bootstrap

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/project.ts`
  - `src/repositories/system-networks.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: projects can be created, listed, updated, root-dir updated, and deleted; creation bootstraps universe/ontology network visibility.
- System behavior: persists project rows, enforces duplicate root-dir behavior, creates/deletes object records, and ensures universe/ontology network nodes.
- Entry points:
  - `createProject`
  - `listProjects`
  - `getProjectById`
  - `updateProject`
  - `updateProjectRootDir`
  - `deleteProject`
- Inputs: project create/update payloads
- Outputs: project records, booleans, or undefined
- State changes: project/object/network/layout rows
- Persistence: SQLite metadata DB
- Dependencies: object repository and system network helpers
- Failure cases: duplicate root dir, cascade deletes, missing project update/delete.
- Error handling: duplicate root dir throws; missing update returns `undefined`; missing delete returns `false`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: project object records feed display consumers.
- Linked indexes:
  - service-endpoints: `/projects`
  - ipc-channels: `project:*`
- Notes: Tests cover object-record creation/deletion and system network bootstrap.

### CORE-0004 Object Record Repository

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/objects.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: networks and references can point to normalized objects rather than per-kind IDs.
- System behavior: creates, fetches, and deletes object records by ID or `(object_type, ref_id)`.
- Entry points:
  - `createObject`
  - `getObject`
  - `getObjectByRef`
  - `deleteObject`
  - `deleteObjectByRef`
- Inputs: object type, scope, project ID, ref ID
- Outputs: object record, boolean, or undefined
- State changes: `objects` rows
- Persistence: SQLite metadata DB
- Dependencies: project/instance/schema/file/network/context repositories
- Failure cases: duplicate `object_type + ref_id`, missing object lookup/delete.
- Error handling: uniqueness violations throw; missing deletes return `false`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: object identity is a stable display and relationship boundary.
- Linked indexes:
  - service-endpoints: `/objects/by-ref`
  - ipc-channels: `object:*`
- Notes: This is a cross-cutting repository used by most persisted object types.

### CORE-0005 Instance And Instance Property Persistence

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/instance.ts`
  - `src/repositories/instance-property.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: instances can be created, searched, updated, deleted, and assigned field property values.
- System behavior: persists instance rows, object records, schema linkage, search queries, and property upserts/deletes.
- Entry points:
  - `createInstance`
  - `getInstancesByProject`
  - `updateInstance`
  - `deleteInstance`
  - `searchInstances`
  - `upsertProperty`
  - `getByInstanceId`
  - `deleteProperty`
- Inputs: instance payloads, search query, property values
- Outputs: instance/property records, arrays, booleans, or undefined
- State changes: `instances`, `objects`, and instance property rows
- Persistence: SQLite metadata DB
- Dependencies: project/schema/object repositories
- Failure cases: missing instance update/delete, project cascade delete, stale properties after instance delete.
- Error handling: missing update returns `undefined`; missing delete returns `false`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: schema/model/source identity can affect display in consumers.
- Linked indexes:
  - service-endpoints: `/instances`, `/instances/search`, `/instance-properties`
  - ipc-channels: `instance:*`, `instanceProp:*`
- Notes: Tests cover CRUD, search, cascade, and object-record synchronization.

### CORE-0006 Schema, Field, Meaning, And Binding Persistence

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/schema.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: schemas can be authored with fields, model references, semantic meanings, slot bindings, and schema composition fields.
- System behavior: persists schemas, fields, field meaning bindings, schema meanings, slot bindings, reorder state, and object records; rejects circular schema composition.
- Entry points:
  - `createSchema`
  - `listSchemas`
  - `getSchema`
  - `updateSchema`
  - `deleteSchema`
  - `createField`
  - `listFields`
  - `updateField`
  - `deleteField`
  - `reorderFields`
  - `listMeanings`
  - `ensureMeaning`
  - `updateMeaning`
  - `deleteMeaning`
  - `updateMeaningSlotBinding`
- Inputs: schema, field, meaning, binding, and ordered ID payloads
- Outputs: schema/field/meaning records, booleans, void, or undefined/null
- State changes: schema, field, meaning, binding, and object rows
- Persistence: SQLite metadata DB
- Dependencies: shared semantic definitions, object repository, model references
- Failure cases: circular composition, legacy recurrence repair, deleted referenced schema, missing update/delete.
- Error handling: circular composition throws; missing values return `undefined`, `null`, or `false` depending on function.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: schema/model/source refs and semantic keys must remain stable display inputs.
- Linked indexes:
  - service-endpoints: `/schemas`, `/schema-fields`, `/schema-meanings`
  - ipc-channels: `schema:*`, `schemaField:*`, `schemaMeaning:*`
- Notes: Tests cover semantic compatibility, structured recurrence repair, and schema composition constraints.

### CORE-0007 Model And Model Category Persistence

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/model.ts`
  - `src/repositories/model-category.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: built-in and custom models can classify objects/edges, and model categories appear as ontology-backed instances.
- System behavior: seeds built-in models, creates/updates/deletes custom models, aligns schema model references on key changes/deletes, and ensures model category schema/instances.
- Entry points:
  - `seedBuiltInModelsForProjectDb`
  - `createModel`
  - `listModels`
  - `getModel`
  - `updateModel`
  - `deleteModel`
  - `listModelCategories`
  - `ensureModelCategoryTaxonomyForProjectDb`
- Inputs: project ID, model create/update payloads, category key
- Outputs: model/category records, booleans, or undefined
- State changes: model rows, schema model refs, category schema/instance rows
- Persistence: SQLite metadata DB
- Dependencies: shared model definitions and source refs
- Failure cases: deleting/renaming model keys used by schemas, missing category seed, source identity drift.
- Error handling: missing update returns `undefined`; delete returns boolean.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: built-in models/categories must display through shared resolver by source refs.
- Linked indexes:
  - service-endpoints: `/models`, `/model-categories`
  - mcp-tools: model tools
- Notes: Tests cover built-in model seed and schema model reference alignment.

### CORE-0008 Network, Network Node, Edge, And Full Network Persistence

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/network.ts`
  - `src/repositories/system-networks.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: networks can be created, nested, listed, opened fully, populated with object nodes, connected by edges, and deleted.
- System behavior: persists network rows, object-backed nodes, edges, hierarchy, universe/ontology networks, full network aggregates, and cascade behavior.
- Entry points:
  - `createNetwork`
  - `listNetworks`
  - `getNetworkTree`
  - `getNetworkAncestors`
  - `updateNetwork`
  - `deleteNetwork`
  - `getNetworkFull`
  - `addNetworkNode`
  - `getNetworkNode`
  - `updateNetworkNode`
  - `removeNetworkNode`
  - `createEdge`
  - `getEdge`
  - `updateEdge`
  - `deleteEdge`
  - `ensureUniverseNetwork`
  - `ensureProjectOntologyNetwork`
- Inputs: network/node/edge payloads and IDs
- Outputs: network full data, records, arrays, booleans, or undefined
- State changes: network, node, edge, object, layout-related rows
- Persistence: SQLite metadata DB
- Dependencies: objects, instances, files, layout, model/relation metadata
- Failure cases: duplicate object per network, cascade delete nodes/edges, missing update/delete, legacy node type normalization.
- Error handling: duplicate constraints throw; missing update/delete returns `undefined` or `false`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: network objects carry stable object/source identities for UI display.
- Linked indexes:
  - service-endpoints: `/networks*`, `/network-nodes`, `/edges`
  - ipc-channels: `network:*`, `networkNode:*`, `edge:*`
- Notes: Tests cover full aggregate shape including node positions and edge visuals.

### CORE-0009 Layout, Node Position, And Edge Visual Persistence

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/layout.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: network canvas layout state, node positions, and per-edge visual overrides persist.
- System behavior: creates/updates/deletes layouts, upserts/removes node positions, and upserts/removes edge visuals.
- Entry points:
  - `createLayout`
  - `getLayoutByNetwork`
  - `updateLayout`
  - `deleteLayout`
  - `setNodePosition`
  - `getNodePositions`
  - `removeNodePosition`
  - `setEdgeVisual`
  - `getEdgeVisuals`
  - `removeEdgeVisual`
- Inputs: layout IDs, node/edge IDs, JSON strings
- Outputs: layout records, arrays, booleans, or void
- State changes: layout, layout node, layout edge rows
- Persistence: SQLite metadata DB
- Dependencies: network repository
- Failure cases: stale layout IDs, invalid JSON stored by callers, cascade delete on network/layout removal.
- Error handling: missing removal returns `false`; JSON validity is caller-owned.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: none
- Linked indexes:
  - service-endpoints: `/layouts/by-network`
  - ipc-channels: `layout:*`, `layoutNode:*`, `layoutEdge:*`
- Notes: Tests cover upsert conflicts and cascade behavior.

### CORE-0010 File Entity And Module Persistence

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/file.ts`
  - `src/repositories/module.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: project files/directories have metadata records, and modules can group directory paths.
- System behavior: persists file entities, metadata JSON fields, object records, modules, module directories, and one-directory-path behavior.
- Entry points:
  - `createFileEntity`
  - `getFileEntity`
  - `getFileEntityByPath`
  - `getFileEntitiesByProject`
  - `updateFileEntity`
  - `updateFileMetadataField`
  - `deleteFileEntity`
  - `createModule`
  - `listModules`
  - `updateModule`
  - `deleteModule`
  - `addModuleDirectory`
  - `listModuleDirectories`
  - `updateModuleDirectoryPath`
  - `removeModuleDirectory`
- Inputs: file/module payloads and IDs
- Outputs: file/module records, arrays, booleans, or undefined
- State changes: file, object, module, module directory rows
- Persistence: SQLite metadata DB only; real file contents stay on filesystem
- Dependencies: project/object repositories
- Failure cases: duplicate project path, cascade delete with project, stale file metadata.
- Error handling: uniqueness violations throw; missing update/delete returns `undefined` or `false`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: file object identity can feed semantic editor/display paths.
- Linked indexes:
  - service-endpoints: `/files`, `/modules`, `/module-directories`
  - ipc-channels: `file:*`, `module:*`, `moduleDir:*`
- Notes: Tests cover file object-record synchronization and module directory behavior.

### CORE-0011 Context And Context Member Persistence

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/context.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: users can create named network viewpoints/contexts and attach object or edge members.
- System behavior: persists contexts, context members, uniqueness constraints, object records, and cascade behavior.
- Entry points:
  - `createContext`
  - `listContexts`
  - `getContext`
  - `updateContext`
  - `deleteContext`
  - `addContextMember`
  - `removeContextMember`
  - `getContextMembers`
- Inputs: context payloads, member type/member ID, IDs
- Outputs: context/member records, arrays, booleans, or undefined
- State changes: context, context member, object rows
- Persistence: SQLite metadata DB
- Dependencies: network/object repositories
- Failure cases: duplicate member of same type, cascade delete when context/network deleted, missing updates/removals.
- Error handling: duplicate constraints throw; missing update/delete returns `undefined` or `false`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: context object records can be displayed by semantic editor paths.
- Linked indexes:
  - service-endpoints: `/contexts`
  - ipc-channels: `context:*`
- Notes: Tests cover unique member behavior and cross-type member IDs.

### CORE-0012 Interactive View Template, Preference, And State Persistence

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/interactive-view-template.ts`
  - `src/repositories/interactive-view-state.ts`
  - `src/__tests__/interactive-view-template.test.ts`
  - `src/__tests__/interactive-view-state.test.ts`
- Type: repository
- User/caller behavior: generated or user-authored interactive view templates can be stored, selected per schema/instance, and maintain per-instance runtime state.
- System behavior: lists templates by schema/instance scope, rejects unsupported project scope, persists validation/trust metadata, upserts preferences, and upserts view state.
- Entry points:
  - `listInteractiveViewTemplates`
  - `getInteractiveViewTemplate`
  - `createInteractiveViewTemplate`
  - `updateInteractiveViewTemplate`
  - `deleteInteractiveViewTemplate`
  - `getInteractiveViewPreference`
  - `upsertInteractiveViewPreference`
  - `getInteractiveViewSchemaPreference`
  - `upsertInteractiveViewSchemaPreference`
  - `getInteractiveViewState`
  - `upsertInteractiveViewState`
  - `deleteInteractiveViewState`
- Inputs: template, preference, and state payloads
- Outputs: records, arrays, booleans, or undefined
- State changes: interactive view template/preference/state rows
- Persistence: SQLite metadata DB
- Dependencies: project/schema/instance repositories and shared validator contract
- Failure cases: unsupported target kind, stale selected template IDs, cascade deletion on instance removal.
- Error handling: unsupported target kind throws; missing lookup returns `undefined`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: template names are user-authored/custom text.
- Linked indexes:
  - service-endpoints: `/interactive-view-*`
  - ipc-channels: `interactiveView*`
- Notes: Template source execution safety is validated in shared/renderer runtime, not here.

### CORE-0013 Editor Preferences And Settings Persistence

- Status: traced
- Risk: medium
- Test status: partially-tested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/editor-prefs.ts`
  - `src/repositories/settings.ts`
  - `src/__tests__/repositories.test.ts`
- Type: repository
- User/caller behavior: editor view preferences and app settings can persist between sessions.
- System behavior: upserts per-instance editor prefs and get/set/delete key-value settings.
- Entry points:
  - `getEditorPrefs`
  - `upsertEditorPrefs`
  - `getSetting`
  - `setSetting`
  - `deleteSetting`
- Inputs: instance ID, editor prefs payload, setting key/value
- Outputs: preference record, setting string, void, or undefined
- State changes: editor preference and settings rows
- Persistence: SQLite metadata DB
- Dependencies: instance repository
- Failure cases: cascade delete when instance removed, stale setting keys, missing prefs.
- Error handling: missing prefs return `undefined`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: none
- Linked indexes:
  - service-endpoints: editor prefs and config/settings surfaces
  - ipc-channels: `editorPrefs:*`, `config:*`
- Notes: Editor prefs are tested; settings repository needs direct test confirmation in later pass.

### CORE-0014 Network Representation Type Persistence

- Status: mapped
- Risk: medium
- Test status: untested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/network-representation.ts`
- Type: repository
- User/caller behavior: network representation primitives/types can be listed and authored for layouts and Narre/MCP tooling.
- System behavior: persists network types, node types, and edge types with create/list/get/update/delete functions.
- Entry points:
  - `listNetworkTypes`
  - `getNetworkType`
  - `getNetworkTypeByKey`
  - `createNetworkType`
  - `updateNetworkType`
  - `deleteNetworkType`
  - `listNodeTypes`
  - `getNodeType`
  - `createNodeType`
  - `updateNodeType`
  - `deleteNodeType`
  - `listEdgeTypes`
  - `getEdgeType`
  - `createEdgeType`
  - `updateEdgeType`
  - `deleteEdgeType`
- Inputs: project/network type IDs and create/update payloads
- Outputs: type records, arrays, booleans, or undefined
- State changes: network representation type rows
- Persistence: SQLite metadata DB
- Dependencies: network representation migrations and MCP tools
- Failure cases: stale type IDs, deletion while used by layouts/nodes/edges, key collisions.
- Error handling: missing update/delete returns `undefined` or `false`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: type labels may become user-facing custom text.
- Linked indexes:
  - service-endpoints: `/network-types`, `/node-types`, `/edge-types`
  - mcp-tools: network representation tools
- Notes: Initial scan did not find direct core tests for this repository; mark as untested until proven otherwise.

### CORE-0015 Relationship Persistence

- Status: mapped
- Risk: high
- Test status: untested
- Package: `packages/netior-core`
- Locations:
  - `src/repositories/relationship.ts`
  - `src/migrations/054-relationships.ts`
- Type: repository
- User/caller behavior: semantic relationships can be created, updated, deleted, listed, fetched, and matched to occurrences.
- System behavior: persists relationship records and occurrence lookups used by network/MCP/Narre relationship tooling.
- Entry points:
  - `listRelationships`
  - `getRelationship`
  - `createRelationship`
  - `updateRelationship`
  - `deleteRelationship`
  - `listRelationshipOccurrences`
- Inputs: relationship filters, IDs, create/update payloads
- Outputs: relationship records, occurrence arrays, booleans, or undefined
- State changes: relationship rows
- Persistence: SQLite metadata DB
- Dependencies: relationship migration, object/network/edge references
- Failure cases: stale object/edge refs, deletion with occurrences, filter mismatch.
- Error handling: missing update/delete returns `undefined` or `false`.
- Async/loading behavior: synchronous SQLite
- i18n/display relevance: relationship labels/descriptions may be user-facing custom text.
- Linked indexes:
  - service-endpoints: `/relationships`
  - ipc-channels: `relationship:*`
  - mcp-tools: relationship tools
- Notes: Initial scan did not find direct tests for the new relationship repository.

### CORE-0016 Instance Content Agent Serialization And Parsing

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/services/instance-content-sync.ts`
  - `src/__tests__/instance-content-sync.test.ts`
- Type: service
- User/caller behavior: instance content and properties can be serialized for an agent and parsed back without importing resolved reference sections as content.
- System behavior: renders templates, serializes instance fields/content/references, resolves semantic content references, and parses agent-authored markdown into title/properties/content.
- Entry points:
  - `serializeToAgent`
  - `resolveSemanticContentReferences`
  - `parseFromAgent`
  - `renderTemplate`
- Inputs: instance/schema/content data, fields, agent markdown
- Outputs: serialized markdown or parsed content/properties
- State changes: none in service; callers persist parsed results
- Persistence: none directly
- Dependencies: shared semantic editor tokens and schema field types
- Failure cases: malformed agent markdown, stale field labels, accidental import of generated reference sections.
- Error handling: parser returns best-effort parsed result.
- Async/loading behavior: none
- i18n/display relevance: serialized labels may use user-facing field names.
- Linked indexes:
  - ipc-channels: `instance:syncToAgent`, `instance:syncFromAgent`
  - narre-events: agent content sync flows
- Notes: Test specifically guards against resolved content references being parsed back into user content.

### CORE-0017 Netior DSL Evaluation

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/netior-core`
- Locations:
  - `src/services/netior-dsl-evaluator.ts`
  - `src/__tests__/netior-dsl-evaluator.test.ts`
- Type: service
- User/caller behavior: dynamic field behavior and interactive views can evaluate object, property, network, relative, and discovery expressions.
- System behavior: evaluates shared DSL expressions against repositories, supports draft overrides, follows instance reference fields, discovers schemas by field meaning, and resolves objects in network scope.
- Entry points:
  - `evaluateNetiorDsl`
  - `evaluateNetiorDslFieldBehaviorConfig`
  - `parseNetiorDslFieldBehaviorConfig`
- Inputs: DSL expression/config and evaluation context
- Outputs: `NetiorDslEvalResult`, parsed config, or null
- State changes: none
- Persistence: reads SQLite metadata DB through repositories
- Dependencies: shared DSL types, schema/instance/property/network/object repositories
- Failure cases: missing current object/schema/network, invalid query shape, ambiguous or missing field/object references, type mismatch.
- Error handling: returns structured DSL error result.
- Async/loading behavior: synchronous repository reads
- i18n/display relevance: none
- Linked indexes:
  - service-endpoints: `/dsl/evaluate`, `/eval/query`
  - mcp-tools: `evaluate_dsl`, `validate_dsl`
- Notes: Shape validation lives in shared; runtime evaluation lives here.
