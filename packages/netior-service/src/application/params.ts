import { JsonRpcProtocolError } from '../errors';

export function objectParams(params: unknown): Record<string, unknown> {
  if (params === undefined || params === null) return {};
  if (typeof params !== 'object' || Array.isArray(params)) {
    throw new JsonRpcProtocolError(-32602, 'JSON-RPC params must be an object');
  }
  return params as Record<string, unknown>;
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new JsonRpcProtocolError(-32602, `${name} is required`);
  }
  return value;
}

export function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new JsonRpcProtocolError(-32602, 'Expected string');
  return value;
}

export function optionalStringOrUndefined(value: unknown): string | undefined {
  const normalized = optionalString(value);
  return normalized === null ? undefined : normalized;
}

export function requireNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new JsonRpcProtocolError(-32602, `${name} must be a number`);
  }
  return value;
}

export function optionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new JsonRpcProtocolError(-32602, 'Expected number');
  }
  return value;
}

export function nullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return optionalNumber(value);
}

export function optionalBooleanNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  return value ? 1 : 0;
}

export function optionalJson(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function normalizeJsonFields(input: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const normalized = { ...input };
  for (const field of fields) {
    if (field in normalized) {
      normalized[`${field}_json`] = optionalJson(normalized[field]);
      delete normalized[field];
    }
  }
  return normalized;
}
