import { describe, expect, it } from 'vitest';
import { toAbsolutePath, toRelativePath } from '../utils/path-utils';

describe('path-utils', () => {
  it('converts world-relative paths to absolute paths', () => {
    expect(toAbsolutePath('C:/workspace/world', 'docs/file.pdf')).toBe(
      'C:/workspace/world/docs/file.pdf',
    );
  });

  it('keeps absolute paths unchanged apart from slash normalization', () => {
    expect(toAbsolutePath('C:/workspace/world', 'C:\\files\\think-data-structure.pdf')).toBe(
      'C:/files/think-data-structure.pdf',
    );
  });

  it('converts absolute paths inside the world directory back to relative paths', () => {
    expect(toRelativePath('C:/workspace/world', 'C:/workspace/world/docs/file.pdf')).toBe(
      'docs/file.pdf',
    );
  });
});
