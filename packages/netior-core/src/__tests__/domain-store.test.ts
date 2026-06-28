import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  createInstance,
  createModel,
  createResource,
  createWorld,
  getDomainSnapshot,
  listInstances,
  listResources,
  listViews,
} from '../domain-store';
import { closeDatabase, initDatabase } from '../connection';

let tempDir: string;

describe('domain store baseline', () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'netior-core-'));
    initDatabase(join(tempDir, 'netior.db'));
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a world, model, instance, resource, and view in the new baseline', () => {
    const world = createWorld({ name: 'Test world', root_uri: 'C:/world' });
    const model = createModel({ world_id: world.id, name: 'Characters' });
    const instance = createInstance({ home_model_id: model.id, display_name: 'Chulsoo' });
    const resource = createResource({
      root_id: world.id,
      source_kind: 'file',
      relative_path: 'characters/chulsoo.md',
    });
    const views = listViews(model.id);

    expect(listInstances(model.id)).toEqual([instance]);
    expect(listResources(world.id)).toEqual([resource]);
    expect(views.map((view) => view.type).sort()).toEqual(['canvas', 'explorer']);

    const snapshot = getDomainSnapshot({ rootId: world.id });
    expect(snapshot.worldNodes.map((node) => node.id)).toContain(model.id);
    expect(snapshot.instances.map((item) => item.id)).toEqual([instance.id]);
    expect(snapshot.resources.map((item) => item.id)).toEqual([resource.id]);
    expect(snapshot.views.map((item) => item.type).sort()).toEqual(['canvas', 'explorer']);
    expect(snapshot.canvasNodeTypes.map((item) => item.key)).toEqual(expect.arrayContaining([
      'model_card',
      'kind_card',
      'relation_kind_card',
      'instance_card',
      'resource_tile',
      'note',
      'compact',
    ]));
    expect(snapshot.canvasEdgeTypes.map((item) => item.key)).toEqual(expect.arrayContaining([
      'relation_edge',
      'kind_assignment_edge',
      'resource_mapping_edge',
      'model_parent_edge',
      'dashed_edge',
    ]));
  });

  it('creates unique model keys under the same parent', () => {
    const world = createWorld({ name: 'Test world', root_uri: 'C:/world' });
    const first = createModel({ world_id: world.id, name: 'New model' });
    const second = createModel({ world_id: world.id, name: 'New model' });

    expect(first.key).toBe('new-model');
    expect(second.key).toBe('new-model-2');
  });

  it('resets a partial baseline that is missing world_nodes', () => {
    closeDatabase();

    const dbPath = join(tempDir, 'partial.db');
    const partial = new Database(dbPath);
    partial.exec(`
      CREATE TABLE _migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      INSERT INTO _migrations (version, applied_at)
      VALUES (1, datetime('now'));

      CREATE TABLE netior_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO netior_metadata (key, value, updated_at)
      VALUES ('schema_epoch', 'domain-model-v1', datetime('now'));
    `);
    partial.close();

    initDatabase(dbPath);

    const world = createWorld({ name: 'Recovered world', root_uri: 'C:/recovered' });
    expect(world.name).toBe('Recovered world');
  });
});
