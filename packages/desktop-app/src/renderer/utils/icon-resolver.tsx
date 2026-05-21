import React from 'react';
import { icons, type LucideIcon } from 'lucide-react';
import { FileIcon } from '../components/sidebar/FileIcon';

const iconMap = icons as Record<string, LucideIcon>;
const caseInsensitiveIconMap = new Map(
  Object.keys(iconMap).map((key) => [key.toLowerCase(), key]),
);

/** "book-open", "book_open", "book open" -> "BookOpen" */
function toPascalCase(value: string): string {
  return value
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

/** Backwards-compat aliases for icon names that don't match lucide's kebab convention */
const ALIASES: Record<string, string> = {
  wand: 'Wand2',
  'arrow-down-az': 'ArrowDownAZ',
  'arrow-down-za': 'ArrowDownZA',
  'arrow-up-az': 'ArrowUpAZ',
  'arrow-up-za': 'ArrowUpZA',
};

function isEmojiLike(value: string): boolean {
  return /^\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*$/u.test(value.trim());
}

function getIconByName(name: string): LucideIcon | undefined {
  const exact = iconMap[name];
  if (exact) return exact;

  const caseInsensitiveKey = caseInsensitiveIconMap.get(name.toLowerCase());
  return caseInsensitiveKey ? iconMap[caseInsensitiveKey] : undefined;
}

/** Resolve an icon name to a LucideIcon component */
function lookupIcon(name: string): LucideIcon | undefined {
  const trimmed = name.trim();
  const alias = ALIASES[trimmed.toLowerCase()];
  if (alias) return getIconByName(alias);

  return getIconByName(trimmed) ?? getIconByName(toPascalCase(trimmed));
}

/**
 * Resolve an icon string to a lucide component.
 * If the string matches a known lucide icon name, renders the component.
 * Emoji values render as-is; unknown text falls back to a stable default icon.
 */
export function resolveIcon(icon: string, size = 20): React.ReactNode {
  const trimmed = icon.trim();

  // File/folder icon: "file:readme.md" or "folder:docs"
  if (trimmed.startsWith('file:')) {
    return <FileIcon name={trimmed.slice(5)} size={size} />;
  }
  if (trimmed.startsWith('folder:')) {
    return <FileIcon name={trimmed.slice(7)} isFolder size={size} />;
  }

  const Icon = lookupIcon(trimmed);
  if (Icon) {
    return <Icon size={size} />;
  }

  if (isEmojiLike(trimmed)) {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{trimmed}</span>;
  }

  const FallbackIcon = lookupIcon('box') ?? lookupIcon('square');
  return FallbackIcon ? <FallbackIcon size={size} /> : null;
}
