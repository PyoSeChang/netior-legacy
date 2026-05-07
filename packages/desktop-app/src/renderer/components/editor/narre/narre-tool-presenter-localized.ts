import {
  getNetiorMcpToolSpec,
  getNarreToolMetadata,
  normalizeNetiorToolName,
} from '@netior/shared/constants';
import { translate, type Locale, type TranslationKey } from '@netior/shared/i18n';
import type { NarreToolCall, NarreToolCategory } from '@netior/shared/types';

const COUNT_NOUNS: Record<string, { ko: string; en: string }> = {
  list_concepts: { ko: 'concept', en: 'concept' },
  list_models: { ko: 'model', en: 'model' },
  list_networks: { ko: 'network', en: 'network' },
  list_modules: { ko: 'module', en: 'module' },
  list_model_fields: { ko: 'field', en: 'field' },
  glob_files: { ko: 'file', en: 'file' },
  grep_files: { ko: 'match', en: 'match' },
  list_directory: { ko: 'entry', en: 'entry' },
};

const PERMISSION_TOOL_RE = /tool "([^"]+)"/i;

function resolveLocale(locale: string): Locale {
  return locale.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function trimErrorPrefix(value: string): string {
  return value.replace(/^Error:\s*/i, '').trim();
}

function parseResultPayload(raw: string | undefined): unknown | null {
  if (!raw || raw.trim().length === 0) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function basename(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const normalized = value.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments.at(-1) ?? normalized;
}

function formatCount(count: number, label: { ko: string; en: string }, locale: Locale): string {
  const noun = locale === 'ko' ? label.ko : label.en;
  return locale === 'ko'
    ? `${noun} ${count}`
    : `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function translateOrNull(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string | null {
  const translated = translate(locale, key as TranslationKey, params);
  return translated === key ? null : translated;
}

function resolveToolLabel(
  toolName: string,
  locale: Locale,
  fallbackDisplayName?: string,
): string {
  const normalizedToolName = normalizeNetiorToolName(toolName);
  const translated = translateOrNull(locale, `narre.toolLabel.${snakeToCamel(normalizedToolName)}`);
  if (translated) return translated;

  const spec = getNetiorMcpToolSpec(normalizedToolName);
  if (spec?.displayName) return spec.displayName;

  return fallbackDisplayName ?? getNarreToolMetadata(normalizedToolName).displayName;
}

function summarizeGenericSuccess(
  toolKey: string,
  payload: unknown,
  input: Record<string, unknown>,
  locale: Locale,
): string {
  const label = resolveToolLabel(toolKey, locale);

  if (toolKey === 'read_file') {
    const fileName = basename(input.file_path);
    return fileName ? `Read ${fileName}` : `${label} completed`;
  }

  if (toolKey === 'read_pdf_pages' || toolKey === 'read_pdf_pages_vision') {
    const fileName = basename(input.file_path);
    return fileName ? `Read PDF pages from ${fileName}` : 'Read PDF pages';
  }

  if (toolKey === 'list_directory' && Array.isArray(payload)) {
    const dirName = basename(input.dir_path);
    return dirName
      ? `Found ${payload.length} entries in ${dirName}`
      : `Found ${payload.length} directory entries`;
  }

  const noun = COUNT_NOUNS[toolKey];
  if (noun && Array.isArray(payload)) {
    return `Found ${formatCount(payload.length, noun, locale)}`;
  }

  const parsed = asRecord(payload);
  const count = asNumber(parsed?.count);
  if (count !== null) {
    return `${label} returned ${count} items`;
  }

  if (Array.isArray(payload)) {
    return `${label} returned ${payload.length} items`;
  }

  return `${label} completed`;
}

function summarizeToolError(error: string | undefined, locale: Locale): string | null {
  if (!error) return null;
  const message = trimErrorPrefix(error);

  if (/^Project not found:\s*(.+)$/i.test(message)) {
    const [, projectId] = message.match(/^Project not found:\s*(.+)$/i) ?? [];
    return locale === 'ko'
      ? `Project ${projectId} was not found`
      : `Project ${projectId} was not found`;
  }

  if (/^Concept not found:\s*(.+)$/i.test(message)) {
    const [, conceptId] = message.match(/^Concept not found:\s*(.+)$/i) ?? [];
    return `Concept ${conceptId} was not found`;
  }

  if (/^File entity not found:\s*(.+)$/i.test(message)) {
    const [, fileId] = message.match(/^File entity not found:\s*(.+)$/i) ?? [];
    return `File entity ${fileId} was not found`;
  }

  if (message.includes('resources/list failed') && message.includes('-32601')) {
    return 'This MCP server does not support resource listing';
  }

  if (message.includes('resources/templates/list failed') && message.includes('-32601')) {
    return 'This MCP server does not support resource template listing';
  }

  if (message === 'No module paths registered for this project') {
    return 'No module paths are registered for this project';
  }

  if (message === 'end_page must be >= start_page') {
    return 'End page must be greater than or equal to start page';
  }

  if (message.includes('Requested range') && message.includes('out of bounds')) {
    return 'The requested PDF page range is out of bounds';
  }

  if (message.includes('canvas')) {
    return 'Vision PDF reading requires the canvas package';
  }

  return message;
}

export function getLocalizedToolLabel(
  toolName: string,
  locale: string,
  fallbackDisplayName?: string,
): string {
  return resolveToolLabel(toolName, resolveLocale(locale), fallbackDisplayName);
}

export function getLocalizedToolDescription(
  toolName: string,
  locale: string,
  fallbackDescription?: string,
): string | null {
  const resolvedLocale = resolveLocale(locale);
  const normalizedToolName = normalizeNetiorToolName(toolName);
  const translated = translateOrNull(resolvedLocale, `narre.toolDescription.${snakeToCamel(normalizedToolName)}`);
  if (translated) return translated;

  return fallbackDescription ?? getNarreToolMetadata(normalizedToolName).description ?? null;
}

export function getLocalizedPermissionMessage(message: string, locale: string): string {
  const match = message.match(PERMISSION_TOOL_RE);
  if (!match?.[1]) return message;

  const resolvedLocale = resolveLocale(locale);
  const toolLabel = resolveToolLabel(match[1], resolvedLocale);
  const translated = translateOrNull(resolvedLocale, 'narre.card.permissionRequest', { tool: toolLabel });
  return translated ?? message;
}

export function getLocalizedToolCategoryLabel(category: NarreToolCategory, locale: string): string {
  return translate(resolveLocale(locale), `narre.toolCategory.${category}` as TranslationKey);
}

export function getLocalizedToolWriteLabel(locale: string): string {
  return translate(resolveLocale(locale), 'narre.toolWrite');
}

export function getToolResultSummary(call: NarreToolCall, locale: string): string | null {
  const resolvedLocale = resolveLocale(locale);
  const normalizedToolName = normalizeNetiorToolName(call.tool);

  if (call.status === 'error') {
    return summarizeToolError(call.error ?? call.result, resolvedLocale);
  }

  if (call.status !== 'success') return null;

  const payload = parseResultPayload(call.result);
  return summarizeGenericSuccess(normalizedToolName, payload, call.input, resolvedLocale);
}
