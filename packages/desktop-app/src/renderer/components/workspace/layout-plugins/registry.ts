import type { WorkspaceLayoutPlugin } from './types';
import { calendarPlugin } from './calendar';
import { freeformPlugin } from './freeform';
import { ganttPlugin } from './gantt';
import { timelinePlugin } from './timeline';

const registry = new Map<string, WorkspaceLayoutPlugin>();
const legacyAliases = new Map<string, string>([
  ['horizontal-timeline', 'gantt'],
]);

export function registerLayout(plugin: WorkspaceLayoutPlugin): void {
  registry.set(plugin.key, plugin);
}

export function getLayout(key?: string | null): WorkspaceLayoutPlugin {
  if (key && registry.has(key)) return registry.get(key)!;
  if (key) {
    const normalizedKey = legacyAliases.get(key);
    if (normalizedKey && registry.has(normalizedKey)) return registry.get(normalizedKey)!;
  }
  return registry.get('freeform')!;
}

export function listLayouts(): WorkspaceLayoutPlugin[] {
  return Array.from(registry.values());
}

// Register built-in plugins
registerLayout(freeformPlugin);
registerLayout(timelinePlugin);
registerLayout(calendarPlugin);
registerLayout(ganttPlugin);
