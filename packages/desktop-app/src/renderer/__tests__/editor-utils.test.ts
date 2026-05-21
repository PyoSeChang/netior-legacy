import { describe, expect, it } from 'vitest';
import { getAvailableEditors, getEditorType, toLocalFileUrl } from '../components/editor/editor-utils';

describe('editor-utils', () => {
  it('opens local HTML files in the browser preview by default with code as an option', () => {
    expect(getEditorType('C:/workspace/site/index.html')).toBe('browser');
    expect(getAvailableEditors('C:/workspace/site/index.html')).toEqual(['browser', 'code']);
    expect(getAvailableEditors('C:/workspace/site/index.htm')).toEqual(['browser', 'code']);
  });

  it('converts local file paths into file URLs for the embedded browser', () => {
    expect(toLocalFileUrl('C:\\workspace\\site\\My Page.html')).toBe('file:///C:/workspace/site/My%20Page.html');
  });
});
