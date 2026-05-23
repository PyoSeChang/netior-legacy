import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, keymap, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM } from '@lezer/markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { createLivePreviewPlugin, livePreviewTheme } from './live-preview';
import { MarkdownToc, extractHeadings } from './MarkdownToc';
import { useI18n } from '../../../hooks/useI18n';
import { useViewState } from '../../../hooks/useViewState';
import { getCssColorAsHex } from '../editor-utils';
import { useSettingsStore } from '../../../stores/settings-store';
import { useEditorStore, MAIN_HOST_ID } from '../../../stores/editor-store';
import { openMarkdownLink } from '../../../lib/markdown-link';
import { emitPerfDiagnostic, useLongTaskPerfTrace, useRenderPerfTrace, perfDiagnosticsEnabled } from '../../../lib/perf-diagnostics';

const codeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#61afef' },
  { tag: tags.variableName, color: '#e06c75' },
  { tag: tags.typeName, color: '#e5c07b' },
  { tag: tags.className, color: '#e5c07b' },
  { tag: tags.operator, color: '#56b6c2' },
  { tag: tags.bool, color: '#d19a66' },
  { tag: tags.null, color: '#d19a66' },
  { tag: tags.propertyName, color: '#e06c75' },
  { tag: tags.definition(tags.variableName), color: '#61afef' },
  { tag: tags.punctuation, color: '#abb2bf' },
  { tag: tags.meta, color: '#abb2bf' },
  { tag: tags.atom, color: '#d19a66' },
  { tag: tags.regexp, color: '#98c379' },
  { tag: tags.attributeName, color: '#d19a66' },
  { tag: tags.attributeValue, color: '#98c379' },
  { tag: tags.tagName, color: '#e06c75' },
]);

interface MdViewState {
  cursorPos: number;
  scrollTop: number;
  tocPinned: boolean;
}

interface MarkdownEditorProps {
  tabId: string;
  content: string;
  filePath?: string;
  extensions?: Extension[];
  insertTextRequest?: { id: number; text: string; block?: boolean; replaceFrom?: number; replaceTo?: number } | null;
  contentMaxWidth?: string;
  contentPadding?: string;
  fillHeight?: boolean;
  minHeight?: string;
  readOnly?: boolean;
  showToc?: boolean;
  refreshKey?: unknown;
  needsTrailingEditableLine?: (content: string) => boolean;
  onInputActivity?: () => void;
  onChange: (content: string) => void;
}

const EMPTY_EXTENSIONS: Extension[] = [];
const PERF_LOG_THRESHOLD_MS = 16;

export function MarkdownEditor({
  tabId,
  content,
  filePath,
  extensions: extraExtensions = EMPTY_EXTENSIONS,
  insertTextRequest,
  contentMaxWidth = '600px',
  contentPadding = '1.5rem 1rem 10rem 1rem',
  fillHeight = true,
  minHeight = '360px',
  readOnly = false,
  showToc = true,
  refreshKey,
  needsTrailingEditableLine,
  onInputActivity,
  onChange,
}: MarkdownEditorProps): JSX.Element {
  const { t } = useI18n();
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editorValue, setEditorValue] = useState(content);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalContentRef = useRef(content);
  const lastLocalChangeRef = useRef(content);

  const [viewState, setViewState] = useViewState<MdViewState>(tabId, { cursorPos: 0, scrollTop: 0, tocPinned: false });
  const viewStateRef = useRef(viewState);
  const [currentLine, setCurrentLine] = useState(1);
  const currentLineRef = useRef(1);
  const cursorSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCursorPosRef = useRef(0);
  const lastInputStartedAtRef = useRef(0);
  const lastInputKindRef = useRef('unknown');
  const headings = useMemo(() => extractHeadings(editorValue), [editorValue]);
  const resolvedThemeMode = useSettingsStore((s) => s.resolvedThemeMode);
  const themeRevision = useSettingsStore((s) => s.themeRevision);
  const isDark = resolvedThemeMode !== 'light';
  useRenderPerfTrace('MarkdownEditor', {
    tabId,
    contentLength: content.length,
    editorValueLength: editorValue.length,
    extraExtensionsCount: extraExtensions.length,
    hasInsertTextRequest: Boolean(insertTextRequest),
    hasRefreshKey: refreshKey !== undefined,
    fillHeight,
    headingsCount: headings.length,
    currentLine,
    themeRevision,
  });
  useLongTaskPerfTrace('MarkdownEditor', {
    tabId,
    contentLength: content.length,
    editorValueLength: editorValue.length,
    extraExtensionsCount: extraExtensions.length,
    fillHeight,
  });

  // Listen for toc:toggle shortcut (only when this editor's tab is active)
  useEffect(() => {
    const handleTocToggle = () => {
      const { activeTabId, tabs } = useEditorStore.getState();
      // Find the tab that owns this editor by matching tabId
      const ownerTab = tabs.find((t) => t.id === tabId);
      if (!ownerTab) return;
      // Only respond if this tab is active in its host
      if (ownerTab.hostId === MAIN_HOST_ID) {
        if (activeTabId !== tabId) return;
      } else {
        const host = useEditorStore.getState().hosts[ownerTab.hostId];
        if (host?.activeTabId !== tabId) return;
      }
      if (headings.length === 0) return;
      setViewState((prev) => ({ ...prev, tocPinned: !prev.tocPinned }));
    };
    window.addEventListener('toc:toggle', handleTocToggle);
    return () => window.removeEventListener('toc:toggle', handleTocToggle);
  }, [tabId, headings.length, setViewState]);

  // Restore scroll position after CM6 mounts
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    const view = cmRef.current?.view;
    const scroller = scrollRef.current;
    if (!view || !scroller) return;

    const vs = viewStateRef.current;

    // Restore cursor
    if (vs.cursorPos > 0 && vs.cursorPos <= view.state.doc.length) {
      view.dispatch({ selection: { anchor: vs.cursorPos } });
      const line = view.state.doc.lineAt(vs.cursorPos).number;
      currentLineRef.current = line;
      setCurrentLine(line);
    }

    // Restore scroll (defer to next frame so CM6 has laid out)
    if (vs.scrollTop > 0) {
      requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop = vs.scrollTop;
      });
    }

    restoredRef.current = true;
  });

  // Save scroll position
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const handleScroll = () => {
      setViewState((prev) => ({ ...prev, scrollTop: scroller.scrollTop }));
    };
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', handleScroll);
  }, [setViewState]);

  // Track cursor line + save cursor pos
  const cursorPlugin = useMemo(() => ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (update.selectionSet || update.docChanged) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos).number;
          pendingCursorPosRef.current = pos;
          if (line !== currentLineRef.current) {
            currentLineRef.current = line;
            setCurrentLine(line);
          }
          if (cursorSaveTimerRef.current) return;
          cursorSaveTimerRef.current = setTimeout(() => {
            cursorSaveTimerRef.current = null;
            const cursorPos = pendingCursorPosRef.current;
            setViewState((prev) => (prev.cursorPos === cursorPos ? prev : { ...prev, cursorPos }));
          }, 250);
        }
      }
    },
  ), [setViewState]);

  const perfPlugin = useMemo(() => ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (!update.docChanged && !update.selectionSet) return;
        const startedAt = lastInputStartedAtRef.current || performance.now();
        const duration = performance.now() - startedAt;
        if (duration < PERF_LOG_THRESHOLD_MS) return;
        console.debug('[NetiorPerf] CodeMirror.transaction', {
          tabId,
          durationMs: Math.round(duration * 10) / 10,
          input: lastInputKindRef.current,
          docChanged: update.docChanged,
          selectionSet: update.selectionSet,
          viewportChanged: update.viewportChanged,
          docLength: update.state.doc.length,
          visibleRanges: update.view.visibleRanges.map((range) => `${range.from}-${range.to}`),
        });
      }
    },
  ), [tabId]);

  const handleLinkClick = useCallback((href: string) => {
    if (!filePath) return;
    void openMarkdownLink({ href, currentFilePath: filePath, sourceTabId: tabId }).catch((error) => {
      console.error('[MarkdownEditor] Failed to open link:', error);
    });
  }, [filePath, tabId]);

  const extensions = useMemo(() => [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown({ extensions: GFM, codeLanguages: languages }),
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    cursorPlugin,
    perfPlugin,
    ...createLivePreviewPlugin(handleLinkClick),
    livePreviewTheme,
    ...extraExtensions,
    syntaxHighlighting(codeHighlightStyle),
    EditorView.lineWrapping,
  ], [cursorPlugin, extraExtensions, handleLinkClick, perfPlugin, readOnly]);

  useEffect(() => {
    if (!perfDiagnosticsEnabled()) return;
    emitPerfDiagnostic('MarkdownEditor.extensions', {
      tabId,
      extensionCount: extensions.length,
      extraExtensionsCount: extraExtensions.length,
      fillHeight,
      contentLength: content.length,
    });
  }, [content.length, extensions, extraExtensions.length, fillHeight, tabId]);

  const theme = useMemo(() => {
    const bg = getCssColorAsHex('--surface-editor', isDark ? '#242424' : '#f5f5f5');
    const fg = getCssColorAsHex('--text-default', isDark ? '#d4d4d4' : '#1e1e1e');
    const cursor = getCssColorAsHex('--accent', isDark ? '#569cd6' : '#0078d4');
    const rootStyle: Record<string, string> = { backgroundColor: bg, color: fg, height: fillHeight ? '100%' : 'auto' };
    if (!fillHeight) rootStyle.minHeight = minHeight;

    return EditorView.theme({
      '&': rootStyle,
      '.cm-scroller': {
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--font-body-size)',
        lineHeight: 'var(--font-body-line-height)',
        letterSpacing: 'var(--font-body-letter-spacing)',
        overflow: fillHeight ? 'auto' : 'visible',
      },
      '.cm-content': {
        maxWidth: contentMaxWidth,
        margin: '0 auto',
        padding: contentPadding,
        caretColor: cursor,
      },
      '.cm-gutters': { display: 'none' },
      '.cm-cursor': {
        borderLeftColor: `${cursor} !important`,
        borderLeftWidth: '2px !important',
      },
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '&.cm-focused': { outline: 'none' },
      '&.cm-focused .cm-selectionBackground, & .cm-selectionBackground, & .cm-content ::selection': {
        backgroundColor: 'color-mix(in srgb, var(--accent) 32%, transparent)',
      },
    });
  }, [contentMaxWidth, contentPadding, fillHeight, isDark, minHeight, themeRevision]);

  const handleChange = useCallback((value: string) => {
    if (readOnly) return;
    const startedAt = performance.now();
    onInputActivity?.();
    lastLocalChangeRef.current = value;
    if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
    emitTimerRef.current = setTimeout(() => {
      emitTimerRef.current = null;
      setEditorValue(value);
      onChange(value);
    }, 120);
    const duration = performance.now() - startedAt;
    if (duration > 12) {
      console.debug('[NetiorPerf] MarkdownEditor.onChange', {
        tabId,
        durationMs: Math.round(duration * 10) / 10,
        length: value.length,
      });
    }
  }, [onChange, onInputActivity, readOnly, tabId]);

  useEffect(() => {
    if (content === lastExternalContentRef.current) return;
    lastExternalContentRef.current = content;
    if (content === lastLocalChangeRef.current) return;
    setEditorValue(content);
    lastLocalChangeRef.current = content;
  }, [content]);

  useEffect(() => () => {
    if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
    if (cursorSaveTimerRef.current) clearTimeout(cursorSaveTimerRef.current);
    const latest = lastLocalChangeRef.current;
    if (!readOnly && latest !== lastExternalContentRef.current) onChange(latest);
  }, [onChange, readOnly]);

  const lastInsertRequestIdRef = useRef<number | null>(null);
  const lastRefreshKeyRef = useRef<unknown>(undefined);

  useEffect(() => {
    if (refreshKey === undefined || Object.is(lastRefreshKeyRef.current, refreshKey)) return;
    lastRefreshKeyRef.current = refreshKey;
    if (perfDiagnosticsEnabled()) {
      emitPerfDiagnostic('MarkdownEditor.refreshKeyDispatch', {
        tabId,
        contentLength: content.length,
      });
    }
    cmRef.current?.view?.dispatch({});
  }, [refreshKey]);

  useEffect(() => {
    if (!insertTextRequest || lastInsertRequestIdRef.current === insertTextRequest.id) return;
    const view = cmRef.current?.view;
    if (!view) return;

    lastInsertRequestIdRef.current = insertTextRequest.id;
    const selection = view.state.selection.main;
    const replaceFrom = insertTextRequest.replaceFrom ?? selection.from;
    const replaceTo = insertTextRequest.replaceTo ?? selection.to;
    const isReplacement = insertTextRequest.replaceFrom !== undefined && insertTextRequest.replaceTo !== undefined;
    const before = view.state.sliceDoc(Math.max(0, replaceFrom - 2), replaceFrom);
    const after = view.state.sliceDoc(replaceTo, Math.min(view.state.doc.length, replaceTo + 2));
    const prefix = !isReplacement && insertTextRequest.block && before.trim().length > 0 ? '\n\n' : '';
    const suffix = insertTextRequest.block && (
      !isReplacement || replaceTo >= view.state.doc.length
    ) && !insertTextRequest.text.endsWith('\n')
      ? '\n\n'
      : !isReplacement && insertTextRequest.block && after.trim().length > 0
        ? '\n\n'
        : '';
    const insert = `${prefix}${insertTextRequest.text}${suffix}`;
    view.dispatch({
      changes: { from: replaceFrom, to: replaceTo, insert },
      selection: { anchor: replaceFrom + insert.length },
    });
    view.focus();
  }, [insertTextRequest]);

  const handleNavigate = useCallback((lineNumber: number) => {
    const view = cmRef.current?.view;
    const scroller = scrollRef.current;
    if (!view || !scroller) return;

    const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines));
    const block = view.lineBlockAt(line.from);

    const cmEl = view.dom;
    const cmTop = cmEl.offsetTop;
    const target = Math.max(0, cmTop + block.top - 50);

    const start = scroller.scrollTop;
    const distance = target - start;
    if (Math.abs(distance) < 5) return;
    const duration = Math.min(600, Math.max(200, Math.abs(distance) * 0.4));
    let startTime: number | null = null;

    function step(ts: number) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - (-2 * progress + 2) ** 2 / 2;
      scroller!.scrollTop = start + distance * ease;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  const handleEditorSurfaceMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || event.button !== 0 || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('.cm-line')) return;
    const view = cmRef.current?.view;
    if (!view || !target.closest('.cm-editor')) return;

    window.requestAnimationFrame(() => {
      const docText = view.state.doc.toString();
      if (needsTrailingEditableLine?.(docText)) {
        const end = view.state.doc.length;
        view.dispatch({
          changes: { from: end, insert: '\n' },
          selection: { anchor: end + 1 },
        });
        view.focus();
        return;
      }
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length;
      view.dispatch({ selection: { anchor: pos } });
      view.focus();
    });
  }, [needsTrailingEditableLine, readOnly]);

  return (
    <div ref={containerRef} className={fillHeight ? 'relative flex h-full' : 'relative flex'} style={fillHeight ? undefined : { minHeight }}>
      {showToc && headings.length > 0 && (
        <MarkdownToc
          headings={headings}
          currentLine={currentLine}
          onNavigate={handleNavigate}
          pinned={viewState.tocPinned}
          onPinChange={(pinned) => setViewState((prev) => ({ ...prev, tocPinned: pinned }))}
        />
      )}

      <div
        ref={scrollRef}
        className={fillHeight ? 'flex-1 overflow-auto' : 'min-w-0 flex-1 overflow-visible'}
        onMouseDown={handleEditorSurfaceMouseDown}
      >
        <CodeMirror
          ref={cmRef}
          value={editorValue}
          extensions={extensions}
          theme={theme}
          onChange={handleChange}
          height={fillHeight ? '100%' : 'auto'}
          onKeyDown={(event) => {
            if (readOnly) return;
            lastInputStartedAtRef.current = performance.now();
            lastInputKindRef.current = `key:${event.key}`;
          }}
          onBeforeInput={(event) => {
            if (readOnly) return;
            lastInputStartedAtRef.current = performance.now();
            lastInputKindRef.current = `beforeinput:${event.nativeEvent.inputType}`;
          }}
          basicSetup={false}
        />
      </div>
    </div>
  );
}
