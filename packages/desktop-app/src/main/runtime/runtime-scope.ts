import { createHash } from 'crypto';

const WORKTREE_MARKER = '/.claude/worktrees/';
const PACKAGED_SCOPE = 'packaged';
const NETIOR_SERVICE_DEV_PORT_BASE = 4300;
const NARRE_SERVER_DEV_PORT_BASE = 4700;
const DEV_PORT_RANGE = 400;

export type ScopedPortKind = 'netior-service' | 'narre-server';

export function extractWorktreeLabel(cwd: string): string {
  const normalized = cwd.replace(/\\/g, '/');
  const markerIndex = normalized.indexOf(WORKTREE_MARKER);
  if (markerIndex === -1) {
    return 'main';
  }

  const segments = normalized.slice(markerIndex + WORKTREE_MARKER.length).split('/').filter(Boolean);
  return segments[0] || 'main';
}

export function createRuntimeScope(options: {
  cwd: string;
  packaged: boolean;
}): string {
  if (options.packaged) {
    return PACKAGED_SCOPE;
  }

  const label = sanitizeSegment(extractWorktreeLabel(options.cwd));
  const cwdHash = createHash('sha256')
    .update(normalizePath(options.cwd))
    .digest('hex')
    .slice(0, 8);

  return `dev-${label}-${cwdHash}`;
}

export function createScopedPort(options: {
  kind: ScopedPortKind;
  runtimeScope: string;
}): number {
  if (options.runtimeScope === PACKAGED_SCOPE) {
    return options.kind === 'netior-service' ? 3201 : 3100;
  }

  const offset = createHash('sha256')
    .update(`${options.kind}:${options.runtimeScope}`)
    .digest()
    .readUInt16BE(0) % DEV_PORT_RANGE;

  return (options.kind === 'netior-service' ? NETIOR_SERVICE_DEV_PORT_BASE : NARRE_SERVER_DEV_PORT_BASE) + offset;
}

export function isPackagedRuntimeScope(runtimeScope: string): boolean {
  return runtimeScope === PACKAGED_SCOPE;
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
