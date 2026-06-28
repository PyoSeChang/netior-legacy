# DB Table And Migration Index

## Metrics

- Discovered table-like identifiers: 60 from first regex extraction pass
- Discovered migrations: 61
- Mapped DB items: core repository/service surfaces mapped to CORE-0001 through CORE-0017; 61 migrations classified by domain group
- Unmapped DB items: column-level extraction and canonical table normalization pending

## Records

Initial core persistence surfaces:

| Surface | Count | Mapping status |
|---|---:|---|
| Migration files | 61 | mapped by domain group |
| Repository files | 19 | mapped |

Repository files:

- `context`
- `editor-prefs`
- `file`
- `instance`
- `instance-property`
- `interactive-view-state`
- `interactive-view-template`
- `layout`
- `model`
- `model-category`
- `module`
- `network`
- `network-representation`
- `objects`
- `project`
- `relationship`
- `schema`
- `settings`
- `system-networks`

## Core Mapping

| Surface | Feature ID | Status |
|---|---|---|
| DB connection and migration runner | CORE-0001 | mapped |
| Migration set | CORE-0002 | mapped, individual migrations pending |
| Project/system network bootstrap | CORE-0003 | mapped |
| Object records | CORE-0004 | mapped |
| Instances/properties | CORE-0005 | mapped |
| Schemas/fields/meanings | CORE-0006 | mapped |
| Models/categories | CORE-0007 | mapped |
| Networks/nodes/edges | CORE-0008 | mapped |
| Layouts/positions/visuals | CORE-0009 | mapped |
| Files/modules | CORE-0010 | mapped |
| Contexts | CORE-0011 | mapped |
| Interactive views | CORE-0012 | mapped |
| Editor prefs/settings | CORE-0013 | mapped |
| Network representation types | CORE-0014 | mapped |
| Relationships | CORE-0015 | mapped |
| Instance content sync | CORE-0016 | mapped |
| DSL evaluation | CORE-0017 | mapped |

## Migration Domain Mapping

| Migration files | Primary feature IDs | Domain group | Status |
|---|---|---|---|
| `001-initial.ts` | CORE-0003, CORE-0005, CORE-0008, CORE-0010 | project/concept/canvas/edge/file legacy foundation | classified |
| `002-modules-and-hierarchical-canvas.ts`, `019-module-path.ts` | CORE-0010, CORE-0008 | modules and hierarchical canvas/network support | classified |
| `003-archetypes.ts`, `003-schemas.ts`, `014-archetype-ref-field.ts`, `014-schema-ref-field.ts`, `020-archetype-semantics.ts`, `020-schema-meaning-foundation.ts`, `023-schema-field-meanings.ts`, `023-schema-semantic-annotations.ts`, `024-field-meaning-bindings-v1.ts`, `024-slot-semantic-aspects.ts`, `025-schema-meanings.ts`, `031-field-meaning-bindings.ts`, `038-schema-model-resplit.ts`, `039-field-meaning-bindings-schema-fk.ts`, `044-concept-properties-schema-field-fk.ts`, `047-schema-field-bindings.ts`, `052-remove-schema-node-shape.ts` | CORE-0006, CORE-0005 | schema/field/meaning/binding evolution | classified |
| `004-concept-content.ts`, `021-concept-recurrence-materialization.ts`, `043-remove-concept-model-id.ts`, `046-instance-rename.ts` | CORE-0005, CORE-0016 | concept-to-instance content and instance persistence | classified |
| `005-app-settings.ts` | CORE-0013 | app settings | classified |
| `006-canvas-1n-and-types.ts`, `007-edge-visual-overrides.ts`, `008-canvas-layout.ts`, `010-canvas-to-network.ts`, `011-network-structure-and-layouts.ts`, `012-objects-and-entity-nodes.ts`, `016-backfill-object-records.ts`, `017-edge-relation-meaning-and-group-node-type.ts`, `017-edge-system-contract-and-group-node-type.ts`, `018-unify-hierarchy-parent-contract.ts`, `018-unify-hierarchy-parent-meaning.ts`, `022-network-universe-ontology.ts`, `033-ontology-network-name-cleanup.ts`, `035-node-config-meaning-binding-canonicalization.ts`, `041-network-node-exclusions.ts` | CORE-0004, CORE-0008, CORE-0009 | network/object/layout/edge evolution | classified |
| `009-file-entity.ts` | CORE-0010, CORE-0004 | file entity metadata and object records | classified |
| `013-contexts.ts` | CORE-0011 | contexts and context members | classified |
| `015-type-groups.ts`, `040-model-type-groups.ts`, `042-remove-type-groups.ts` | CORE-0006, CORE-0007 | legacy type group lifecycle | classified |
| `026-structured-recurrence-meaning.ts`, `027-semantic-models-and-meanings.ts`, `027-semantic-models-and-roles.ts`, `028-semantic-model-objects.ts`, `029-semantic-model-descriptions.ts`, `030-semantic-model-recipes.ts`, `034-model-storage-canonicalization.ts`, `036-edge-models-and-relation-type-retirement.ts`, `045-source-provenance-and-model-category-concepts.ts` | CORE-0007, CORE-0006, CORE-0008 | semantic models, model categories, and edge model migration | classified |
| `032-domain-term-cleanup.ts` | CORE-0005, CORE-0006, CORE-0007, CORE-0008 | archetype/concept/relation terminology cleanup | classified |
| `048-interactive-view-state.ts`, `049-interactive-view-templates.ts`, `050-interactive-view-inheritance.ts`, `051-interactive-view-user-authored-templates.ts` | CORE-0012 | interactive view persistence | classified |
| `053-network-representation-grammar.ts` | CORE-0014, CORE-0008 | network/node/edge representation grammar | classified |
| `054-relationships.ts` | CORE-0015, CORE-0008 | canonical relationships and edge occurrence linkage | classified |

## Extracted Table Families

The first extraction pass found 60 table-like identifiers from migration SQL. This includes legacy tables and temporary rebuild tables (`*_new`, `*_next`) as well as two parser false positives from dynamic SQL (`foreign`, `new`) that should be excluded in a cleaner structured parser pass.

| Table family | Primary feature IDs | Status |
|---|---|---|
| `projects` | CORE-0003 | extracted |
| `concepts`, `concepts_new`, `instances` via later rename | CORE-0005, CORE-0016 | extracted legacy/current family |
| `concept_properties`, `concept_properties_new`, `instance_properties` via later rename | CORE-0005, CORE-0006 | extracted legacy/current family |
| `archetypes`, `archetype_fields`, `schemas`, `schema_fields`, `schemas_new`, `schema_fields_new` | CORE-0006 | extracted legacy/current family |
| `archetype_meanings`, `archetype_meaning_slot_bindings`, `schema_meanings`, `schema_meaning_slot_bindings`, `field_meaning_bindings`, `field_meaning_bindings_new`, `schema_field_bindings`, `slot_semantic_aspects`, `slot_semantic_roles` | CORE-0006 | extracted |
| `semantic_models`, `models`, `models_new`, `type_groups`, `canvas_types`, `canvas_type_allowed_relations`, `relation_types` | CORE-0007, CORE-0008 | extracted legacy/current family |
| `canvases`, `canvas_nodes`, `canvas_nodes_new`, `networks`, `networks_new`, `network_nodes`, `network_nodes_new`, `network_node_exclusions` | CORE-0008 | extracted legacy/current family |
| `edges`, `edges_new`, `relationships` | CORE-0008, CORE-0015 | extracted |
| `layouts`, `layout_nodes`, `layout_edges` | CORE-0009 | extracted |
| `files`, `concept_files`, `modules`, `module_directories` | CORE-0010 | extracted |
| `objects` | CORE-0004 | extracted |
| `contexts`, `context_members` | CORE-0011 | extracted |
| `app_settings`, `concept_editor_prefs` | CORE-0013 | extracted legacy/current family |
| `interactive_view_states`, `interactive_view_templates`, `interactive_view_templates_next`, `interactive_view_preferences`, `interactive_view_schema_preferences` | CORE-0012 | extracted |
| `network_types`, `node_types`, `edge_types` | CORE-0014 | extracted |

## Table Extraction Follow-Up

Next DB pass should replace the regex extractor with a structured SQL-aware pass or manual verification so temporary rebuild tables, renamed legacy tables, and false positives are normalized into canonical persisted tables. Column-level extraction and repository/service/IPC/MCP user mapping remain pending.
