import type Database from 'better-sqlite3';

import { NETIOR_SCHEMA_EPOCH } from '../connection';

export function migrate001(db: Database.Database): void {
  db.exec(`
    CREATE TABLE netior_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO netior_metadata (key, value, updated_at)
    VALUES ('schema_epoch', '${NETIOR_SCHEMA_EPOCH}', datetime('now'));

    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE world_nodes (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES world_nodes(id) ON DELETE CASCADE,
      root_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      node_type TEXT NOT NULL CHECK (node_type IN ('world', 'model')),
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      root_uri TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      CHECK (
        (node_type = 'world' AND parent_id IS NULL AND root_id = id AND root_uri IS NOT NULL)
        OR
        (node_type = 'model' AND parent_id IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX idx_world_nodes_parent_key
      ON world_nodes(root_id, parent_id, key)
      WHERE parent_id IS NOT NULL;

    CREATE UNIQUE INDEX idx_world_nodes_root_key
      ON world_nodes(key)
      WHERE node_type = 'world';

    CREATE INDEX idx_world_nodes_parent ON world_nodes(parent_id);
    CREATE INDEX idx_world_nodes_root ON world_nodes(root_id);

    CREATE TABLE model_directory_bindings (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      root_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      relative_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(root_id, relative_path),
      UNIQUE(model_id, relative_path)
    );

    CREATE TABLE kinds (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon_type TEXT NOT NULL DEFAULT 'none' CHECK (icon_type IN ('lucide', 'image', 'none')),
      icon_key TEXT,
      icon_resource_id TEXT,
      source_kind TEXT NOT NULL DEFAULT 'user' CHECK (source_kind IN ('system', 'user', 'package', 'imported')),
      source_id TEXT,
      source_ref TEXT,
      source_version TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE(model_id, key)
    );

    CREATE TABLE properties (
      id TEXT PRIMARY KEY,
      kind_id TEXT NOT NULL REFERENCES kinds(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      value_type TEXT NOT NULL CHECK (value_type IN ('text', 'number', 'boolean', 'date', 'datetime', 'resource-ref', 'option')),
      cardinality TEXT NOT NULL DEFAULT 'single' CHECK (cardinality IN ('single', 'multiple')),
      required_policy TEXT NOT NULL DEFAULT 'optional' CHECK (required_policy IN ('optional', 'required', 'recommended')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE(kind_id, key)
    );

    CREATE TABLE relation_kinds (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon_type TEXT NOT NULL DEFAULT 'none' CHECK (icon_type IN ('lucide', 'image', 'none')),
      icon_key TEXT,
      icon_resource_id TEXT,
      directed INTEGER NOT NULL DEFAULT 1 CHECK (directed IN (0, 1)),
      subject_kind_policy TEXT,
      object_kind_policy TEXT,
      cardinality_policy TEXT,
      source_kind TEXT NOT NULL DEFAULT 'user' CHECK (source_kind IN ('system', 'user', 'package', 'imported')),
      source_id TEXT,
      source_ref TEXT,
      source_version TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE(model_id, key)
    );

    CREATE TABLE instances (
      id TEXT PRIMARY KEY,
      home_model_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      icon_type TEXT NOT NULL DEFAULT 'none' CHECK (icon_type IN ('lucide', 'image', 'none')),
      icon_key TEXT,
      icon_resource_id TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      UNIQUE(home_model_id, key)
    );

    CREATE TABLE resources (
      id TEXT PRIMARY KEY,
      root_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      source_kind TEXT NOT NULL CHECK (source_kind IN ('file', 'folder', 'url', 'service-object', 'sub-resource', 'inline')),
      source_uri TEXT,
      relative_path TEXT,
      parent_resource_id TEXT REFERENCES resources(id) ON DELETE CASCADE,
      locator TEXT,
      handler_key TEXT,
      fingerprint TEXT,
      observed_status TEXT NOT NULL DEFAULT 'observed' CHECK (observed_status IN ('observed', 'changed', 'missing', 'ignored', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      CHECK (
        source_uri IS NOT NULL
        OR relative_path IS NOT NULL
        OR parent_resource_id IS NOT NULL
        OR locator IS NOT NULL
      )
    );

    CREATE UNIQUE INDEX idx_resources_root_relative_path
      ON resources(root_id, relative_path)
      WHERE relative_path IS NOT NULL;

    CREATE UNIQUE INDEX idx_resources_sub_locator
      ON resources(parent_resource_id, locator)
      WHERE parent_resource_id IS NOT NULL AND locator IS NOT NULL;

    CREATE TABLE instance_resource_links (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
      created_at TEXT NOT NULL,
      UNIQUE(instance_id, resource_id)
    );

    CREATE UNIQUE INDEX idx_instance_resource_links_primary
      ON instance_resource_links(instance_id)
      WHERE is_primary = 1;

    CREATE TABLE kind_assignments (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      kind_id TEXT NOT NULL REFERENCES kinds(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'accepted', 'rejected', 'superseded', 'archived')),
      created_by TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      UNIQUE(instance_id, kind_id, status)
    );

    CREATE UNIQUE INDEX idx_kind_assignments_accepted
      ON kind_assignments(instance_id, kind_id)
      WHERE status = 'accepted';

    CREATE TABLE property_values (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      value_json TEXT,
      status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'accepted', 'rejected', 'superseded', 'archived')),
      created_by TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );

    CREATE UNIQUE INDEX idx_property_values_single_accepted
      ON property_values(instance_id, property_id)
      WHERE status = 'accepted';

    CREATE TABLE relation_assertions (
      id TEXT PRIMARY KEY,
      subject_instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      relation_kind_id TEXT NOT NULL REFERENCES relation_kinds(id) ON DELETE CASCADE,
      object_instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'accepted', 'rejected', 'superseded', 'archived')),
      created_by TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      CHECK (subject_instance_id <> object_instance_id)
    );

    CREATE UNIQUE INDEX idx_relation_assertions_accepted
      ON relation_assertions(subject_instance_id, relation_kind_id, object_instance_id)
      WHERE status = 'accepted';

    CREATE TABLE evidence_records (
      id TEXT PRIMARY KEY,
      evidence_type TEXT NOT NULL CHECK (evidence_type IN ('resource_locator', 'user_input', 'user_decision', 'ai_reasoning', 'calculation', 'external_sync')),
      resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
      locator TEXT,
      summary TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE evidence_links (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('kind_assignment', 'property_value', 'relation_assertion')),
      target_id TEXT NOT NULL,
      support_type TEXT NOT NULL DEFAULT 'supports' CHECK (support_type IN ('supports', 'contradicts', 'explains', 'source')),
      UNIQUE(evidence_id, target_type, target_id, support_type)
    );

    CREATE TABLE decisions (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL CHECK (target_type IN ('kind_assignment', 'property_value', 'relation_assertion')),
      target_id TEXT NOT NULL,
      decision_type TEXT NOT NULL CHECK (decision_type IN ('accept', 'reject', 'revise', 'supersede')),
      decided_status TEXT NOT NULL CHECK (decided_status IN ('candidate', 'accepted', 'rejected', 'superseded', 'archived')),
      reason TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE domain_events (
      id TEXT PRIMARY KEY,
      root_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      model_id TEXT REFERENCES world_nodes(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      payload_json TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      revision INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX idx_domain_events_root_revision
      ON domain_events(root_id, revision);

    CREATE TABLE views (
      id TEXT PRIMARY KEY,
      owner_model_id TEXT NOT NULL REFERENCES world_nodes(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('explorer', 'canvas')),
      name TEXT NOT NULL,
      description TEXT,
      config_json TEXT,
      source_kind TEXT NOT NULL DEFAULT 'user' CHECK (source_kind IN ('system', 'user', 'package', 'imported')),
      source_id TEXT,
      source_ref TEXT,
      source_version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE canvas_node_types (
      id TEXT PRIMARY KEY,
      owner_model_id TEXT REFERENCES world_nodes(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      allowed_subjects_json TEXT NOT NULL,
      renderer_key TEXT NOT NULL,
      fields_json TEXT NOT NULL DEFAULT '[]',
      actions_json TEXT NOT NULL DEFAULT '[]',
      interactions_json TEXT NOT NULL DEFAULT '[]',
      default_size_json TEXT NOT NULL,
      default_style_json TEXT,
      source_kind TEXT NOT NULL DEFAULT 'system' CHECK (source_kind IN ('system', 'user', 'package', 'imported')),
      source_id TEXT,
      source_ref TEXT,
      source_version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_model_id, key)
    );

    CREATE TABLE canvas_edge_types (
      id TEXT PRIMARY KEY,
      owner_model_id TEXT REFERENCES world_nodes(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      allowed_subjects_json TEXT NOT NULL,
      renderer_key TEXT NOT NULL,
      label_fields_json TEXT NOT NULL DEFAULT '[]',
      actions_json TEXT NOT NULL DEFAULT '[]',
      interactions_json TEXT NOT NULL DEFAULT '[]',
      default_style_json TEXT,
      source_kind TEXT NOT NULL DEFAULT 'system' CHECK (source_kind IN ('system', 'user', 'package', 'imported')),
      source_id TEXT,
      source_ref TEXT,
      source_version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_model_id, key)
    );

    CREATE TABLE view_items (
      id TEXT PRIMARY KEY,
      view_id TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
      item_kind TEXT NOT NULL CHECK (item_kind IN ('node', 'edge')),
      subject_type TEXT NOT NULL,
      subject_id TEXT,
      subject_model_id TEXT REFERENCES world_nodes(id) ON DELETE SET NULL,
      type_id TEXT,
      parent_item_id TEXT REFERENCES view_items(id) ON DELETE CASCADE,
      layout_json TEXT,
      state_json TEXT,
      overrides_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX idx_view_items_subject_node
      ON view_items(view_id, subject_type, subject_id)
      WHERE item_kind = 'node' AND subject_id IS NOT NULL;

    CREATE INDEX idx_bindings_model ON model_directory_bindings(model_id);
    CREATE INDEX idx_kinds_model ON kinds(model_id);
    CREATE INDEX idx_properties_kind ON properties(kind_id);
    CREATE INDEX idx_relation_kinds_model ON relation_kinds(model_id);
    CREATE INDEX idx_instances_home_model ON instances(home_model_id);
    CREATE INDEX idx_resources_root ON resources(root_id);
    CREATE INDEX idx_instance_resource_links_instance ON instance_resource_links(instance_id);
    CREATE INDEX idx_instance_resource_links_resource ON instance_resource_links(resource_id);
    CREATE INDEX idx_kind_assignments_instance ON kind_assignments(instance_id);
    CREATE INDEX idx_kind_assignments_kind ON kind_assignments(kind_id);
    CREATE INDEX idx_property_values_instance ON property_values(instance_id);
    CREATE INDEX idx_property_values_property ON property_values(property_id);
    CREATE INDEX idx_relation_assertions_subject ON relation_assertions(subject_instance_id);
    CREATE INDEX idx_relation_assertions_object ON relation_assertions(object_instance_id);
    CREATE INDEX idx_relation_assertions_kind ON relation_assertions(relation_kind_id);
    CREATE INDEX idx_evidence_links_target ON evidence_links(target_type, target_id);
    CREATE INDEX idx_decisions_target ON decisions(target_type, target_id);
    CREATE INDEX idx_domain_events_target ON domain_events(target_type, target_id);
    CREATE INDEX idx_views_owner ON views(owner_model_id);
    CREATE INDEX idx_view_items_view ON view_items(view_id);
  `);
}
