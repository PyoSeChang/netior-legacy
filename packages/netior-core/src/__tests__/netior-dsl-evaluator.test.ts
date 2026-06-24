import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
import { createInstance } from '../repositories/instance';
import { upsertProperty } from '../repositories/instance-property';
import { addNetworkNode, createNetwork } from '../repositories/network';
import { getObjectByRef } from '../repositories/objects';
import { evaluateNetiorDsl } from '../services/netior-dsl-evaluator';

function insertField(id: string, schemaId: string, name: string, fieldType = 'text'): void {
  getTestDb().prepare(`
    INSERT INTO schema_fields (
      id, schema_id, name, field_type, options, sort_order, required, default_value,
      meaning_slot, meaning_key, slot_binding_locked, generated_by_meaning, created_at
    ) VALUES (?, ?, ?, ?, NULL, 0, 0, NULL, NULL, NULL, 0, 0, datetime('now'))
  `).run(id, schemaId, name, fieldType);
}

function bindMeaning(fieldId: string, meaning: string): void {
  getTestDb().prepare(`
    INSERT INTO field_meaning_bindings (id, field_id, meaning_key, source, sort_order, created_at)
    VALUES (?, ?, ?, 'manual', 0, datetime('now'))
  `).run(`binding-${fieldId}-${meaning}`, fieldId, meaning);
}

describe('Netior DSL evaluator', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('reads exact field values with draft overrides', () => {
    const world = createWorld({ name: 'DSL', root_dir: '/tmp/dsl' });
    const schema = createSchema({ root_network_id: world.id, name: 'Problem' });
    insertField('field-order', schema.id, 'Order', 'number');
    const instance = createInstance({ root_network_id: world.id, schema_id: schema.id, title: 'Q1' });
    upsertProperty({ instance_id: instance.id, field_id: 'field-order', value: '1' });

    const result = evaluateNetiorDsl({
      op: 'field.value',
      of: { op: 'context.object' },
      fieldId: 'field-order',
    }, {
      rootNetworkId: world.id,
      currentInstanceId: instance.id,
      currentSchemaId: schema.id,
      overrides: { properties: { 'field-order': '2' } },
    });

    expect(result).toEqual({ ok: true, value: 2 });
  });

  it('finds next instance inside a schema scope', () => {
    const world = createWorld({ name: 'DSL', root_dir: '/tmp/dsl' });
    const schema = createSchema({ root_network_id: world.id, name: 'Problem' });
    insertField('field-order', schema.id, 'Order', 'number');
    const first = createInstance({ root_network_id: world.id, schema_id: schema.id, title: 'Q1' });
    const second = createInstance({ root_network_id: world.id, schema_id: schema.id, title: 'Q2' });
    upsertProperty({ instance_id: first.id, field_id: 'field-order', value: '1' });
    upsertProperty({ instance_id: second.id, field_id: 'field-order', value: '2' });

    const result = evaluateNetiorDsl({
      op: 'relative',
      direction: 'next',
      scope: { op: 'instances', schemaId: schema.id },
      current: { op: 'literal', value: { objectType: 'instance', refId: first.id } },
      orderBy: { fieldId: 'field-order' },
    }, {
      rootNetworkId: world.id,
      currentSchemaId: schema.id,
    });

    expect(result).toEqual({
      ok: true,
      value: { objectType: 'instance', refId: second.id, objectId: expect.any(String) },
    });
  });

  it('follows instance reference fields before reading nested field values', () => {
    const world = createWorld({ name: 'DSL', root_dir: '/tmp/dsl' });
    const characterSchema = createSchema({ root_network_id: world.id, name: 'Character' });
    insertField('field-job', characterSchema.id, 'Job', 'select');
    const statSchema = createSchema({ root_network_id: world.id, name: 'Stat' });
    insertField('field-character', statSchema.id, 'Character', 'relation');
    const character = createInstance({ root_network_id: world.id, schema_id: characterSchema.id, title: 'Merlin' });
    const stat = createInstance({ root_network_id: world.id, schema_id: statSchema.id, title: 'Merlin Stats' });
    upsertProperty({ instance_id: character.id, field_id: 'field-job', value: 'Wizard' });
    upsertProperty({ instance_id: stat.id, field_id: 'field-character', value: `instance:${character.id}` });

    const result = evaluateNetiorDsl({
      op: 'equals',
      left: {
        op: 'field.value',
        of: {
          op: 'field.object',
          of: { op: 'context.object' },
          fieldId: 'field-character',
        },
        fieldId: 'field-job',
      },
      right: { op: 'literal', value: 'Wizard' },
    }, {
      rootNetworkId: world.id,
      currentInstanceId: stat.id,
      currentSchemaId: statSchema.id,
    });

    expect(result).toEqual({ ok: true, value: true });
  });

  it('discovers schemas by field meaning', () => {
    const world = createWorld({ name: 'DSL', root_dir: '/tmp/dsl' });
    const schema = createSchema({ root_network_id: world.id, name: 'Event' });
    insertField('field-start', schema.id, 'Start', 'datetime');
    bindMeaning('field-start', 'time.start');

    const result = evaluateNetiorDsl({
      op: 'discover.schemas',
      requires: [{ fieldMeaning: 'time.start' }],
    }, {
      rootNetworkId: world.id,
    });

    expect(result).toEqual({
      ok: true,
      value: [{ objectType: 'schema', refId: schema.id, objectId: expect.any(String) }],
    });
  });

  it('resolves objects placed in the current network scope', () => {
    const world = createWorld({ name: 'DSL', root_dir: '/tmp/dsl' });
    const schema = createSchema({ root_network_id: world.id, name: 'Problem' });
    const first = createInstance({ root_network_id: world.id, schema_id: schema.id, title: 'Q1' });
    const second = createInstance({ root_network_id: world.id, schema_id: schema.id, title: 'Q2' });
    const network = createNetwork({ root_network_id: world.id, name: 'Problem Set' });
    const firstObject = getObjectByRef('instance', first.id)!;
    const secondObject = getObjectByRef('instance', second.id)!;
    addNetworkNode({ network_id: network.id, object_id: firstObject.id });
    addNetworkNode({ network_id: network.id, object_id: secondObject.id });

    const result = evaluateNetiorDsl({
      op: 'objects.inNetwork',
    }, {
      rootNetworkId: world.id,
      currentNetworkId: network.id,
    });

    expect(result).toEqual({
      ok: true,
      value: [
        { objectType: 'instance', refId: first.id, objectId: firstObject.id },
        { objectType: 'instance', refId: second.id, objectId: secondObject.id },
      ],
    });
  });
});
