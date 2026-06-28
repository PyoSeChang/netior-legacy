import type { TerminalLaunchConfig } from '@netior/shared/types';

const emptyUnsubscribe = () => {};

export const terminalService = {
  createInstance: (sessionId: string, launchConfig: TerminalLaunchConfig) =>
    window.electron.terminal.createInstance(sessionId, launchConfig),
  getSession: (sessionId: string) => window.electron.terminal.getSession(sessionId),
  attach: (sessionId: string) => window.electron.terminal.attach(sessionId),
  shutdown: (sessionId: string) => window.electron.terminal.shutdown(sessionId),
  input: (sessionId: string, data: string) => window.electron.terminal.input(sessionId, data),
  resize: (sessionId: string, cols: number, rows: number) => window.electron.terminal.resize(sessionId, cols, rows),
  onExit: (...args: Parameters<NonNullable<typeof window.electron.terminal>['onExit']>) =>
    window.electron.terminal?.onExit?.(...args) ?? emptyUnsubscribe,
  onReady: (...args: Parameters<NonNullable<typeof window.electron.terminal>['onReady']>) =>
    window.electron.terminal?.onReady?.(...args) ?? emptyUnsubscribe,
  onData: (...args: Parameters<NonNullable<typeof window.electron.terminal>['onData']>) =>
    window.electron.terminal?.onData?.(...args) ?? emptyUnsubscribe,
  onTitleChanged: (...args: Parameters<NonNullable<typeof window.electron.terminal>['onTitleChanged']>) =>
    window.electron.terminal?.onTitleChanged?.(...args) ?? emptyUnsubscribe,
  onStateChanged: (...args: Parameters<NonNullable<typeof window.electron.terminal>['onStateChanged']>) =>
    window.electron.terminal?.onStateChanged?.(...args) ?? emptyUnsubscribe,
};
