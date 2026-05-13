import type { InteractiveViewManifest, InteractiveViewRuntime } from '../types';

export type InteractiveViewValidationSeverity = 'error' | 'warning';

export interface InteractiveViewValidationIssue {
  code: string;
  message: string;
  severity: InteractiveViewValidationSeverity;
}

export interface InteractiveViewValidationResult {
  ok: boolean;
  runtime: InteractiveViewRuntime;
  issues: InteractiveViewValidationIssue[];
}

const ALLOWED_IMPORTS = new Set([
  '@netior/interactive-sdk',
  'react',
]);

const INTERACTIVE_SDK_EXPORTS = new Set([
  'Badge',
  'Button',
  'Field',
  'FieldEditor',
  'Inline',
  'Panel',
  'Stack',
  'useContent',
  'useDslObject',
  'useDslObjects',
  'useDslValue',
  'useField',
  'useCurrentInstance',
  'useFieldValue',
  'useFields',
  'useOpenInstance',
  'useOpenObject',
  'useUpdateField',
  'useViewState',
]);

const FORBIDDEN_GLOBAL_PATTERNS: Array<[RegExp, string]> = [
  [/\bwindow\b/, 'window'],
  [/\bdocument\b/, 'document'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bsessionStorage\b/, 'sessionStorage'],
  [/\bindexedDB\b/, 'indexedDB'],
  [/\beval\s*\(/, 'eval'],
  [/\bFunction\s*\(/, 'Function constructor'],
  [/\bimport\s*\(/, 'dynamic import'],
  [/\bfetch\s*\(/, 'fetch'],
];

const FORBIDDEN_IMPORT_PREFIXES = [
  '@renderer/',
  '../../',
  '../',
  '@main/',
  '@shared/',
  '@netior/core',
  '@netior/service',
];

const NETIOR_DSL_OPS = new Set([
  'literal',
  'context.object',
  'context.schema',
  'item',
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

function parseJsonManifest(manifestJson: string): InteractiveViewManifest | null {
  try {
    const parsed = JSON.parse(manifestJson) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as InteractiveViewManifest;
  } catch {
    return null;
  }
}

function collectImports(source: string): string[] {
  const imports: string[] = [];
  const importPattern = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source))) {
    imports.push(match[1]);
  }
  return imports;
}

function collectNamedImports(source: string, moduleName: string): string[] {
  const names: string[] = [];
  const escapedModule = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importPattern = new RegExp(`import\\s+\\{([^}]*)\\}\\s+from\\s+['"]${escapedModule}['"]`, 'g');
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source))) {
    for (const rawName of match[1].split(',')) {
      const trimmed = rawName.trim();
      if (!trimmed) continue;
      names.push(trimmed.split(/\s+as\s+/i)[0].trim());
    }
  }
  return names;
}

function collectFieldWrites(source: string): string[] {
  const writes = new Set<string>();
  const updateFieldPattern = /\b(?:updateField|setField|saveField)\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = updateFieldPattern.exec(source))) {
    writes.add(match[1]);
  }
  return [...writes];
}

function usesDslHooks(source: string): boolean {
  return /\buseDsl(?:Value|Object|Objects)\s*\(/.test(source);
}

function collectDslOps(source: string): string[] {
  const ops = new Set<string>();
  const opPattern = /\bop\s*:\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = opPattern.exec(source))) {
    ops.add(match[1]);
  }
  return [...ops];
}

export function validateInteractiveViewSource(
  source: string,
  manifestJson: string,
): InteractiveViewValidationResult {
  const issues: InteractiveViewValidationIssue[] = [];
  const manifest = parseJsonManifest(manifestJson);

  if (!manifest) {
    issues.push({
      code: 'manifest.invalid_json',
      message: 'Manifest must be valid JSON.',
      severity: 'error',
    });
  } else {
    if (manifest.kind !== 'interactive-view') {
      issues.push({
        code: 'manifest.invalid_kind',
        message: 'Manifest kind must be "interactive-view".',
        severity: 'error',
      });
    }
    if (manifest.sdkVersion !== 1) {
      issues.push({
        code: 'manifest.unsupported_sdk',
        message: 'Only Interactive SDK version 1 is supported.',
        severity: 'error',
      });
    }
  }

  for (const importPath of collectImports(source)) {
    const forbiddenByPrefix = FORBIDDEN_IMPORT_PREFIXES.some((prefix) => importPath.startsWith(prefix));
    if (!ALLOWED_IMPORTS.has(importPath) || forbiddenByPrefix) {
      issues.push({
        code: 'source.import_not_allowed',
        message: `Import is not allowed: ${importPath}`,
        severity: 'error',
      });
    }
  }

  for (const importName of collectNamedImports(source, '@netior/interactive-sdk')) {
    if (!INTERACTIVE_SDK_EXPORTS.has(importName)) {
      issues.push({
        code: 'source.sdk_export_not_available',
        message: `Interactive SDK export is not available: ${importName}`,
        severity: 'error',
      });
    }
  }

  for (const [pattern, label] of FORBIDDEN_GLOBAL_PATTERNS) {
    if (pattern.test(source)) {
      issues.push({
        code: 'source.forbidden_global',
        message: `Forbidden API used: ${label}`,
        severity: 'error',
      });
    }
  }

  const allowedWrites = new Set(manifest?.permissions?.writeFields ?? []);
  const allowsAnyWrite = allowedWrites.has('*');
  for (const fieldKey of collectFieldWrites(source)) {
    if (!allowsAnyWrite && !allowedWrites.has(fieldKey)) {
      issues.push({
        code: 'permissions.write_field_not_declared',
        message: `Field write is not declared in manifest permissions: ${fieldKey}`,
        severity: 'error',
      });
    }
  }

  if (usesDslHooks(source) && manifest?.permissions?.dsl !== true) {
    issues.push({
      code: 'permissions.dsl_not_declared',
      message: 'DSL usage must be declared in manifest permissions.',
      severity: 'error',
    });
  }

  if (usesDslHooks(source)) {
    for (const op of collectDslOps(source)) {
      if (!NETIOR_DSL_OPS.has(op)) {
        issues.push({
          code: 'source.dsl_operator_not_available',
          message: `Netior DSL operator is not available: ${op}`,
          severity: 'error',
        });
      }
    }

    if (/\bselect\s*:/.test(source)) {
      issues.push({
        code: 'source.dsl_projection_not_available',
        message: 'Netior DSL does not support select/projection clauses in Interactive View source.',
        severity: 'error',
      });
    }

    if (/\borderBy\s*:\s*\[/.test(source)) {
      issues.push({
        code: 'source.dsl_order_by_array_not_available',
        message: 'Netior DSL orderBy must be a field selector object, not an array.',
        severity: 'error',
      });
    }
  }

  const runtime: InteractiveViewRuntime = manifest?.runtime === 'host' && issues.length === 0
    ? 'host'
    : 'sandbox';

  return {
    ok: issues.every((issue) => issue.severity !== 'error'),
    runtime,
    issues,
  };
}
