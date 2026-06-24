import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb } from './test-db';

vi.mock('../connection', async (importOriginal) => {
  const original = await importOriginal<typeof import('../connection')>();
  return {
    ...original,
    getDatabase: () => getTestDb(),
  };
});

import { createWorld } from '../repositories/world';
import { createSchema } from '../repositories/schema';
import { createInstance, deleteInstance } from '../repositories/instance';
import {
  createInteractiveViewTemplate,
  getInteractiveViewPreference,
  getInteractiveViewSchemaPreference,
  listInteractiveViewTemplates,
  upsertInteractiveViewPreference,
  upsertInteractiveViewSchemaPreference,
  updateInteractiveViewTemplate,
} from '../repositories/interactive-view-template';

describe('interactive view template repository', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('lists templates that match schema and instance scope', () => {
    const world = createWorld({ name: 'World', root_dir: '/tmp/interactive-view-template' });
    const schema = createSchema({ root_network_id: world.id, name: 'Schema' });
    const instance = createInstance({ root_network_id: world.id, schema_id: schema.id, title: 'Instance' });

    const schemaTemplate = createInteractiveViewTemplate({
      root_network_id: world.id,
      target_kind: 'schema',
      target_id: schema.id,
      name: 'Schema View',
      source_code: 'export function View() { return null }',
      manifest_json: '{"kind":"interactive-view","sdkVersion":1}',
    });
    const instanceTemplate = createInteractiveViewTemplate({
      root_network_id: world.id,
      target_kind: 'instance',
      target_id: instance.id,
      name: 'Instance View',
      source_code: 'export function View() { return null }',
      manifest_json: '{"kind":"interactive-view","sdkVersion":1}',
    });

    const templates = listInteractiveViewTemplates({
      rootNetworkId: world.id,
      schemaId: schema.id,
      instanceId: instance.id,
    });

    expect(templates.map((template) => template.id)).toEqual([
      instanceTemplate.id,
      schemaTemplate.id,
    ]);
  });

  it('rejects world-scoped templates', () => {
    const world = createWorld({ name: 'World', root_dir: '/tmp/interactive-view-world-rejected' });

    expect(() => createInteractiveViewTemplate({
      root_network_id: world.id,
      target_kind: 'world' as 'schema',
      target_id: null,
      name: 'World View',
      source_code: 'export function View() { return null }',
      manifest_json: '{"kind":"interactive-view","sdkVersion":1}',
    })).toThrow(/Unsupported interactive view template target kind/);
  });

  it('stores validation metadata and per-instance template preference', () => {
    const world = createWorld({ name: 'World', root_dir: '/tmp/interactive-view-preference' });
    const instance = createInstance({ root_network_id: world.id, title: 'Instance' });
    const schema = createSchema({ root_network_id: world.id, name: 'Schema' });
    const template = createInteractiveViewTemplate({
      root_network_id: world.id,
      target_kind: 'schema',
      target_id: schema.id,
      name: 'Generated View',
      source_code: 'export function View() { return null }',
      manifest_json: '{"kind":"interactive-view","sdkVersion":1}',
      source_kind: 'narre',
    });

    const updated = updateInteractiveViewTemplate(template.id, {
      validation_status: 'passed',
      validation_errors_json: '[]',
      trust_level: 'validated',
    });

    expect(updated?.validation_status).toBe('passed');
    expect(updated?.trust_level).toBe('validated');

    const preference = upsertInteractiveViewPreference({
      instance_id: instance.id,
      preference_mode: 'template',
      selected_view_template_id: template.id,
    });

    expect(preference.root_network_id).toBe(world.id);
    expect(preference.preference_mode).toBe('template');
    expect(getInteractiveViewPreference(instance.id)?.selected_view_template_id).toBe(template.id);
  });

  it('stores schema defaults separately from instance overrides', () => {
    const world = createWorld({ name: 'World', root_dir: '/tmp/interactive-view-schema-preference' });
    const schema = createSchema({ root_network_id: world.id, name: 'Question' });
    const instance = createInstance({ root_network_id: world.id, schema_id: schema.id, title: 'Instance' });
    const schemaTemplate = createInteractiveViewTemplate({
      root_network_id: world.id,
      target_kind: 'schema',
      target_id: schema.id,
      name: 'Schema View',
      source_code: 'export function View() { return null }',
      manifest_json: '{"kind":"interactive-view","sdkVersion":1}',
    });
    const instanceTemplate = createInteractiveViewTemplate({
      root_network_id: world.id,
      target_kind: 'instance',
      target_id: instance.id,
      name: 'Instance View',
      source_code: 'export function View() { return null }',
      manifest_json: '{"kind":"interactive-view","sdkVersion":1}',
    });

    const schemaPreference = upsertInteractiveViewSchemaPreference({
      schema_id: schema.id,
      selected_view_template_id: schemaTemplate.id,
    });
    const instancePreference = upsertInteractiveViewPreference({
      instance_id: instance.id,
      preference_mode: 'template',
      selected_view_template_id: instanceTemplate.id,
    });

    expect(schemaPreference.selected_view_template_id).toBe(schemaTemplate.id);
    expect(getInteractiveViewSchemaPreference(schema.id)?.selected_view_template_id).toBe(schemaTemplate.id);
    expect(instancePreference.preference_mode).toBe('template');
    expect(instancePreference.selected_view_template_id).toBe(instanceTemplate.id);
  });

  it('cascades preferences when an instance is deleted', () => {
    const world = createWorld({ name: 'World', root_dir: '/tmp/interactive-view-preference-cascade' });
    const instance = createInstance({ root_network_id: world.id, title: 'Instance' });

    upsertInteractiveViewPreference({
      instance_id: instance.id,
      preference_mode: 'inherit',
      selected_view_template_id: null,
    });

    deleteInstance(instance.id);

    expect(getInteractiveViewPreference(instance.id)).toBeUndefined();
  });
});
