import type Database from 'better-sqlite3';
import { getDatabase } from '../connection';
import { ensureObjectScopeBindingForDb, getDefaultOwnerNetworkIdForWorldDb } from './network-scope';
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
  rootNetworkId: string | null,
  refId: string,
  createdAt: string,
): string {
  const objectId = `object-${objectType}-${refId}`;
  db.prepare(`
    INSERT OR IGNORE INTO objects (id, object_type, scope, root_network_id, ref_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(objectId, objectType, scope, rootNetworkId, refId, createdAt);
  return objectId;
}

export function getMeaningCategorySchemaId(rootNetworkId: string): string {
  return `schema-${rootNetworkId}-meaning_category`;
}

export function getMeaningCategoryInstanceId(rootNetworkId: string, categoryKey: string): string {
  return `instance-${rootNetworkId}-meaning-category-${categoryKey}`;
}

export function ensureMeaningCategoryTaxonomyForWorldDb(
  db: Database.Database,
  rootNetworkId: string,
): { schemaId: string; instancesByKey: Map<string, Instance> } {
  const now = new Date().toISOString();
  const schemaId = getMeaningCategorySchemaId(rootNetworkId);
  const ownerNetworkId = getDefaultOwnerNetworkIdForWorldDb(db, rootNetworkId);

  db.prepare(`
    INSERT OR IGNORE INTO schemas (
      id, root_network_id, owner_network_id, name, description, icon, color, file_template, meanings,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, ?, 'Meaning Category', 'Built-in enum schema for semantic meaning categories.', 'folder-tree', '#6b7280', NULL, '[]',
      'system', ?, ?, ?, ?, ?)
  `).run(schemaId, rootNetworkId, ownerNetworkId, SYSTEM_ONTOLOGY_SOURCE_ID, MEANING_CATEGORY_SCHEMA_SOURCE_REF, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, now);
  db.prepare(`
    UPDATE schemas
       SET owner_network_id = COALESCE(owner_network_id, ?),
           source_kind = 'system',
           source_id = ?,
           source_ref = ?,
           source_version = ?,
           updated_at = ?
     WHERE id = ?
  `).run(ownerNetworkId, SYSTEM_ONTOLOGY_SOURCE_ID, MEANING_CATEGORY_SCHEMA_SOURCE_REF, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, schemaId);
  const schemaObjectId = ensureObject(db, 'schema', 'world', rootNetworkId, schemaId, now);
  ensureObjectScopeBindingForDb(db, {
    objectId: schemaObjectId,
    scopeNetworkId: ownerNetworkId,
    sourceKind: 'system',
    sourceId: SYSTEM_ONTOLOGY_SOURCE_ID,
    sourceRef: MEANING_CATEGORY_SCHEMA_SOURCE_REF,
    sourceVersion: SYSTEM_ONTOLOGY_SOURCE_VERSION,
  });

  const insertInstance = db.prepare(`
    INSERT OR IGNORE INTO instances (
      id, root_network_id, owner_network_id, schema_id, recurrence_source_instance_id, recurrence_occurrence_key,
      title, color, icon, content, agent_content,
      source_kind, source_id, source_ref, source_version, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, 'system', ?, ?, ?, ?, ?)
  `);
  const updateInstance = db.prepare(`
    UPDATE instances
       SET owner_network_id = COALESCE(owner_network_id, ?),
           schema_id = ?,
           source_kind = 'system',
           source_id = ?,
           source_ref = ?,
           source_version = ?,
           updated_at = ?
     WHERE id = ?
  `);

  const instancesByKey = new Map<string, Instance>();
  for (const category of MEANING_CATEGORY_INSTANCE_DEFINITIONS) {
    const instanceId = getMeaningCategoryInstanceId(rootNetworkId, category.key);
    insertInstance.run(instanceId, rootNetworkId, ownerNetworkId, schemaId, category.title, SYSTEM_ONTOLOGY_SOURCE_ID, category.sourceRef, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, now);
    updateInstance.run(ownerNetworkId, schemaId, SYSTEM_ONTOLOGY_SOURCE_ID, category.sourceRef, SYSTEM_ONTOLOGY_SOURCE_VERSION, now, instanceId);
    const instanceObjectId = ensureObject(db, 'instance', 'world', rootNetworkId, instanceId, now);
    ensureObjectScopeBindingForDb(db, {
      objectId: instanceObjectId,
      scopeNetworkId: ownerNetworkId,
      sourceKind: 'system',
      sourceId: SYSTEM_ONTOLOGY_SOURCE_ID,
      sourceRef: category.sourceRef,
      sourceVersion: SYSTEM_ONTOLOGY_SOURCE_VERSION,
    });
    const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as Instance;
    instancesByKey.set(category.key, instance);
  }

  return { schemaId, instancesByKey };
}

export function listMeaningCategoriesForWorldDb(db: Database.Database, rootNetworkId: string): Instance[] {
  const { schemaId } = ensureMeaningCategoryTaxonomyForWorldDb(db, rootNetworkId);
  return db.prepare(`
    SELECT *
      FROM instances
     WHERE root_network_id = ?
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
  `).all(rootNetworkId, schemaId) as Instance[];
}

export function listMeaningCategories(rootNetworkId: string): Instance[] {
  return listMeaningCategoriesForWorldDb(getDatabase(), rootNetworkId);
}
