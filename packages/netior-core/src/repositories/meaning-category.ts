import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import {
  MEANING_CATEGORY_INSTANCE_DEFINITIONS,
  MEANING_CATEGORY_SCHEMA_SOURCE_REF,
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

export function getMeaningCategorySchemaId(projectId: string): string {
  return `schema-${projectId}-meaning_category`;
}

export function getMeaningCategoryInstanceId(projectId: string, categoryKey: string): string {
  return `instance-${projectId}-meaning-category-${categoryKey}`;
}

export function ensureMeaningCategoryTaxonomyForProjectDb(
  db: Database.Database,
  projectId: string,
): { schemaId: string; instancesByKey: Map<string, Instance> } {
  const now = new Date().toISOString();
  const schemaId = getMeaningCategorySchemaId(projectId);

  db.prepare(`
    INSERT OR IGNORE INTO schemas (
      id, project_id, name, description, icon, color, file_template, meanings,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, 'Meaning Category', 'Built-in enum schema for semantic meaning categories.', 'folder-tree', '#6b7280', NULL, '[]',
      'system', ?, ?, ?, ?, ?)
  `).run(schemaId, projectId, SYSTEM_ONTOLOGY_SOURCE_ID, MEANING_CATEGORY_SCHEMA_SOURCE_REF, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, now);
  db.prepare(`
    UPDATE schemas
       SET source_kind = 'system',
           source_id = ?,
           source_ref = ?,
           source_version = ?,
           updated_at = ?
     WHERE id = ?
  `).run(SYSTEM_ONTOLOGY_SOURCE_ID, MEANING_CATEGORY_SCHEMA_SOURCE_REF, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, schemaId);
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
  for (const category of MEANING_CATEGORY_INSTANCE_DEFINITIONS) {
    const instanceId = getMeaningCategoryInstanceId(projectId, category.key);
    insertInstance.run(instanceId, projectId, schemaId, category.title, SYSTEM_ONTOLOGY_SOURCE_ID, category.sourceRef, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, now);
    updateInstance.run(schemaId, SYSTEM_ONTOLOGY_SOURCE_ID, category.sourceRef, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, instanceId);
    ensureObject(db, 'instance', 'project', projectId, instanceId, now);
    const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as Instance;
    instancesByKey.set(category.key, instance);
  }

  return { schemaId, instancesByKey };
}

export function listMeaningCategoriesForProjectDb(db: Database.Database, projectId: string): Instance[] {
  const { schemaId } = ensureMeaningCategoryTaxonomyForProjectDb(db, projectId);
  return db.prepare(`
    SELECT *
      FROM instances
     WHERE project_id = ?
       AND schema_id = ?
     ORDER BY
       CASE source_ref
         WHEN 'meaning-category.time' THEN 0
         WHEN 'meaning-category.workflow' THEN 1
         WHEN 'meaning-category.structure' THEN 2
         WHEN 'meaning-category.knowledge' THEN 3
         WHEN 'meaning-category.space' THEN 4
         WHEN 'meaning-category.quant' THEN 5
         WHEN 'meaning-category.governance' THEN 6
         ELSE 100
       END,
       title
  `).all(projectId, schemaId) as Instance[];
}

export function listMeaningCategories(projectId: string): Instance[] {
  return listMeaningCategoriesForProjectDb(getDatabase(), projectId);
}
