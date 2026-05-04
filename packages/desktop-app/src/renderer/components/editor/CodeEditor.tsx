import React, { useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { getCssColorAsHex } from './editor-utils';
import { useViewState } from '../../hooks/useViewState';
import { useSettingsStore } from '../../stores/settings-store';

type MonacoEditor = Parameters<OnMount>[0];
type MonacoNamespace = Parameters<NonNullable<Parameters<typeof Editor>[0]['beforeMount']>>[0];

interface CodeViewState {
  cursorLine: number;
  cursorColumn: number;
  scrollTop: number;
}

interface CodeEditorProps {
  tabId: string;
  content: string;
  language: string;
  onChange: (content: string) => void;
}

export function CodeEditor({ tabId, content, language, onChange }: CodeEditorProps): JSX.Element {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoNamespace | null>(null);
  const [viewState, setViewState] = useViewState<CodeViewState>(tabId, { cursorLine: 1, cursorColumn: 1, scrollTop: 0 });
  const viewStateRef = useRef(viewState);
  const resolvedThemeMode = useSettingsStore((s) => s.resolvedThemeMode);
  const themeRevision = useSettingsStore((s) => s.themeRevision);
  const codeTypography = useSettingsStore((s) => s.typography.code);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;

    // Restore cursor and scroll from cached view state
    const vs = viewStateRef.current;
    if (vs.cursorLine > 1 || vs.cursorColumn > 1) {
      editor.setPosition({ lineNumber: vs.cursorLine, column: vs.cursorColumn });
      editor.revealPositionInCenter({ lineNumber: vs.cursorLine, column: vs.cursorColumn });
    }
    if (vs.scrollTop > 0) {
      editor.setScrollTop(vs.scrollTop);
    }

    // Save cursor on change
    editor.onDidChangeCursorPosition((e) => {
      setViewState((prev) => ({
        ...prev,
        cursorLine: e.position.lineNumber,
        cursorColumn: e.position.column,
      }));
    });

    // Save scroll on change
    editor.onDidScrollChange((e) => {
      setViewState((prev) => ({ ...prev, scrollTop: e.scrollTop }));
    });
  }, [setViewState]);

  const handleChange = useCallback((value: string | undefined) => {
    onChange(value ?? '');
  }, [onChange]);

  const isDark = resolvedThemeMode !== 'light';
  const bg = getCssColorAsHex('--surface-editor', isDark ? '#242424' : '#f5f5f5');
  const textMuted = getCssColorAsHex('--text-muted', isDark ? '#8a8a8a' : '#6b7280');
  const textSecondary = getCssColorAsHex('--text-secondary', isDark ? '#b0b0b0' : '#4b5563');
  const borderSubtle = getCssColorAsHex('--border-subtle', isDark ? '#404040' : '#d8dbe2');
  const stateHover = getCssColorAsHex('--state-hover-bg', isDark ? '#363636' : '#eceff4');
  const accentMuted = getCssColorAsHex('--accent-muted', isDark ? '#568b5f' : '#dcebe0');
  const transparent = '#00000000';
  const monacoThemeColors = React.useMemo(() => ({
    'editor.background': bg,
    'editorGutter.background': bg,
    'editorLineNumber.foreground': textMuted,
    'editorLineNumber.activeForeground': textSecondary,
    'editor.lineHighlightBackground': stateHover,
    'editor.lineHighlightBorder': transparent,
    'editorIndentGuide.background1': borderSubtle,
    'editorIndentGuide.activeBackground1': textMuted,
    'scrollbar.shadow': transparent,
    'scrollbarSlider.background': textMuted,
    'scrollbarSlider.hoverBackground': textSecondary,
    'scrollbarSlider.activeBackground': textSecondary,
    'editorOverviewRuler.border': transparent,
    'editor.selectionBackground': accentMuted,
  }), [accentMuted, bg, borderSubtle, stateHover, textMuted, textSecondary]);

  const handleBeforeMount = useCallback((monaco: MonacoNamespace) => {
    monacoRef.current = monaco;
    monaco.editor.defineTheme('netior-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: monacoThemeColors,
    });
    monaco.editor.defineTheme('netior-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: monacoThemeColors,
    });
  }, [monacoThemeColors]);

  React.useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    monaco.editor.defineTheme('netior-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: monacoThemeColors,
    });
    monaco.editor.defineTheme('netior-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: monacoThemeColors,
    });
    monaco.editor.setTheme(isDark ? 'netior-dark' : 'netior-light');
  }, [isDark, monacoThemeColors, themeRevision]);

  return (
    <div className="netior-monaco-editor h-full min-h-0 w-full overflow-hidden bg-surface-editor">
      <Editor
        height="100%"
        language={language}
        value={content}
        theme={isDark ? 'netior-dark' : 'netior-light'}
        beforeMount={handleBeforeMount}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontFamily: codeTypography.fontFamily,
          fontSize: codeTypography.fontSize,
          lineHeight: Math.round(codeTypography.fontSize * codeTypography.lineHeight),
          letterSpacing: codeTypography.letterSpacing,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            useShadows: false,
            vertical: 'visible',
            horizontal: 'auto',
            verticalScrollbarSize: 12,
            horizontalScrollbarSize: 12,
            verticalSliderSize: 10,
            horizontalSliderSize: 10,
          },
        }}
      />
    </div>
  );
}
