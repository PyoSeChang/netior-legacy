import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type {
  InteractiveViewPreference,
  InteractiveViewPreferenceUpsert,
  InteractiveViewSchemaPreference,
  InteractiveViewSchemaPreferenceUpsert,
  InteractiveViewTemplate,
  InteractiveViewTemplateCreate,
  InteractiveViewTemplateListQuery,
  InteractiveViewTemplateUpdate,
} from '@netior/shared/types';

function normalizeTargetId(targetKind: InteractiveViewTemplateCreate['target_kind'], targetId?: string | null): string | null {
  return targetId ?? null;
}

function assertTemplateTarget(projectId: string, targetKind: string, targetId: string | null): void {
  const db = getDatabase();

  if (targetKind !== 'schema' && targetKind !== 'instance') {
    throw new Error(`Unsupported interactive view template target kind: ${targetKind}`);
  }

  if (!targetId) {
    throw new Error(`Interactive view template target_id is required for target kind: ${targetKind}`);
  }

  if (targetKind === 'schema') {
    const schema = db.prepare('SELECT id FROM schemas WHERE id = ? AND project_id = ?').get(targetId, projectId);
    if (!schema) throw new Error(`Schema not found for interactive view template: ${targetId}`);
    return;
  }

  if (targetKind === 'instance') {
    const instance = db.prepare('SELECT id FROM instances WHERE id = ? AND project_id = ?').get(targetId, projectId);
    if (!instance) throw new Error(`Instance not found for interactive view template: ${targetId}`);
  }
}

export function listInteractiveViewTemplates(query: InteractiveViewTemplateListQuery): InteractiveViewTemplate[] {
  const db = getDatabase();
  const targetClauses: string[] = [];
  const params: unknown[] = [query.projectId];

  if (query.schemaId) {
    targetClauses.push('(target_kind = ? AND target_id = ?)');
    params.push('schema', query.schemaId);
  }

  if (query.instanceId) {
    targetClauses.push('(target_kind = ? AND target_id = ?)');
    params.push('instance', query.instanceId);
  }

  if (targetClauses.length === 0) {
    return [];
  }

  return db.prepare(
    `SELECT *
     FROM interactive_view_templates
     WHERE project_id = ?
       AND enabled = 1
       AND target_kind IN ('schema', 'instance')
       AND (${targetClauses.join(' OR ')})
     ORDER BY
       CASE target_kind WHEN 'instance' THEN 0 WHEN 'schema' THEN 1 ELSE 2 END,
       updated_at DESC`,
  ).all(...params) as InteractiveViewTemplate[];
}

export function getInteractiveViewTemplate(id: string): InteractiveViewTemplate | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM interactive_view_templates WHERE id = ?')
    .get(id) as InteractiveViewTemplate | undefined;
}

export function createInteractiveViewTemplate(data: InteractiveViewTemplateCreate): InteractiveViewTemplate {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const targetId = normalizeTargetId(data.target_kind, data.target_id);
  assertTemplateTarget(data.project_id, data.target_kind, targetId);

  db.prepare(
    `INSERT INTO interactive_view_templates (
       id, project_id, target_kind, target_id, name, description, source_code,
       manifest_json, source_kind, trust_level, default_runtime, enabled,
       validation_status, validation_errors_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.target_kind,
    targetId,
    data.name,
    data.description ?? null,
    data.source_code,
    data.manifest_json,
    data.source_kind ?? 'manual',
    data.trust_level ?? 'untrusted',
    data.default_runtime ?? 'sandbox',
    data.enabled ?? 1,
    data.validation_status ?? 'unknown',
    data.validation_errors_json ?? '[]',
    now,
    now,
  );

  return getInteractiveViewTemplate(id) as InteractiveViewTemplate;
}

export function updateInteractiveViewTemplate(
  id: string,
  data: InteractiveViewTemplateUpdate,
): InteractiveViewTemplate | undefined {
  const db = getDatabase();
  const current = getInteractiveViewTemplate(id);
  if (!current) return undefined;

  const nextTargetKind = data.target_kind ?? current.target_kind;
  const nextTargetId = Object.prototype.hasOwnProperty.call(data, 'target_id')
    ? normalizeTargetId(nextTargetKind, data.target_id)
    : normalizeTargetId(nextTargetKind, current.target_id);
  assertTemplateTarget(current.project_id, nextTargetKind, nextTargetId);

  db.prepare(
    `UPDATE interactive_view_templates
     SET target_kind = ?,
         target_id = ?,
         name = ?,
         description = ?,
         source_code = ?,
         manifest_json = ?,
         source_kind = ?,
         trust_level = ?,
         default_runtime = ?,
         enabled = ?,
         validation_status = ?,
         validation_errors_json = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(
    nextTargetKind,
    nextTargetId,
    data.name ?? current.name,
    Object.prototype.hasOwnProperty.call(data, 'description') ? data.description ?? null : current.description,
    data.source_code ?? current.source_code,
    data.manifest_json ?? current.manifest_json,
    data.source_kind ?? current.source_kind,
    data.trust_level ?? current.trust_level,
    data.default_runtime ?? current.default_runtime,
    data.enabled ?? current.enabled,
    data.validation_status ?? current.validation_status,
    data.validation_errors_json ?? current.validation_errors_json,
    new Date().toISOString(),
    id,
  );

  return getInteractiveViewTemplate(id);
}

export function deleteInteractiveViewTemplate(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM interactive_view_templates WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getInteractiveViewPreference(instanceId: string): InteractiveViewPreference | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM interactive_view_preferences WHERE instance_id = ?')
    .get(instanceId) as InteractiveViewPreference | undefined;
}

export function upsertInteractiveViewPreference(data: InteractiveViewPreferenceUpsert): InteractiveViewPreference {
  const db = getDatabase();
  const instance = db.prepare('SELECT id, project_id FROM instances WHERE id = ?').get(data.instance_id) as
    | { id: string; project_id: string }
    | undefined;
  if (!instance) {
    throw new Error(`Instance not found for interactive view preference upsert: ${data.instance_id}`);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const preferenceMode = data.preference_mode ?? (data.selected_view_template_id ? 'template' : 'inherit');

  if (preferenceMode === 'template' && !data.selected_view_template_id) {
    throw new Error('Interactive view template override requires selected_view_template_id');
  }
  if (data.selected_view_template_id) {
    const template = getInteractiveViewTemplate(data.selected_view_template_id);
    if (!template || template.project_id !== instance.project_id) {
      throw new Error(`Interactive view template not found for instance preference: ${data.selected_view_template_id}`);
    }
  }

  db.prepare(
    `INSERT INTO interactive_view_preferences (
       id, project_id, instance_id, preference_mode, selected_view_template_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(instance_id) DO UPDATE SET
       preference_mode = excluded.preference_mode,
       selected_view_template_id = excluded.selected_view_template_id,
       updated_at = excluded.updated_at`,
  ).run(
    id,
    instance.project_id,
    data.instance_id,
    preferenceMode,
    data.selected_view_template_id,
    now,
    now,
  );

  return getInteractiveViewPreference(data.instance_id) as InteractiveViewPreference;
}

export function getInteractiveViewSchemaPreference(schemaId: string): InteractiveViewSchemaPreference | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM interactive_view_schema_preferences WHERE schema_id = ?')
    .get(schemaId) as InteractiveViewSchemaPreference | undefined;
}

export function upsertInteractiveViewSchemaPreference(
  data: InteractiveViewSchemaPreferenceUpsert,
): InteractiveViewSchemaPreference {
  const db = getDatabase();
  const schema = db.prepare('SELECT id, project_id FROM schemas WHERE id = ?').get(data.schema_id) as
    | { id: string; project_id: string }
    | undefined;
  if (!schema) {
    throw new Error(`Schema not found for interactive view schema preference upsert: ${data.schema_id}`);
  }

  if (data.selected_view_template_id) {
    const template = getInteractiveViewTemplate(data.selected_view_template_id);
    if (!template || template.project_id !== schema.project_id) {
      throw new Error(`Interactive view template not found for schema preference: ${data.selected_view_template_id}`);
    }
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO interactive_view_schema_preferences (
       id, project_id, schema_id, selected_view_template_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(schema_id) DO UPDATE SET
       selected_view_template_id = excluded.selected_view_template_id,
       updated_at = excluded.updated_at`,
  ).run(
    id,
    schema.project_id,
    data.schema_id,
    data.selected_view_template_id,
    now,
    now,
  );

  return getInteractiveViewSchemaPreference(data.schema_id) as InteractiveViewSchemaPreference;
}
