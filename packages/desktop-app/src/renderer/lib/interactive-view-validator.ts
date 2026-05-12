import type { InteractiveViewManifest, InteractiveViewRuntime } from '@netior/shared/types';

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

function collectFieldWrites(source: string): string[] {
  const writes = new Set<string>();
  const updateFieldPattern = /\b(?:updateField|setField|saveField)\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = updateFieldPattern.exec(source))) {
    writes.add(match[1]);
  }
  return [...writes];
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

  const runtime: InteractiveViewRuntime = manifest?.runtime === 'host' && issues.length === 0
    ? 'host'
    : 'sandbox';

  return {
    ok: issues.every((issue) => issue.severity !== 'error'),
    runtime,
    issues,
  };
}
