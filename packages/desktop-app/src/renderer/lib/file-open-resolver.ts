import { fsService } from '../services';
import { useModuleStore } from '../stores/module-store';
import { useWorldStore } from '../stores/world-store';

export interface ResolvedFilePath {
  input: string;
  path: string;
  source: 'absolute' | 'terminal' | 'world' | 'module';
}

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/');
}

function isAbsolutePath(path: string): boolean {
  const normalized = normalizeSeparators(path);
  return /^[A-Za-z]:\//.test(normalized) || /^\/[A-Za-z]:\//.test(normalized) || /^\/(?!\/)/.test(normalized);
}

function normalizeAbsoluteInputPath(path: string): string {
  return normalizeSeparators(path).replace(/^\/([A-Za-z]:\/)/, '$1');
}

function normalizeJoinedPath(path: string): string {
  const normalized = normalizeAbsoluteInputPath(path);
  const drive = normalized.match(/^[A-Za-z]:/)?.[0] ?? '';
  const startsWithSlash = normalized.startsWith('/');
  const body = drive ? normalized.slice(drive.length) : normalized;
  const parts: string[] = [];

  for (const part of body.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') {
        parts.pop();
      } else if (!drive && !startsWithSlash) {
        parts.push(part);
      }
      continue;
    }
    parts.push(part);
  }

  const prefix = drive ? `${drive}/` : startsWithSlash ? '/' : '';
  return `${prefix}${parts.join('/')}`;
}

function joinPath(base: string, relativePath: string): string {
  const strippedRelative = normalizeSeparators(relativePath).replace(/^\.?\//, '');
  return normalizeJoinedPath(`${base}/${strippedRelative}`);
}

export function normalizeFilePathInput(inputPath: string): string {
  return normalizeAbsoluteInputPath(inputPath.trim().replace(/^["'`]+|["'`]+$/g, ''));
}

export function resolveFileInputPath(inputPath: string, baseDir?: string): string | null {
  const input = normalizeFilePathInput(inputPath);
  if (!input) return null;
  if (isAbsolutePath(input)) return normalizeJoinedPath(input);
  if (baseDir) return joinPath(baseDir, input);
  return normalizeJoinedPath(input);
}

async function pushIfExists(
  candidates: ResolvedFilePath[],
  seen: Set<string>,
  input: string,
  path: string,
  source: ResolvedFilePath['source'],
): Promise<void> {
  const normalized = normalizeJoinedPath(path);
  const key = normalized.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  if (await fsService.existsItem(normalized)) {
    candidates.push({ input, path: normalized, source });
  }
}

export async function resolveFilePathCandidates(inputPath: string, terminalCwd?: string): Promise<ResolvedFilePath[]> {
  const input = normalizeFilePathInput(inputPath);
  const candidates: ResolvedFilePath[] = [];
  const seen = new Set<string>();

  if (!input) return candidates;

  if (isAbsolutePath(input)) {
    await pushIfExists(candidates, seen, input, input, 'absolute');
    return candidates;
  }

  if (terminalCwd) {
    await pushIfExists(candidates, seen, input, joinPath(terminalCwd, input), 'terminal');
  }

  const worldRoot = useWorldStore.getState().currentWorld?.root_dir;
  if (worldRoot) {
    await pushIfExists(candidates, seen, input, joinPath(worldRoot, input), 'world');
  }

  const moduleDirs = useModuleStore.getState().directories.map((directory) => directory.dir_path);
  for (const dirPath of moduleDirs) {
    await pushIfExists(candidates, seen, input, joinPath(dirPath, input), 'module');
  }

  return candidates;
}

export async function resolveFirstExistingFilePath(inputPath: string, terminalCwd?: string): Promise<ResolvedFilePath | null> {
  const candidates = await resolveFilePathCandidates(inputPath, terminalCwd);
  return candidates[0] ?? null;
}
