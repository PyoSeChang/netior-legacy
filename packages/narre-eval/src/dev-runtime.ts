import { createHash } from 'crypto';
import { join } from 'path';

const WORKTREE_MARKER = '/.claude/worktrees/';

export interface DevRuntimeTarget {
  runtimeScope: string;
  dbPath: string;
}

export function resolveDevRuntimeTarget(cwd = process.cwd()): DevRuntimeTarget {
  const runtimeScope = createRuntimeScope(cwd);
  const appData = process.env.APPDATA || process.env.HOME || '.';
  const dataDir = join(appData, 'netior', 'runtime', runtimeScope, 'data');
  return {
    runtimeScope,
    dbPath: join(dataDir, 'netior-dev.db'),
  };
}

function createRuntimeScope(cwd: string): string {
  const label = sanitizeSegment(extractWorktreeLabel(cwd));
  const cwdHash = createHash('sha256')
    .update(normalizePath(cwd))
    .digest('hex')
    .slice(0, 8);
  return `dev-${label}-${cwdHash}`;
}

function extractWorktreeLabel(cwd: string): string {
  const normalized = cwd.replace(/\\/g, '/');
  const markerIndex = normalized.indexOf(WORKTREE_MARKER);
  if (markerIndex === -1) return 'main';
  const segments = normalized.slice(markerIndex + WORKTREE_MARKER.length).split('/').filter(Boolean);
  return segments[0] || 'main';
}

function sanitizeSegment(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'main';
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').trim().toLowerCase();
}
