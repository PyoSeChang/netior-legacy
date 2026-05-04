import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getRuntimeLogsDir } from './runtime/runtime-paths';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

const originalConsole: Record<ConsoleMethod, (...args: unknown[]) => void> = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let activeLogFilePath: string | null = null;
let loggingInitialized = false;

export function initMainLogging(): string {
  if (loggingInitialized && activeLogFilePath) {
    return activeLogFilePath;
  }

  const logsDir = getRuntimeLogsDir();
  mkdirSync(logsDir, { recursive: true });
  activeLogFilePath = join(logsDir, 'desktop-main.log');
  loggingInitialized = true;

  (['log', 'info', 'warn', 'error'] as const).forEach((method) => {
    console[method] = (...args: unknown[]) => {
      writeLogLine(method, args);
      originalConsole[method](...args);
    };
  });

  writeLogLine('info', [`desktop main logging initialized at ${activeLogFilePath}`]);
  return activeLogFilePath;
}

function writeLogLine(level: ConsoleMethod, args: unknown[]): void {
  if (!activeLogFilePath) {
    return;
  }

  const timestamp = new Date().toISOString();
  const message = args.map(formatLogValue).join(' ');

  try {
    appendFileSync(activeLogFilePath, `[${timestamp}] [${level}] ${message}\n`, 'utf8');
  } catch {
    // Ignore logging write failures.
  }
}

function formatLogValue(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
