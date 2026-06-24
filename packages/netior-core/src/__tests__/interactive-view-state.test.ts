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
import { createInstance, deleteInstance } from '../repositories/instance';
import {
  getInteractiveViewState,
  upsertInteractiveViewState,
} from '../repositories/interactive-view-state';

describe('interactive view state repository', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('persists state per instance and view template', () => {
    const world = createWorld({ name: 'World', root_dir: '/tmp/interactive-view-state' });
    const instance = createInstance({ root_network_id: world.id, title: 'Instance' });

    const state = upsertInteractiveViewState({
      instance_id: instance.id,
      view_template_id: 'built-in.test-view',
      state_json: JSON.stringify({ selectedFieldId: 'field-1', note: 'hello' }),
    });

    expect(state.root_network_id).toBe(world.id);
    expect(state.instance_id).toBe(instance.id);
    expect(JSON.parse(state.state_json)).toMatchObject({ note: 'hello' });

    const updated = upsertInteractiveViewState({
      instance_id: instance.id,
      view_template_id: 'built-in.test-view',
      state_json: JSON.stringify({ selectedFieldId: 'field-2' }),
    });

    expect(updated.id).toBe(state.id);
    expect(JSON.parse(getInteractiveViewState(instance.id, 'built-in.test-view')!.state_json)).toMatchObject({
      selectedFieldId: 'field-2',
    });
  });

  it('cascades when the instance is deleted', () => {
    const world = createWorld({ name: 'World', root_dir: '/tmp/interactive-view-state-cascade' });
    const instance = createInstance({ root_network_id: world.id, title: 'Instance' });

    upsertInteractiveViewState({
      instance_id: instance.id,
      view_template_id: 'built-in.test-view',
      state_json: '{}',
    });

    deleteInstance(instance.id);

    expect(getInteractiveViewState(instance.id, 'built-in.test-view')).toBeUndefined();
  });
});
