import type { FieldMeaningBindingKey, NetworkObjectType, SchemaFieldBindingKind } from '../types';

export type NetiorDslScalar = null | boolean | number | string;

export interface NetiorDslObjectRef {
  objectType: NetworkObjectType | 'edge';
  refId: string;
  objectId?: string;
}

export type NetiorDslValue = NetiorDslScalar | NetiorDslObjectRef | NetiorDslObjectRef[];

export interface NetiorDslContext {
  projectId: string;
  currentObject?: NetiorDslObjectRef;
  currentInstanceId?: string;
  currentSchemaId?: string;
  currentNetworkId?: string;
  viewState?: Record<string, unknown>;
  overrides?: {
    properties?: Record<string, unknown>;
  };
}

export type NetiorDslEvalErrorCode = 'not_found' | 'ambiguous' | 'invalid_query' | 'type_mismatch';

export type NetiorDslEvalResult =
  | { ok: true; value: NetiorDslValue }
  | {
      ok: false;
      error: {
        code: NetiorDslEvalErrorCode;
        message: string;
        path?: string;
        candidates?: unknown[];
      };
    };

export interface NetiorDslEvaluateRequest {
  context: NetiorDslContext;
  expression: NetiorDslExpression;
}

export type NetiorDslCompareOperator = 'equals' | 'gt' | 'gte' | 'lt' | 'lte';
export type NetiorDslAggregateFunction = 'count' | 'sum';
export type NetiorDslRelativeDirection = 'next' | 'previous';

export type NetiorDslExpression =
  | NetiorDslLiteralExpression
  | NetiorDslContextObjectExpression
  | NetiorDslContextSchemaExpression
  | NetiorDslItemExpression
  | NetiorDslObjectsInNetworkExpression
  | NetiorDslInstancesExpression
  | NetiorDslFieldValueExpression
  | NetiorDslFieldObjectExpression
  | NetiorDslRelatedExpression
  | NetiorDslFilterExpression
  | NetiorDslCompareExpression
  | NetiorDslLogicalExpression
  | NetiorDslNotExpression
  | NetiorDslSortExpression
  | NetiorDslAggregateExpression
  | NetiorDslRelativeExpression
  | NetiorDslDiscoverSchemasExpression;

export interface NetiorDslLiteralExpression {
  op: 'literal';
  value: NetiorDslScalar | NetiorDslObjectRef | NetiorDslObjectRef[];
}

export interface NetiorDslContextObjectExpression {
  op: 'context.object';
}

export interface NetiorDslContextSchemaExpression {
  op: 'context.schema';
}

export interface NetiorDslItemExpression {
  op: 'item';
}

export interface NetiorDslObjectsInNetworkExpression {
  op: 'objects.inNetwork';
  networkId?: string;
}

export interface NetiorDslInstancesExpression {
  op: 'instances';
  schemaId?: string;
  projectId?: string;
}

export interface NetiorDslFieldValueExpression {
  op: 'field.value';
  of: NetiorDslExpression;
  fieldId?: string;
  meaning?: FieldMeaningBindingKey;
}

export interface NetiorDslFieldObjectExpression {
  op: 'field.object';
  of: NetiorDslExpression;
  fieldId?: string;
  meaning?: FieldMeaningBindingKey;
}

export interface NetiorDslRelatedExpression {
  op: 'related';
  from: NetiorDslExpression;
  meaning?: string;
  networkId?: string;
}

export interface NetiorDslFilterExpression {
  op: 'filter';
  scope: NetiorDslExpression;
  where: NetiorDslExpression;
}

export interface NetiorDslCompareExpression {
  op: NetiorDslCompareOperator;
  left: NetiorDslExpression;
  right: NetiorDslExpression;
}

export interface NetiorDslLogicalExpression {
  op: 'and' | 'or';
  expressions: NetiorDslExpression[];
}

export interface NetiorDslNotExpression {
  op: 'not';
  expression: NetiorDslExpression;
}

export interface NetiorDslSortExpression {
  op: 'sort';
  scope: NetiorDslExpression;
  by: NetiorDslFieldSelector;
  direction?: 'asc' | 'desc';
}

export interface NetiorDslAggregateExpression {
  op: 'aggregate';
  fn: NetiorDslAggregateFunction;
  scope: NetiorDslExpression;
  value?: NetiorDslExpression;
}

export interface NetiorDslRelativeExpression {
  op: 'relative';
  direction: NetiorDslRelativeDirection;
  scope: NetiorDslExpression;
  current: NetiorDslExpression;
  orderBy: NetiorDslFieldSelector;
}

export interface NetiorDslDiscoverSchemasExpression {
  op: 'discover.schemas';
  projectId?: string;
  requires?: NetiorDslDiscoveryRequirement[];
  optional?: NetiorDslDiscoveryRequirement[];
}

export interface NetiorDslDiscoveryRequirement {
  fieldMeaning?: FieldMeaningBindingKey;
  meaning?: string;
}

export interface NetiorDslFieldSelector {
  fieldId?: string;
  meaning?: FieldMeaningBindingKey;
}

export type NetiorDslFieldBehaviorKind = Extract<
  SchemaFieldBindingKind,
  'conditional_field' | 'computed_field' | 'derived_collection'
>;

export interface NetiorDslFieldBehaviorConfig {
  version: 1;
  kind: NetiorDslFieldBehaviorKind;
  effect?: 'visible' | 'required';
  expression: NetiorDslExpression;
}

export type NetiorDslValidationResult =
  | { ok: true }
  | { ok: false; errors: Array<{ path: string; message: string }> };

const EXPRESSION_OPS = new Set([
  'literal',
  'context.object',
  'context.schema',
  'item',
  'objects.inNetwork',
  'instances',
  'field.value',
  'field.object',
  'related',
  'filter',
  'equals',
  'gt',
  'gte',
  'lt',
  'lte',
  'and',
  'or',
  'not',
  'sort',
  'aggregate',
  'relative',
  'discover.schemas',
]);

export function validateNetiorDslExpression(input: unknown): NetiorDslValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  validateExpression(input, '$', errors);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateNetiorDslFieldBehaviorConfig(input: unknown): NetiorDslValidationResult {
  const errors: Array<{ path: string; message: string }> = [];
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'Expected an object' }] };
  }
  if (input.version !== 1) errors.push({ path: '$.version', message: 'Expected version 1' });
  if (!['conditional_field', 'computed_field', 'derived_collection'].includes(String(input.kind))) {
    errors.push({ path: '$.kind', message: 'Expected a supported field behavior kind' });
  }
  if (input.effect != null && !['visible', 'required'].includes(String(input.effect))) {
    errors.push({ path: '$.effect', message: 'Expected visible or required' });
  }
  validateExpression(input.expression, '$.expression', errors);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function validateExpression(
  input: unknown,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (!isRecord(input)) {
    errors.push({ path, message: 'Expected an expression object' });
    return;
  }

  const op = typeof input.op === 'string' ? input.op : '';
  if (!EXPRESSION_OPS.has(op)) {
    errors.push({ path: `${path}.op`, message: 'Unknown DSL operator' });
    return;
  }

  switch (op) {
    case 'objects.inNetwork':
      if (input.networkId != null && typeof input.networkId !== 'string') {
        errors.push({ path: `${path}.networkId`, message: 'networkId must be a string' });
      }
      break;
    case 'field.value':
    case 'field.object':
      validateExpression(input.of, `${path}.of`, errors);
      if (typeof input.fieldId !== 'string' && typeof input.meaning !== 'string') {
        errors.push({ path, message: `${op} requires fieldId or meaning` });
      }
      break;
    case 'instances':
      if (input.schemaId != null && typeof input.schemaId !== 'string') {
        errors.push({ path: `${path}.schemaId`, message: 'schemaId must be a string' });
      }
      if (input.projectId != null && typeof input.projectId !== 'string') {
        errors.push({ path: `${path}.projectId`, message: 'projectId must be a string' });
      }
      break;
    case 'related':
      validateExpression(input.from, `${path}.from`, errors);
      if (input.meaning != null && typeof input.meaning !== 'string') {
        errors.push({ path: `${path}.meaning`, message: 'meaning must be a string' });
      }
      break;
    case 'filter':
      validateExpression(input.scope, `${path}.scope`, errors);
      validateExpression(input.where, `${path}.where`, errors);
      break;
    case 'equals':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      validateExpression(input.left, `${path}.left`, errors);
      validateExpression(input.right, `${path}.right`, errors);
      break;
    case 'and':
    case 'or':
      if (!Array.isArray(input.expressions) || input.expressions.length === 0) {
        errors.push({ path: `${path}.expressions`, message: 'Expected a non-empty expression array' });
      } else {
        input.expressions.forEach((item, index) => validateExpression(item, `${path}.expressions[${index}]`, errors));
      }
      break;
    case 'not':
      validateExpression(input.expression, `${path}.expression`, errors);
      break;
    case 'sort':
      validateExpression(input.scope, `${path}.scope`, errors);
      validateFieldSelector(input.by, `${path}.by`, errors);
      break;
    case 'aggregate':
      validateExpression(input.scope, `${path}.scope`, errors);
      if (!['count', 'sum'].includes(String(input.fn))) {
        errors.push({ path: `${path}.fn`, message: 'Expected count or sum' });
      }
      if (input.value != null) validateExpression(input.value, `${path}.value`, errors);
      break;
    case 'relative':
      validateExpression(input.scope, `${path}.scope`, errors);
      validateExpression(input.current, `${path}.current`, errors);
      validateFieldSelector(input.orderBy, `${path}.orderBy`, errors);
      if (!['next', 'previous'].includes(String(input.direction))) {
        errors.push({ path: `${path}.direction`, message: 'Expected next or previous' });
      }
      break;
    case 'discover.schemas':
      validateDiscoveryRequirements(input.requires, `${path}.requires`, errors);
      validateDiscoveryRequirements(input.optional, `${path}.optional`, errors);
      break;
  }
}

function validateFieldSelector(
  input: unknown,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (!isRecord(input)) {
    errors.push({ path, message: 'Expected a field selector object' });
    return;
  }
  if (typeof input.fieldId !== 'string' && typeof input.meaning !== 'string') {
    errors.push({ path, message: 'Field selector requires fieldId or meaning' });
  }
}

function validateDiscoveryRequirements(
  input: unknown,
  path: string,
  errors: Array<{ path: string; message: string }>,
): void {
  if (input == null) return;
  if (!Array.isArray(input)) {
    errors.push({ path, message: 'Expected an array' });
    return;
  }
  input.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push({ path: `${path}[${index}]`, message: 'Expected an object' });
    } else if (typeof item.fieldMeaning !== 'string' && typeof item.meaning !== 'string') {
      errors.push({ path: `${path}[${index}]`, message: 'Expected fieldMeaning or meaning' });
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
