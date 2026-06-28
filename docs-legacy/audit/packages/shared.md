# packages/shared Audit

Status: scanning

## Initial Scope

- Target files: 21
- Existing test files: 6
- Primary surfaces:
  - public exports from `src/index.ts`
  - shared type definitions
  - constants and IPC channel definitions
  - `NETIOR_MCP_TOOL_SPECS`
  - i18n locale files
  - display resolver behavior

## Initial Feature Candidates

| Candidate | Evidence | Status |
|---|---|---|
| Shared IPC channel contract | `src/constants/index.ts` | unmapped |
| MCP tool metadata registry | `src/constants/netior-mcp-tools.ts` | unmapped |
| Ontology/built-in display resolution | `src/display.ts`, locale files | unmapped |
| DSL shared definitions | `src/dsl/index.ts` | unmapped |
| Interactive view shared definitions | `src/interactive-view/index.ts` | unmapped |
| Semantic editor shared definitions | `src/semantic-editor.ts` | unmapped |

## Feature Records

### SH-0001 Shared Public Export Surface

- Status: verified
- Risk: low
- Test status: indirectly-tested
- Package: `packages/shared`
- Locations:
  - `src/index.ts`
- Type: package API surface
- User/caller behavior: exposes shared contracts to desktop, core, service, MCP, and Narre packages through one package entry point.
- System behavior: re-exports types, constants, i18n, display, DSL, interactive-view, and semantic-editor modules.
- Entry points:
  - `@netior/shared`
- Inputs: import specifier
- Outputs: exported shared modules
- State changes: none
- Persistence: none
- Dependencies: internal shared modules only
- Failure cases: missing export breaks downstream package imports at typecheck/build time.
- Error handling: none; build/typecheck boundary.
- Async/loading behavior: none
- i18n/display relevance: exports i18n and display resolver modules.
- Linked indexes:
  - files: `packages/shared/src/index.ts`
- Notes: This is a contract aggregator, not a runtime feature.

### SH-0002 IPC Channel Contract

- Status: traced
- Risk: medium
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/constants/index.ts`
  - `src/__tests__/constants.test.ts`
- Type: IPC contract
- User/caller behavior: desktop main, preload, and renderer can share stable channel names for project, instance, network, file, Narre, terminal, and agent operations.
- System behavior: defines `IPC_CHANNELS` string constants and related app defaults.
- Entry points:
  - import `IPC_CHANNELS` from `@netior/shared/constants`
- Inputs: channel constant key
- Outputs: channel name string
- State changes: none
- Persistence: none
- Dependencies: Electron IPC consumers in `desktop-app`
- Failure cases: stale or mismatched channel strings can disconnect preload/main IPC paths.
- Error handling: none in this layer; downstream IPC handlers return `IpcResult`.
- Async/loading behavior: none
- i18n/display relevance: none
- Linked indexes:
  - ipc-channels: all shared `IPC_CHANNELS.*` constants
- Notes: Some desktop IPC handlers still use raw string literals; later desktop audit should compare raw handlers against this contract.

### SH-0003 Built-In Narre Skill Registry

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/constants/index.ts`
  - `src/__tests__/constants.test.ts`
- Type: Narre command contract
- User/caller behavior: Narre slash picker and runtime can identify built-in commands such as bootstrap, index, interactive-view, network-representation, and schema-field-behavior.
- System behavior: defines `BUILT_IN_SKILLS`, derives `SLASH_TRIGGER_SKILLS`, and resolves a skill by slash trigger via `findSkillBySlashTrigger`.
- Entry points:
  - `BUILT_IN_SKILLS`
  - `SLASH_TRIGGER_SKILLS`
  - `findSkillBySlashTrigger(triggerName)`
- Inputs: slash trigger name
- Outputs: `SkillDefinition` or `null`
- State changes: none
- Persistence: none
- Dependencies: Narre renderer UI and server skill routing
- Failure cases: missing or renamed built-in skill breaks slash command discovery or command-specific argument requirements.
- Error handling: unknown triggers return `null`.
- Async/loading behavior: none
- i18n/display relevance: descriptions and hints are translation keys.
- Linked indexes:
  - narre-events: built-in skill surface
- Notes: Runtime implementation lives in `narre-server`; this layer only defines the shared command contract.

### SH-0004 Agent Skill Storage Layout Contract

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/constants/index.ts`
  - `src/__tests__/constants.test.ts`
- Type: filesystem contract
- User/caller behavior: user-authored agent skills have a consistent project-local layout.
- System behavior: defines `.netior/agents/agent.json` and `.netior/agents/.../skills/SKILL.md` style storage constants through `AGENT_SKILL_STORAGE`.
- Entry points:
  - `AGENT_SKILL_STORAGE`
- Inputs: none
- Outputs: directory and file names
- State changes: none in shared; downstream code reads/writes filesystem paths.
- Persistence: project directory when used by desktop/Narre agent skill stores.
- Dependencies: desktop agent store and Narre user skill loader
- Failure cases: changing constants can orphan existing user-authored skill files.
- Error handling: none in this layer.
- Async/loading behavior: none
- i18n/display relevance: none
- Linked indexes:
  - filesystem-effects: user agent skill path contract
- Notes: High impact if changed, but this file only declares constants.

### SH-0005 Semantic Meaning And Built-In Model Definitions

- Status: traced
- Risk: medium
- Test status: indirectly-tested
- Package: `packages/shared`
- Locations:
  - `src/constants/index.ts`
  - `src/__tests__/constants.test.ts`
  - `src/__tests__/display.test.ts`
- Type: ontology contract
- User/caller behavior: schema editors, model editors, layouts, Narre tools, and MCP metadata can refer to stable semantic categories, meanings, slots, field bindings, and built-in models.
- System behavior: defines semantic category labels, system ontology source constants, model category instance definitions, meaning slots, semantic meanings, model definitions, field meaning binding lookup tables, and resolver helper functions.
- Entry points:
  - `MODEL_CATEGORY_INSTANCE_DEFINITIONS`
  - `MEANING_SLOT_DEFINITIONS`
  - `SEMANTIC_MEANING_DEFINITIONS`
  - `MODEL_DEFINITIONS`
  - `getMeaningSlotDefinition`
  - `getFieldMeaningBindingDefinition`
  - `getSemanticMeaningDefinition`
  - `getModelDefinition`
  - `meaningSlotToFieldMeaning`
  - `fieldMeaningToMeaningBindings`
- Inputs: stable semantic keys
- Outputs: semantic definitions, i18n keys, and binding lookups
- State changes: none
- Persistence: definitions seed or interpret system ontology data in core/service consumers.
- Dependencies: shared type unions, locale keys, core migrations/seed behavior, desktop editors
- Failure cases: key drift can break built-in ontology display, grouping, schema field behavior, or MCP/Narre tool semantics.
- Error handling: lookup helpers return `undefined`, `null`, or empty arrays depending on helper.
- Async/loading behavior: none
- i18n/display relevance: helper functions generate `semantic.*` translation keys.
- Linked indexes:
  - db-tables: system ontology seed definitions
  - renderer-components: schema/model semantic editors
- Notes: Built-in source identity must stay stable; translated labels must not become behavior keys.

### SH-0006 MCP Tool Metadata Registry

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/constants/netior-mcp-tools.ts`
  - `src/constants/index.ts`
  - `src/__tests__/constants.test.ts`
- Type: MCP/Narre tool contract
- User/caller behavior: Narre and MCP consumers can discover tool category, kind, mutation status, approval mode, scope, profiles, and localized display metadata.
- System behavior: defines `NETIOR_MCP_TOOL_SPECS`, normalizes tool names, builds full tool specs, lists specs, and converts specs into Narre tool metadata.
- Entry points:
  - `NETIOR_MCP_TOOL_SPECS`
  - `normalizeNetiorToolName`
  - `isNetiorMcpToolName`
  - `getNetiorMcpToolSpec`
  - `listNetiorMcpToolSpecs`
  - `getNarreToolMetadata`
- Inputs: MCP tool key/name
- Outputs: `NetiorMcpToolSpec` and `NarreToolMetadata`
- State changes: none
- Persistence: none
- Dependencies: MCP server tool registration, Narre tool presentation, shared locale keys
- Failure cases: missing spec or metadata drift can make tools unavailable, misclassified, or incorrectly approval-gated.
- Error handling: unknown tool lookups return `null` or fallback metadata depending on helper.
- Async/loading behavior: none
- i18n/display relevance: MCP tool presentation must use `narre.tools.<tool_key>.name` and `.description`.
- Linked indexes:
  - mcp-tools: 87 shared tool specs
  - narre-events: tool display metadata
- Notes: Locale completeness is also enforced by i18n tests and display resolver tests.

### SH-0007 i18n Locale Resource And Translation Helpers

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/i18n/index.ts`
  - `src/i18n/locales/en.json`
  - `src/i18n/locales/ko.json`
  - `src/__tests__/i18n.test.ts`
- Type: i18n contract
- User/caller behavior: UI and shared display resolvers can translate stable keys in Korean and English.
- System behavior: loads locale JSON resources, derives nested translation key types, resolves nested keys, reports missing keys, supports parameter interpolation, and offers strict/fallback translation modes.
- Entry points:
  - `translate(locale, key, params?)`
  - `translateStrict(locale, key, params?)`
  - `getTranslationKeys(locale)`
  - `getMissingTranslationKeys(referenceLocale, locale)`
- Inputs: locale, translation key, optional params
- Outputs: translated string, fallback key, missing-key list, or thrown strict error
- State changes: none
- Persistence: locale JSON resources
- Dependencies: desktop renderer, display resolver, Narre/MCP tool labels
- Failure cases: missing key returns raw key in non-strict mode or throws in strict mode; malformed locale resources break key extraction.
- Error handling: strict helper throws on missing translation.
- Async/loading behavior: none
- i18n/display relevance: primary feature.
- Linked indexes:
  - files: locale resources
- Notes: Korean locale files are encoding-sensitive; edit minimally.

### SH-0008 Ontology Display Resolver

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/display.ts`
  - `src/__tests__/display.test.ts`
- Type: i18n/display contract
- User/caller behavior: built-in models, model categories, schema.model_category, MCP tools, and agents display localized names/descriptions from stable source identity.
- System behavior: maps `OntologyDisplaySource` to translation keys and resolves text with fallback metadata for custom or unknown objects.
- Entry points:
  - `getOntologyDisplayLabelKey`
  - `getOntologyDisplayDescriptionKey`
  - `getOntologyDisplayName`
  - `getOntologyDisplayDescription`
  - `getOntologyDisplayText`
  - `createOntologyDisplayResolver`
  - `toModelDisplaySource`
- Inputs: display source object plus translation function
- Outputs: label key, description key, name/description text, display option
- State changes: none
- Persistence: none
- Dependencies: shared constants and i18n locale keys
- Failure cases: missing source identity falls back to name/title/key/source_ref; missing built-in locale keys can hide intended localization unless tested.
- Error handling: missing translation falls back through metadata.
- Async/loading behavior: none
- i18n/display relevance: primary feature.
- Linked indexes:
  - renderer-components: any built-in display consumer
  - mcp-tools: MCP tool display namespace
- Notes: This is the preferred display path for Netior-owned built-ins.

### SH-0009 Netior DSL Type Contract And Validator

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/dsl/index.ts`
  - `src/__tests__/dsl.test.ts`
- Type: DSL contract
- User/caller behavior: field behaviors, interactive views, MCP tools, and core evaluation can share a typed expression grammar.
- System behavior: defines DSL expression/value/context/result types and validates expression objects plus field behavior config wrappers.
- Entry points:
  - `validateNetiorDslExpression(input)`
  - `validateNetiorDslFieldBehaviorConfig(input)`
- Inputs: unknown expression/config
- Outputs: validation result with path-specific errors
- State changes: none
- Persistence: field behavior configs may be persisted by core/service consumers.
- Dependencies: shared field meaning and schema binding types; core evaluator
- Failure cases: invalid operator, missing selector, invalid aggregate/relative/discovery shape.
- Error handling: returns `{ ok: false, errors }`.
- Async/loading behavior: none
- i18n/display relevance: none
- Linked indexes:
  - service-endpoints: `/dsl/evaluate`
  - mcp-tools: `validate_dsl`, `evaluate_dsl`
- Notes: This validates shape only; core owns evaluation semantics.

### SH-0010 Interactive View Source Contract Validator

- Status: verified
- Risk: high
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/interactive-view/index.ts`
  - `src/__tests__/interactive-view.test.ts`
- Type: interactive runtime safety contract
- User/caller behavior: user-authored/generated interactive views are checked before running in host mode.
- System behavior: validates manifest JSON, allowed imports, SDK named imports, forbidden globals, field write permissions, DSL permission declaration, and unsupported DSL operators/projections.
- Entry points:
  - `validateInteractiveViewSource(source, manifestJson)`
- Inputs: source string and manifest JSON string
- Outputs: `InteractiveViewValidationResult` with runtime `host` or `sandbox` and issues
- State changes: none
- Persistence: none in shared; templates are persisted by core/service consumers.
- Dependencies: shared interactive view runtime/manifest types
- Failure cases: invalid JSON, unsupported SDK, forbidden import/global, undeclared write or DSL permission, unavailable DSL operation.
- Error handling: returns structured issues with severity.
- Async/loading behavior: none
- i18n/display relevance: issue messages are currently literal English.
- Linked indexes:
  - renderer-components: interactive view editor/runtime
  - service-endpoints: interactive view templates
- Notes: Risk is high because this gates whether user-authored code can run in host runtime.

### SH-0011 Semantic Editor Token Parser And Serializer

- Status: verified
- Risk: medium
- Test status: tested
- Package: `packages/shared`
- Locations:
  - `src/semantic-editor.ts`
  - `src/__tests__/semantic-editor.test.ts`
- Type: editor content contract
- User/caller behavior: markdown/editor content can mention or embed Netior objects, instance content, properties, interactive views, network views, and file previews.
- System behavior: parses `[[target:...]]` mentions and `::netior-embed{...}` directives, serializes semantic targets, creates mention/embed tokens, and generates fallback display text.
- Entry points:
  - `parseSemanticTarget`
  - `serializeSemanticTarget`
  - `createMentionToken`
  - `createEmbedToken`
  - `parseSemanticEditorTokens`
  - `getSemanticTargetDisplayFallback`
- Inputs: target strings, serialized target payloads, or editor content
- Outputs: semantic target objects, token strings, parsed tokens, fallback labels
- State changes: none
- Persistence: tokens are stored inside user-authored editor content by downstream editors.
- Dependencies: markdown/netior editor consumers
- Failure cases: malformed targets return `null` or are skipped during parsing; invalid projection strings are not deeply validated here.
- Error handling: invalid targets return `null` or are ignored.
- Async/loading behavior: none
- i18n/display relevance: fallback labels are stable technical text, not localized display names.
- Linked indexes:
  - renderer-components: markdown/netior editor semantic preview
- Notes: Parser supports relationship IDs on mentions and embeds.

### SH-0012 Shared Type Definitions

- Status: traced
- Risk: medium
- Test status: indirectly-tested
- Package: `packages/shared`
- Locations:
  - `src/types/index.ts`
- Type: type contract
- User/caller behavior: all packages share domain types for projects, instances, schemas, models, networks, edges, Narre, agents, interactive views, and service envelopes.
- System behavior: provides compile-time structural contracts and discriminated unions used across package boundaries.
- Entry points:
  - import types from `@netior/shared/types`
  - import types from `@netior/shared`
- Inputs: TypeScript import
- Outputs: shared type definitions
- State changes: none
- Persistence: types describe DB/service/file/session payload shapes but do not persist data themselves.
- Dependencies: all packages
- Failure cases: incompatible type changes can break compile-time or silently desync runtime payload assumptions if not paired with migrations/service changes.
- Error handling: compile/typecheck boundary only.
- Async/loading behavior: none
- i18n/display relevance: contains source/display-related type fields used by resolver consumers.
- Linked indexes:
  - files: shared type contract
- Notes: Detailed type-by-type audit should be driven by downstream feature tracing rather than duplicated here.
