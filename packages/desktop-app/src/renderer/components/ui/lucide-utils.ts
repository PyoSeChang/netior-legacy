import { icons } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const nameCache: string[] = Object.keys(icons).sort();

export const iconNames: string[] = nameCache;

export function getIconComponent(name: string): LucideIcon | undefined {
  // icons object keys are PascalCase (e.g., "CircleUser")
  // Stored names may be PascalCase already
  if (name in icons) {
    return icons[name as keyof typeof icons];
  }
  return undefined;
}
