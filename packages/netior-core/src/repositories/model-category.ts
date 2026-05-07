import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import {
  MODEL_CATEGORY_INSTANCE_DEFINITIONS,
  MODEL_CATEGORY_SCHEMA_SOURCE_REF,
  SYSTEM_ONTOLOGY_SOURCE_ID,
  SYSTEM_ONTOLOGY_SOURCE_VERSION,
} from '@netior/shared/constants';
import type { Instance } from '@netior/shared/types';

function ensureObject(
  db: Database.Database,
  objectType: string,
  scope: string,
  projectId: string | null,
  refId: string,
  createdAt: string,
): void {
  db.prepare(`
    INSERT OR IGNORE INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`object-${objectType}-${refId}`, objectType, scope, projectId, refId, createdAt);
}

export function getModelCategorySchemaId(projectId: string): string {
  return `schema-${projectId}-model_category`;
}

export function getModelCategoryInstanceId(projectId: string, categoryKey: string): string {
  return `instance-${projectId}-model-category-${categoryKey}`;
}

export function ensureModelCategoryTaxonomyForProjectDb(
  db: Database.Database,
  projectId: string,
): { schemaId: string; instancesByKey: Map<string, Instance> } {
  const now = new Date().toISOString();
  const schemaId = getModelCategorySchemaId(projectId);

  db.prepare(`
    INSERT OR IGNORE INTO schemas (
      id, project_id, name, description, icon, color, node_shape, file_template, models,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, 'Model Category', 'Built-in enum schema for semantic model categories.', 'folder-tree', '#6b7280', 'rounded', NULL, '[]',
      'system', ?, ?, ?, ?, ?)
  `).run(schemaId, projectId, SYSTEM_ONTOLOGY_SOURCE_ID, MODEL_CATEGORY_SCHEMA_SOURCE_REF, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, now);
  db.prepare(`
    UPDATE schemas
       SET source_kind = 'system',
           source_id = ?,
           source_ref = ?,
           source_version = ?,
           updated_at = ?
     WHERE id = ?
  `).run(SYSTEM_ONTOLOGY_SOURCE_ID, MODEL_CATEGORY_SCHEMA_SOURCE_REF, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, schemaId);
  ensureObject(db, 'schema', 'project', projectId, schemaId, now);

  const insertInstance = db.prepare(`
    INSERT OR IGNORE INTO instances (
      id, project_id, schema_id, recurrence_source_instance_id, recurrence_occurrence_key,
      title, color, icon, content, agent_content,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, 'system', ?, ?, ?, ?, ?)
  `);
  const updateInstance = db.prepare(`
    UPDATE instances
       SET schema_id = ?,
           source_kind = 'system',
           source_id = ?,
           source_ref = ?,
           source_version = ?,
           updated_at = ?
     WHERE id = ?
  `);

  const instancesByKey = new Map<string, Instance>();
  for (const category of MODEL_CATEGORY_INSTANCE_DEFINITIONS) {
    const instanceId = getModelCategoryInstanceId(projectId, category.key);
    insertInstance.run(instanceId, projectId, schemaId, category.title, SYSTEM_ONTOLOGY_SOURCE_ID, category.sourceRef, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, now);
    updateInstance.run(schemaId, SYSTEM_ONTOLOGY_SOURCE_ID, category.sourceRef, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, instanceId);
    ensureObject(db, 'instance', 'project', projectId, instanceId, now);
    const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as Instance;
    instancesByKey.set(category.key, instance);
  }

  return { schemaId, instancesByKey };
}

export function listModelCategoriesForProjectDb(db: Database.Database, projectId: string): Instance[] {
  const { schemaId } = ensureModelCategoryTaxonomyForProjectDb(db, projectId);
  return db.prepare(`
    SELECT *
      FROM instances
     WHERE project_id = ?
       AND schema_id = ?
     ORDER BY
       CASE source_ref
         WHEN 'model-category.time' THEN 0
         WHEN 'model-category.workflow' THEN 1
         WHEN 'model-category.structure' THEN 2
         WHEN 'model-category.knowledge' THEN 3
         WHEN 'model-category.space' THEN 4
         WHEN 'model-category.quant' THEN 5
         WHEN 'model-category.governance' THEN 6
         ELSE 100
       END,
       title
  `).all(projectId, schemaId) as Instance[];
}

export function listModelCategories(projectId: string): Instance[] {
  return listModelCategoriesForProjectDb(getDatabase(), projectId);
}
