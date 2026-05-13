import type {
  NetiorDslContext,
  NetiorDslEvalErrorCode,
  NetiorDslEvalResult,
  NetiorDslExpression,
  NetiorDslFieldBehaviorConfig,
  NetiorDslObjectRef,
  NetiorDslValue,
} from '@netior/shared';
import {
  validateNetiorDslExpression,
  validateNetiorDslFieldBehaviorConfig,
} from '@netior/shared';
import { getDatabase } from '../connection';

interface EvalFrame {
  item?: NetiorDslValue;
}

interface SchemaRow {
  id: string;
  project_id: string;
  name: string;
}

interface FieldRow {
  id: string;
  schema_id: string;
  name: string;
  field_type: string;
}

interface InstanceRow {
  id: string;
  project_id: string;
  schema_id: string | null;
  title: string;
}

interface ObjectRecordRow {
  id: string;
  object_type: string;
  ref_id: string;
}

interface ModelRow {
  id: string;
  key: string;
  source_ref: string | null;
  meaning_keys: string | null;
}

export function evaluateNetiorDsl(
  expression: NetiorDslExpression,
  context: NetiorDslContext,
): NetiorDslEvalResult {
  const validation = validateNetiorDslExpression(expression);
  if (!validation.ok) {
    return invalid(validation.errors.map((error) => `${error.path}: ${error.message}`).join('; '));
  }

  try {
    return ok(evaluateExpression(expression, context, {}));
  } catch (error) {
    if (error instanceof DslError) return error.toResult();
    return invalid((error as Error).message);
  }
}

export function evaluateNetiorDslFieldBehaviorConfig(
  config: NetiorDslFieldBehaviorConfig,
  context: NetiorDslContext,
): NetiorDslEvalResult {
  const validation = validateNetiorDslFieldBehaviorConfig(config);
  if (!validation.ok) {
    return invalid(validation.errors.map((error) => `${error.path}: ${error.message}`).join('; '));
  }
  return evaluateNetiorDsl(config.expression, context);
}

export function parseNetiorDslFieldBehaviorConfig(raw: string | null | undefined): NetiorDslFieldBehaviorConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const validation = validateNetiorDslFieldBehaviorConfig(parsed);
    return validation.ok ? parsed as NetiorDslFieldBehaviorConfig : null;
  } catch {
    return null;
  }
}

function evaluateExpression(
  expression: NetiorDslExpression,
  context: NetiorDslContext,
  frame: EvalFrame,
): NetiorDslValue {
  switch (expression.op) {
    case 'literal':
      return expression.value;
    case 'context.object':
      return getContextObject(context);
    case 'context.schema':
      return getContextSchema(context);
    case 'item':
      if (frame.item === undefined) throw new DslError('invalid_query', 'item is only available inside collection operators');
      return frame.item;
    case 'instances':
      return getInstances(expression.schemaId ?? context.currentSchemaId, expression.projectId ?? context.projectId);
    case 'field.value':
      return getFieldValue(
        requireObjectRef(evaluateExpression(expression.of, context, frame), 'field.value.of'),
        expression.fieldId,
        expression.meaning,
        context,
      );
    case 'related':
      return getRelatedObjects(
        requireObjectRef(evaluateExpression(expression.from, context, frame), 'related.from'),
        expression.model,
        expression.networkId ?? context.currentNetworkId,
        context.projectId,
      );
    case 'filter':
      return requireObjectRefList(evaluateExpression(expression.scope, context, frame), 'filter.scope')
        .filter((item) => toBoolean(evaluateExpression(expression.where, context, { ...frame, item })));
    case 'equals':
      return compareValues(
        evaluateExpression(expression.left, context, frame),
        evaluateExpression(expression.right, context, frame),
        'equals',
      );
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareValues(
        evaluateExpression(expression.left, context, frame),
        evaluateExpression(expression.right, context, frame),
        expression.op,
      );
    case 'and':
      return expression.expressions.every((item) => toBoolean(evaluateExpression(item, context, frame)));
    case 'or':
      return expression.expressions.some((item) => toBoolean(evaluateExpression(item, context, frame)));
    case 'not':
      return !toBoolean(evaluateExpression(expression.expression, context, frame));
    case 'sort':
      return sortObjects(
        requireObjectRefList(evaluateExpression(expression.scope, context, frame), 'sort.scope'),
        expression.by.fieldId,
        expression.by.meaning,
        expression.direction ?? 'asc',
        context,
      );
    case 'aggregate':
      return aggregateObjects(
        requireObjectRefList(evaluateExpression(expression.scope, context, frame), 'aggregate.scope'),
        expression.fn,
        expression.value,
        context,
        frame,
      );
    case 'relative':
      return getRelativeObject(
        requireObjectRefList(evaluateExpression(expression.scope, context, frame), 'relative.scope'),
        requireObjectRef(evaluateExpression(expression.current, context, frame), 'relative.current'),
        expression.orderBy.fieldId,
        expression.orderBy.meaning,
        expression.direction,
        context,
      );
    case 'discover.schemas':
      return discoverSchemas(
        expression.projectId ?? context.projectId,
        expression.requires ?? [],
        expression.optional ?? [],
      );
  }
}

function getContextObject(context: NetiorDslContext): NetiorDslObjectRef {
  if (context.currentObject) return context.currentObject;
  if (context.currentInstanceId) return toObjectRef('instance', context.currentInstanceId);
  throw new DslError('invalid_query', 'context.object is not available');
}

function getContextSchema(context: NetiorDslContext): NetiorDslObjectRef {
  if (!context.currentSchemaId) throw new DslError('invalid_query', 'context.schema is not available');
  return toObjectRef('schema', context.currentSchemaId);
}

function getInstances(schemaId: string | undefined, projectId: string): NetiorDslObjectRef[] {
  const db = getDatabase();
  const rows = schemaId
    ? db.prepare('SELECT id FROM instances WHERE schema_id = ? AND project_id = ? ORDER BY title, id').all(schemaId, projectId) as InstanceRow[]
    : db.prepare('SELECT id FROM instances WHERE project_id = ? ORDER BY title, id').all(projectId) as InstanceRow[];
  return rows.map((row) => toObjectRef('instance', row.id));
}

function getFieldValue(
  objectRef: NetiorDslObjectRef,
  fieldId: string | undefined,
  meaning: string | undefined,
  context: NetiorDslContext,
): NetiorDslValue {
  if (objectRef.objectType !== 'instance') {
    throw new DslError('type_mismatch', 'field.value can only read instance fields');
  }
  const resolvedField = resolveFieldForInstance(objectRef.refId, fieldId, meaning);
  if (!resolvedField) {
    throw new DslError('not_found', 'Field not found');
  }

  if (context.overrides?.properties && Object.prototype.hasOwnProperty.call(context.overrides.properties, resolvedField.id)) {
    return normalizePropertyValue(context.overrides.properties[resolvedField.id]);
  }

  const db = getDatabase();
  const row = db.prepare('SELECT value FROM instance_properties WHERE instance_id = ? AND field_id = ?')
    .get(objectRef.refId, resolvedField.id) as { value: string | null } | undefined;
  return normalizePropertyValue(row?.value ?? null);
}

function getRelatedObjects(
  from: NetiorDslObjectRef,
  model: string | undefined,
  networkId: string | undefined,
  projectId: string,
): NetiorDslObjectRef[] {
  const db = getDatabase();
  const sourceObject = getObjectByRef(from.objectType, from.refId);
  if (!sourceObject) throw new DslError('not_found', 'Source object is not in the object table');

  const modelIds = model ? resolveModelIds(projectId, model) : [];
  const modelFilter = modelIds.length > 0 ? `AND e.model_id IN (${modelIds.map(() => '?').join(',')})` : '';
  const networkFilter = networkId ? 'AND e.network_id = ?' : '';
  const params: unknown[] = [sourceObject.id, ...modelIds];
  if (networkId) params.push(networkId);

  const rows = db.prepare(`
    SELECT target_object.object_type, target_object.ref_id, target_object.id AS object_id
    FROM network_nodes source_node
    JOIN edges e ON e.source_node_id = source_node.id
    JOIN network_nodes target_node ON target_node.id = e.target_node_id
    JOIN objects target_object ON target_object.id = target_node.object_id
    WHERE source_node.object_id = ?
      ${modelFilter}
      ${networkFilter}
    ORDER BY target_object.object_type, target_object.ref_id
  `).all(...params) as Array<{ object_type: string; ref_id: string; object_id: string }>;

  return rows.map((row) => ({
    objectType: row.object_type as NetiorDslObjectRef['objectType'],
    refId: row.ref_id,
    objectId: row.object_id,
  }));
}

function sortObjects(
  objects: NetiorDslObjectRef[],
  fieldId: string | undefined,
  meaning: string | undefined,
  direction: 'asc' | 'desc',
  context: NetiorDslContext,
): NetiorDslObjectRef[] {
  const withValues = objects.map((item) => ({
    item,
    value: getFieldValue(item, fieldId, meaning, context),
  }));
  withValues.sort((a, b) => compareForSort(a.value, b.value));
  if (direction === 'desc') withValues.reverse();
  return withValues.map((item) => item.item);
}

function aggregateObjects(
  objects: NetiorDslObjectRef[],
  fn: 'count' | 'sum',
  valueExpression: NetiorDslExpression | undefined,
  context: NetiorDslContext,
  frame: EvalFrame,
): number {
  if (fn === 'count') return objects.length;
  if (!valueExpression) throw new DslError('invalid_query', 'sum aggregate requires a value expression');
  return objects.reduce((sum, item) => {
    const value = evaluateExpression(valueExpression, context, { ...frame, item });
    const numeric = Number(value);
    return Number.isFinite(numeric) ? sum + numeric : sum;
  }, 0);
}

function getRelativeObject(
  objects: NetiorDslObjectRef[],
  current: NetiorDslObjectRef,
  fieldId: string | undefined,
  meaning: string | undefined,
  direction: 'next' | 'previous',
  context: NetiorDslContext,
): NetiorDslObjectRef | null {
  const sorted = sortObjects(objects, fieldId, meaning, 'asc', context);
  const index = sorted.findIndex((item) => item.objectType === current.objectType && item.refId === current.refId);
  if (index === -1) throw new DslError('not_found', 'Current object is not in relative scope');
  return direction === 'next' ? sorted[index + 1] ?? null : sorted[index - 1] ?? null;
}

function discoverSchemas(
  projectId: string,
  requires: Array<{ fieldMeaning?: string; model?: string }>,
  optional: Array<{ fieldMeaning?: string; model?: string }>,
): NetiorDslObjectRef[] {
  const db = getDatabase();
  const schemas = db.prepare('SELECT id, project_id, name FROM schemas WHERE project_id = ? ORDER BY name, id')
    .all(projectId) as SchemaRow[];
  const requirements = [...requires, ...optional];
  const requiredMeanings = requires.map((item) => item.fieldMeaning).filter((item): item is string => !!item);
  const allMeanings = requirements.map((item) => item.fieldMeaning).filter((item): item is string => !!item);

  return schemas
    .filter((schema) => {
      const fields = getFieldsBySchema(schema.id);
      const meanings = new Set(
        fields.flatMap((field) => getFieldMeanings(field.id)),
      );
      return requiredMeanings.every((meaning) => meanings.has(meaning))
        || (requiredMeanings.length === 0 && allMeanings.some((meaning) => meanings.has(meaning)));
    })
    .map((schema) => toObjectRef('schema', schema.id));
}

function resolveFieldForInstance(
  instanceId: string,
  fieldId: string | undefined,
  meaning: string | undefined,
): FieldRow | null {
  const db = getDatabase();
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as InstanceRow | undefined;
  if (!instance?.schema_id) throw new DslError('not_found', 'Instance has no schema');

  if (fieldId) {
    const field = db.prepare('SELECT * FROM schema_fields WHERE id = ? AND schema_id = ?')
      .get(fieldId, instance.schema_id) as FieldRow | undefined;
    return field ?? null;
  }

  if (!meaning) throw new DslError('invalid_query', 'Field selector requires fieldId or meaning');
  const fields = db.prepare(`
    SELECT f.*
    FROM schema_fields f
    JOIN field_meaning_bindings b ON b.field_id = f.id
    WHERE f.schema_id = ? AND b.meaning_key = ?
    ORDER BY b.sort_order, f.sort_order, f.name
  `).all(instance.schema_id, meaning) as FieldRow[];

  if (fields.length > 1) {
    throw new DslError('ambiguous', `More than one field has meaning ${meaning}`, '$.field', fields);
  }
  return fields[0] ?? null;
}

function getFieldsBySchema(schemaId: string): FieldRow[] {
  return getDatabase().prepare('SELECT * FROM schema_fields WHERE schema_id = ? ORDER BY sort_order, name')
    .all(schemaId) as FieldRow[];
}

function getFieldMeanings(fieldId: string): string[] {
  const rows = getDatabase().prepare('SELECT meaning_key FROM field_meaning_bindings WHERE field_id = ?')
    .all(fieldId) as Array<{ meaning_key: string }>;
  return rows.map((row) => row.meaning_key);
}

function resolveModelIds(projectId: string, selector: string): string[] {
  const rows = getDatabase().prepare(`
    SELECT id, key, source_ref, meaning_keys
    FROM models
    WHERE project_id = ?
      AND (
        key = ?
        OR source_ref = ?
        OR source_ref = ?
        OR meaning_keys LIKE ?
      )
  `).all(projectId, selector, selector, `model.${selector}`, `%"${selector}"%`) as ModelRow[];
  if (rows.length === 0) throw new DslError('not_found', `Model not found: ${selector}`);
  return rows.map((row) => row.id);
}

function getObjectByRef(objectType: string, refId: string): ObjectRecordRow | null {
  const row = getDatabase().prepare('SELECT * FROM objects WHERE object_type = ? AND ref_id = ?')
    .get(objectType, refId) as ObjectRecordRow | undefined;
  return row ?? null;
}

function normalizePropertyValue(value: unknown): NetiorDslValue {
  if (value == null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value !== 'string') return String(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  if (value.trim() !== '' && Number.isFinite(numeric)) return numeric;
  return value;
}

function compareValues(left: NetiorDslValue, right: NetiorDslValue, op: 'equals' | 'gt' | 'gte' | 'lt' | 'lte'): boolean {
  if (op === 'equals') return JSON.stringify(left) === JSON.stringify(right);
  const leftComparable = toComparable(left);
  const rightComparable = toComparable(right);
  if (leftComparable == null || rightComparable == null) return false;
  if (op === 'gt') return leftComparable > rightComparable;
  if (op === 'gte') return leftComparable >= rightComparable;
  if (op === 'lt') return leftComparable < rightComparable;
  return leftComparable <= rightComparable;
}

function compareForSort(left: NetiorDslValue, right: NetiorDslValue): number {
  const leftComparable = toComparable(left);
  const rightComparable = toComparable(right);
  if (leftComparable == null && rightComparable == null) return 0;
  if (leftComparable == null) return 1;
  if (rightComparable == null) return -1;
  return leftComparable < rightComparable ? -1 : leftComparable > rightComparable ? 1 : 0;
}

function toComparable(value: NetiorDslValue): string | number | null {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

function toBoolean(value: NetiorDslValue): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0 && value !== 'false';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function requireObjectRef(value: NetiorDslValue, path: string): NetiorDslObjectRef {
  if (isObjectRef(value)) return value;
  throw new DslError('type_mismatch', `${path} must resolve to an object ref`);
}

function requireObjectRefList(value: NetiorDslValue, path: string): NetiorDslObjectRef[] {
  if (Array.isArray(value) && value.every(isObjectRef)) return value;
  throw new DslError('type_mismatch', `${path} must resolve to object refs`);
}

function isObjectRef(value: NetiorDslValue): value is NetiorDslObjectRef {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'objectType' in value && 'refId' in value);
}

function toObjectRef(objectType: NetiorDslObjectRef['objectType'], refId: string): NetiorDslObjectRef {
  const object = getObjectByRef(objectType, refId);
  return { objectType, refId, objectId: object?.id };
}

function ok(value: NetiorDslValue): NetiorDslEvalResult {
  return { ok: true, value };
}

function invalid(message: string): NetiorDslEvalResult {
  return { ok: false, error: { code: 'invalid_query', message } };
}

class DslError extends Error {
  constructor(
    readonly code: NetiorDslEvalErrorCode,
    message: string,
    readonly path?: string,
    readonly candidates?: unknown[],
  ) {
    super(message);
  }

  toResult(): NetiorDslEvalResult {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        path: this.path,
        candidates: this.candidates,
      },
    };
  }
}
