import { describe, expect, it, vi } from 'vitest';
import { consumeShortcutEvent } from '../shortcuts/shortcut-utils';

describe('consumeShortcutEvent', () => {
  it('prevents default, marks the event as handled, and stops propagation to the target', () => {
    const target = document.createElement('textarea');
    document.body.appendChild(target);

    const targetHandler = vi.fn();
    const captureHandler = (event: KeyboardEvent): void => {
      consumeShortcutEvent(event);
    };

    window.addEventListener('keydown', captureHandler, true);
    target.addEventListener('keydown', targetHandler);

    const event = new KeyboardEvent('keydown', {
      key: '\\',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    target.dispatchEvent(event);

    window.removeEventListener('keydown', captureHandler, true);
    target.removeEventListener('keydown', targetHandler);
    target.remove();

    expect(targetHandler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    expect((event as KeyboardEvent & { catched?: boolean }).catched).toBe(true);
  });
});
