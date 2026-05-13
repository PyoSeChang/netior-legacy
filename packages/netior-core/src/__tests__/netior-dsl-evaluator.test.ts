import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb } from './test-db';

vi.mock('../connection', async (importOriginal) => {
  const original = await importOriginal<typeof import('../connection')>();
  return {
    ...original,
    getDatabase: () => getTestDb(),
  };
});

import { createProject } from '../repositories/project';
import { createSchema } from '../repositories/schema';
import { createInstance } from '../repositories/instance';
import { upsertProperty } from '../repositories/instance-property';
import { evaluateNetiorDsl } from '../services/netior-dsl-evaluator';

function insertField(id: string, schemaId: string, name: string, fieldType = 'text'): void {
  getTestDb().prepare(`
    INSERT INTO schema_fields (
      id, schema_id, name, field_type, options, sort_order, required, default_value,
      ref_schema_id, meaning_slot, meaning_key, slot_binding_locked, generated_by_model, created_at
    ) VALUES (?, ?, ?, ?, NULL, 0, 0, NULL, NULL, NULL, NULL, 0, 0, datetime('now'))
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
    const project = createProject({ name: 'DSL', root_dir: '/tmp/dsl' });
    const schema = createSchema({ project_id: project.id, name: 'Problem' });
    insertField('field-order', schema.id, 'Order', 'number');
    const instance = createInstance({ project_id: project.id, schema_id: schema.id, title: 'Q1' });
    upsertProperty({ instance_id: instance.id, field_id: 'field-order', value: '1' });

    const result = evaluateNetiorDsl({
      op: 'field.value',
      of: { op: 'context.object' },
      fieldId: 'field-order',
    }, {
      projectId: project.id,
      currentInstanceId: instance.id,
      currentSchemaId: schema.id,
      overrides: { properties: { 'field-order': '2' } },
    });

    expect(result).toEqual({ ok: true, value: 2 });
  });

  it('finds next instance inside a schema scope', () => {
    const project = createProject({ name: 'DSL', root_dir: '/tmp/dsl' });
    const schema = createSchema({ project_id: project.id, name: 'Problem' });
    insertField('field-order', schema.id, 'Order', 'number');
    const first = createInstance({ project_id: project.id, schema_id: schema.id, title: 'Q1' });
    const second = createInstance({ project_id: project.id, schema_id: schema.id, title: 'Q2' });
    upsertProperty({ instance_id: first.id, field_id: 'field-order', value: '1' });
    upsertProperty({ instance_id: second.id, field_id: 'field-order', value: '2' });

    const result = evaluateNetiorDsl({
      op: 'relative',
      direction: 'next',
      scope: { op: 'instances', schemaId: schema.id },
      current: { op: 'literal', value: { objectType: 'instance', refId: first.id } },
      orderBy: { fieldId: 'field-order' },
    }, {
      projectId: project.id,
      currentSchemaId: schema.id,
    });

    expect(result).toEqual({
      ok: true,
      value: { objectType: 'instance', refId: second.id, objectId: expect.any(String) },
    });
  });

  it('discovers schemas by field meaning', () => {
    const project = createProject({ name: 'DSL', root_dir: '/tmp/dsl' });
    const schema = createSchema({ project_id: project.id, name: 'Event' });
    insertField('field-start', schema.id, 'Start', 'datetime');
    bindMeaning('field-start', 'time.start');

    const result = evaluateNetiorDsl({
      op: 'discover.schemas',
      requires: [{ fieldMeaning: 'time.start' }],
    }, {
      projectId: project.id,
    });

    expect(result).toEqual({
      ok: true,
      value: [{ objectType: 'schema', refId: schema.id, objectId: expect.any(String) }],
    });
  });
});
