import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '../../../../shared/src/i18n';

const testDir = dirname(fileURLToPath(import.meta.url));
const rendererDir = join(testDir, '..');

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry === 'assets') return [];
      return listSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function collectLiteralTranslationKeys(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const keys = new Set<string>();
  const patterns = [
    /\bt\(\s*['"`]([^'"`]+)['"`]/g,
    /\btranslate(?:Strict)?\(\s*['"`](?:ko|en)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const key = match[1];
      if (!key.includes('${')) keys.add(key);
    }
  }

  return [...keys].sort();
}

describe('renderer i18n literal keys', () => {
  it('should exist in every locale', () => {
    const missing = listSourceFiles(rendererDir).flatMap((filePath) =>
      collectLiteralTranslationKeys(filePath).flatMap((key) => {
        const failures = [];
        for (const locale of ['ko', 'en'] as const) {
          if (translate(locale, key as never) === key) {
            failures.push(`${relative(rendererDir, filePath)} -> ${locale}:${key}`);
          }
        }
        return failures;
      }),
    );

    expect(missing).toEqual([]);
  });
});
