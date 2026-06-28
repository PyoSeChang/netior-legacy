import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { getRuntimeDataDir } from '../runtime/runtime-paths';

type ConfigValues = Record<string, unknown>;

let loaded = false;
let cache: ConfigValues = {};

function getConfigPath(): string {
  return join(getRuntimeDataDir(), 'desktop-config.json');
}

function loadConfig(): void {
  if (loaded) return;
  loaded = true;

  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    cache = {};
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown;
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as ConfigValues
      : {};
  } catch {
    cache = {};
  }
}

function saveConfig(): void {
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(cache, null, 2), 'utf8');
}

export function getDesktopConfig(key: string): unknown {
  loadConfig();
  return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
}

export function setDesktopConfig(key: string, value: unknown): boolean {
  loadConfig();
  cache[key] = value;
  saveConfig();
  return true;
}
