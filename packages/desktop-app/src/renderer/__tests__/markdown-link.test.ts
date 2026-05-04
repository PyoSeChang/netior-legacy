import { describe, expect, it } from 'vitest';
import { getMarkdownLinkBaseDir, parseMarkdownLinkTarget } from '../lib/markdown-link';

describe('markdown-link', () => {
  it('keeps normal URLs as external links', () => {
    expect(parseMarkdownLinkTarget('https://example.com/docs?q=1#section')).toEqual({
      kind: 'external',
      url: 'https://example.com/docs?q=1#section',
    });
  });

  it('does not treat Windows absolute paths as URL schemes', () => {
    expect(parseMarkdownLinkTarget('C:/workspace/project/docs/readme.md')).toEqual({
      kind: 'file',
      path: 'C:/workspace/project/docs/readme.md',
    });
  });

  it('converts file URLs into editor file paths', () => {
    expect(parseMarkdownLinkTarget('file:///C:/workspace/project/My%20File.md')).toEqual({
      kind: 'file',
      path: 'C:/workspace/project/My File.md',
    });
  });

  it('cleans relative markdown file targets', () => {
    expect(parseMarkdownLinkTarget('./notes/My\\ File.md:12#heading')).toEqual({
      kind: 'file',
      path: './notes/My File.md',
    });
  });

  it('ignores document anchors and unsafe script links', () => {
    expect(parseMarkdownLinkTarget('#heading')).toBeNull();
    expect(parseMarkdownLinkTarget('javascript:alert(1)')).toBeNull();
  });

  it('resolves base directories from markdown file paths', () => {
    expect(getMarkdownLinkBaseDir('C:/workspace/project/docs/readme.md')).toBe('C:/workspace/project/docs');
    expect(getMarkdownLinkBaseDir('/home/me/project/readme.md')).toBe('/home/me/project');
  });
});
