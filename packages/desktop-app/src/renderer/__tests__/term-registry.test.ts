import { describe, expect, it, vi } from 'vitest';
import {
  focusHyperTerminalSurface,
  registerHyperTerminalSurface,
  unregisterHyperTerminalSurface,
} from '../lib/terminal/hyper-fork/term-registry';

describe('hyper terminal term registry', () => {
  it('focuses a registered surface by session id', () => {
    const focus = vi.fn();

    registerHyperTerminalSurface('session-focus', { focus });

    expect(focusHyperTerminalSurface('session-focus')).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);

    unregisterHyperTerminalSurface('session-focus');
  });

  it('does not unregister a newer surface with a stale handle', () => {
    const first = { focus: vi.fn() };
    const second = { focus: vi.fn() };

    registerHyperTerminalSurface('session-replace', first);
    registerHyperTerminalSurface('session-replace', second);
    unregisterHyperTerminalSurface('session-replace', first);

    expect(focusHyperTerminalSurface('session-replace')).toBe(true);
    expect(first.focus).not.toHaveBeenCalled();
    expect(second.focus).toHaveBeenCalledTimes(1);

    unregisterHyperTerminalSurface('session-replace', second);
  });
});
