# Netior Domain Model

This document is the current canonical summary of Netior's domain model. Older docs may still mention the previous Project/Canvas/Concept/RelationType model; treat this page and `AGENTS.md` as the source of truth when they disagree.

## Core Idea

Netior is a network-based desktop app for organizing ontology-backed instances.

- **World** is the user-facing name for a root network. It is the openable top-level work boundary and owns a user root directory.
- **Root Network** is the canonical top-level network object for a world. It is also a real work surface.
- **Network** is a spatial/relational work surface under a world. It places objects as nodes and connects them with edges.
- **Schema** is the ontology layer. It defines fields and structure for instances.
- **Instance** is the concrete object layer. It is the real entity users organize and edit.
- **Meaning** is the semantic layer. It defines how an object, relationship, field, or edge should be interpreted.

Do not reintroduce `Project` or `Concept` as runtime domain object names. The old Project role is now the world/root network boundary. The old Concept role is now Instance.

## Storage Layers

| Layer | Location | Contents |
|---|---|---|
| Metadata | `%APPDATA%/netior/data/netior.db` | root networks/worlds, instances, schemas, meanings, relationships, networks, network_nodes, edges, files, objects, sources, instance_properties, editor prefs |
| Instance data | User world directory | `.md`, `.pdf`, `.png`, and other user-owned files |

World directories are for real files. Metadata belongs in SQLite.

## Primary Objects

- **World**: product term for a root network. A world owns the root directory users open and is identified by the root network id.
- **Root Network**: network row with `kind = 'root'`. It is the world's canonical object, ontology work surface, and ownership boundary.
- **Instance**: concrete object in a world. It has `title`, optional visual fields, optional `schema_id`, content fields, source provenance, and `root_network_id`.
- **Schema**: field-bearing ontology object in a world. It describes the shape of instances.
- **Meaning**: semantic meaning object in a world. It classifies how objects, relationships, fields, edges, Narre, MCP tools, and layouts should read data.
- **Network**: object graph surface. It owns `network_nodes`, `edges`, layout state, viewport state, and hierarchy/group behavior.
- **NetworkNode**: placement of an object in a network. It references an `objects` row rather than embedding instance/meaning/world/file identity directly.
- **Relationship**: world-level relationship between two objects. Its `meaning_id` points to the meaning that defines the relationship.
- **Edge**: network-local occurrence that visually connects two network nodes. When it represents a domain relationship, `relationship_id` points to `relationships`; edge type and visual fields describe representation, not meaning.
- **ObjectRecord**: normalized object reference with `object_type`, `ref_id`, scope, and `root_network_id`. Networks use this as the common reference layer for worlds, networks, instances, files, schemas, meanings, contexts, agents, and future object kinds.
- **FileEntity**: metadata for a world file or directory. File contents stay on disk.

## Relationship And Edge

Relationship and Edge are separate domain layers.

- A `Relationship` says that a relation exists between two world objects.
- The relationship's `meaning_id` is the semantic meaning of that relation.
- An `Edge` says that a relationship, or a network-structural connection, appears inside one network surface.
- The edge's `edge_type_id`, ports, route, and visual overrides are representation data.
- A relationship may have zero, one, or many edge occurrences across networks.
- A network may contain structural edges, such as containment, hierarchy parent, or portal edges, that are not user-authored domain relationships.

Do not use `Edge` as the canonical object-to-object relation. Use `Relationship` for meaning-backed semantics, and use `Edge` for network representation.

## Source Provenance

Built-in and package-provided ontology objects are not tracked by a `built_in` boolean alone. Source provenance is represented with:

- `source_kind`
- `source_id`
- `source_ref`
- `source_version`

Use these fields for display resolution, package ownership, future community ontology packages, and stable built-in identification. World-authored ontology data uses `source_kind = 'world'`.

Display code should localize built-ins from `source_ref`. Behavior must not depend on localized labels.

## Meaning Categories

Meaning categories are not duplicated as a meaning field and a separate UI-only type. They are represented as built-in schema/instance data:

- A built-in schema with `source_ref = 'schema.model_category'`.
- Built-in category instances with `source_ref` such as `model-category.time`, `model-category.workflow`, and `model-category.structure`.
- Meanings reference a category through `category_instance_id`.

When a built-in category is shown to users, localize it through the shared ontology display resolver. When a network groups meanings by category, use category instance ids or explicit contains edges, never the translated category label.

## Schema Field Bindings

Schema fields keep UI/storage primitive type separate from the ontology source they read from.

- `field_type` describes the stored/editor primitive: text, number, select, multi-select, radio, object, file, and so on.
- `schema_field_bindings` describes how the field gets interpreted or populated.
- Select-like fields use bindings such as `instance_select` and `instance_multi_select` with a `source_schema_id`.
- Object-like fields use `schema_composition` or `schema_extension` with a `source_schema_id`.
- Advanced field behavior is represented as bindings too: `conditional_field`, `computed_field`, and `derived_collection`.

Do not store the same schema relationship both on `schema_fields` and in a separate binding row. The binding table is the canonical relationship layer.

### Schema Field Authoring UI

Schema field authoring is a multi-step design action, not a compact single-row edit.

- Choose the field behavior first.
- Then choose the field type from the types allowed by that behavior.
- Then configure behavior-specific details such as option source schema, source schema, display condition, formula, or derived collection condition.

Current behavior-to-type rules:

| Behavior | Allowed field types | Notes |
|---|---|---|
| `none` | Normal value/reference field types, including select-like types | Select, multi-select, and radio are regular field types, not behavior choices. |
| `schema_composition` | `object` | Includes another schema's fields inside this field. |
| `schema_extension` | `object` | Extends from another schema source. |
| `conditional_field` | Normal field types | Stores a DSL behavior config. The instance editor evaluates boolean results as visible/hidden state. |
| `computed_field` | Value-result field types | Stores a DSL behavior config and displays the evaluated scalar result as read-only. |
| `derived_collection` | `multi-select` | Stores a DSL behavior config and displays the evaluated object list as read-only. |

Field behavior config is stored as JSON in `schema_field_bindings.config`. The canonical behavior language is Netior DSL JSON AST; plain text config should be treated as invalid or unconfigured.

## Root Network

The root network is the managed world work surface for ontology-backed objects.

- Category instances are rendered as group nodes.
- Meaning objects are rendered as meaning nodes.
- Schema and instance objects can appear on the root surface when they are part of world modeling work.
- Built-in contains edges connect category groups to their meaning nodes.
- Sync must discover ontology objects by stable references (`object_type + ref_id`, meaning/category ids), not by generated object id formats or localized labels.

## i18n Boundary

i18n is presentation-only.

- Use shared display helpers from `@netior/shared` for built-in ontology names.
- Do not use translated text for identity, sorting, grouping, sync predicates, layout predicates, or persistence.
- If a service response needs localized display downstream, include the stable source fields so the renderer or consumer can resolve display text.

## Current Naming

Use these terms in new code and docs:

| Old term | Current term |
|---|---|
| Project | World / Root Network |
| project_id | root_network_id |
| projectId | rootNetworkId |
| Concept | Instance |
| Canvas | Network |
| CanvasNode | NetworkNode |
| RelationType / Model | Meaning |
| CanvasType | Network kind/layout/config, depending on context |
| Type Group | Removed; use meaning categories as schema/instance ontology data |

Historical migrations may still mention old table or column names because they describe already-applied database history. New runtime code, APIs, tools, prompts, and docs should use the current names only.
