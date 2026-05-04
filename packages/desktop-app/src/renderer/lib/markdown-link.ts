import { resolveFileInputPath, resolveFirstExistingFilePath } from './file-open-resolver';
import { openExternal } from './open-external';
import { openFileTab } from './open-file-tab';

export type MarkdownLinkTarget =
  | { kind: 'external'; url: string }
  | { kind: 'file'; path: string };

interface OpenMarkdownLinkParams {
  href: string;
  currentFilePath: string;
  sourceTabId: string;
}

const DANGEROUS_EXTERNAL_SCHEMES = new Set(['javascript', 'data', 'vbscript']);
const WINDOWS_DRIVE_PATH_PATTERN = /^\/?[A-Za-z]:/;

function stripWrappingAngleBrackets(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

function getLinkScheme(value: string): string | null {
  if (WINDOWS_DRIVE_PATH_PATTERN.test(value)) return null;

  const match = value.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  return match?.[1]?.toLowerCase() ?? null;
}

function decodeMarkdownPath(value: string): string {
  const unescaped = value.replace(/\\([\\`*_[\]{}()#+\-.!<> ])/g, '$1');
  try {
    return decodeURI(unescaped);
  } catch {
    return unescaped;
  }
}

function stripQueryAndFragment(value: string): string {
  const fragmentIndex = value.indexOf('#');
  const withoutFragment = fragmentIndex >= 0 ? value.slice(0, fragmentIndex) : value;
  const queryIndex = withoutFragment.indexOf('?');
  return queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
}

function stripLineLocationSuffix(value: string): string {
  const match = value.match(/^(.*?)(?::\d+(?::\d+)?)$/);
  if (!match?.[1] || /^[A-Za-z]$/.test(match[1])) return value;
  return match[1];
}

function fileUrlToPath(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:') return null;

    const pathname = decodeURIComponent(url.pathname);
    if (url.host) return `//${url.host}${pathname}`;
    return pathname.replace(/^\/([A-Za-z]:\/)/, '$1');
  } catch {
    return value.replace(/^file:\/+/i, '');
  }
}

export function getMarkdownLinkBaseDir(currentFilePath: string): string {
  const normalized = currentFilePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  if (index < 0) return '';
  if (index === 0) return '/';
  if (index === 2 && /^[A-Za-z]:\//.test(normalized)) return normalized.slice(0, 3);
  return normalized.slice(0, index);
}

export function parseMarkdownLinkTarget(href: string): MarkdownLinkTarget | null {
  const value = stripWrappingAngleBrackets(href);
  if (!value || value.startsWith('#')) return null;

  const scheme = getLinkScheme(value);
  if (scheme && scheme !== 'file') {
    if (DANGEROUS_EXTERNAL_SCHEMES.has(scheme)) return null;
    return { kind: 'external', url: value };
  }

  const rawPath = scheme === 'file'
    ? fileUrlToPath(value)
    : stripQueryAndFragment(value);
  const path = rawPath ? stripLineLocationSuffix(decodeMarkdownPath(rawPath).trim()) : '';
  if (!path) return null;

  return { kind: 'file', path };
}

export async function openMarkdownLink({ href, currentFilePath, sourceTabId }: OpenMarkdownLinkParams): Promise<void> {
  const target = parseMarkdownLinkTarget(href);
  if (!target) return;

  if (target.kind === 'external') {
    await openExternal(target.url);
    return;
  }

  const baseDir = getMarkdownLinkBaseDir(currentFilePath);
  const resolvedFile = await resolveFirstExistingFilePath(target.path, baseDir);
  const filePath = resolvedFile?.path ?? resolveFileInputPath(target.path, baseDir);
  if (!filePath) return;

  await openFileTab({
    filePath,
    sourceTabId,
    placement: 'smart',
  });
}
