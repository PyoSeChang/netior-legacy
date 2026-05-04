import { describe, expect, it } from 'vitest';
import { createRuntimeScope, createScopedPort, extractWorktreeLabel } from './runtime-scope';

describe('runtime-scope', () => {
  it('uses main for the primary repo path', () => {
    expect(extractWorktreeLabel('C:\\PyoSeChang\\projects\\netior')).toBe('main');
  });

  it('extracts the worktree label from a codex worktree path', () => {
    expect(extractWorktreeLabel('C:\\repo\\.claude\\worktrees\\terminal-refactor')).toBe('terminal-refactor');
  });

  it('creates stable but distinct runtime scopes for dev roots', () => {
    const mainScope = createRuntimeScope({
      cwd: 'C:\\PyoSeChang\\projects\\netior',
      packaged: false,
    });
    const worktreeScope = createRuntimeScope({
      cwd: 'C:\\PyoSeChang\\projects\\netior\\.claude\\worktrees\\terminal-refactor',
      packaged: false,
    });

    expect(mainScope).toMatch(/^dev-main-[a-f0-9]{8}$/);
    expect(worktreeScope).toMatch(/^dev-terminal-refactor-[a-f0-9]{8}$/);
    expect(mainScope).not.toBe(worktreeScope);
  });

  it('keeps packaged runtimes on the fixed production ports', () => {
    expect(createScopedPort({ kind: 'netior-service', runtimeScope: 'packaged' })).toBe(3201);
    expect(createScopedPort({ kind: 'narre-server', runtimeScope: 'packaged' })).toBe(3100);
  });

  it('assigns deterministic dev ports per runtime scope', () => {
    const runtimeScope = createRuntimeScope({
      cwd: 'C:\\PyoSeChang\\projects\\netior\\.claude\\worktrees\\terminal-refactor',
      packaged: false,
    });

    const servicePort = createScopedPort({ kind: 'netior-service', runtimeScope });
    const narrePort = createScopedPort({ kind: 'narre-server', runtimeScope });

    expect(servicePort).toBe(createScopedPort({ kind: 'netior-service', runtimeScope }));
    expect(narrePort).toBe(createScopedPort({ kind: 'narre-server', runtimeScope }));
    expect(servicePort).toBeGreaterThanOrEqual(4300);
    expect(servicePort).toBeLessThan(4700);
    expect(narrePort).toBeGreaterThanOrEqual(4700);
    expect(narrePort).toBeLessThan(5100);
  });
});
