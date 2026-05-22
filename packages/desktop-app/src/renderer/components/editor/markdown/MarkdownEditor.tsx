import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, keymap, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM } from '@lezer/markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { createLivePreviewPlugin, livePreviewTheme } from './live-preview';
import { MarkdownToc, extractHeadings } from './MarkdownToc';
import { useI18n } from '../../../hooks/useI18n';
import { useViewState } from '../../../hooks/useViewState';
import { getCssColorAsHex } from '../editor-utils';
import { useSettingsStore } from '../../../stores/settings-store';
import { useEditorStore, MAIN_HOST_ID } from '../../../stores/editor-store';
import { openMarkdownLink } from '../../../lib/markdown-link';

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
  insertTextRequest?: { id: number; text: string; block?: boolean } | null;
  contentMaxWidth?: string;
  contentPadding?: string;
  fillHeight?: boolean;
  refreshKey?: unknown;
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
  refreshKey,
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
    cursorPlugin,
    perfPlugin,
    ...createLivePreviewPlugin(handleLinkClick),
    livePreviewTheme,
    ...extraExtensions,
    syntaxHighlighting(codeHighlightStyle),
    EditorView.lineWrapping,
  ], [cursorPlugin, extraExtensions, handleLinkClick, perfPlugin]);

  const theme = useMemo(() => {
    const bg = getCssColorAsHex('--surface-editor', isDark ? '#242424' : '#f5f5f5');
    const fg = getCssColorAsHex('--text-default', isDark ? '#d4d4d4' : '#1e1e1e');
    const cursor = getCssColorAsHex('--accent', isDark ? '#569cd6' : '#0078d4');
    const rootStyle: Record<string, string> = { backgroundColor: bg, color: fg, height: fillHeight ? '100%' : 'auto' };
    if (!fillHeight) rootStyle.minHeight = '360px';

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
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: isDark ? 'rgba(86, 156, 214, 0.3)' : 'rgba(0, 120, 212, 0.2)',
      },
    });
  }, [contentMaxWidth, contentPadding, fillHeight, isDark, themeRevision]);

  const handleChange = useCallback((value: string) => {
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
  }, [onChange, onInputActivity, tabId]);

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
    if (latest !== lastExternalContentRef.current) onChange(latest);
  }, [onChange]);

  const lastInsertRequestIdRef = useRef<number | null>(null);
  const lastRefreshKeyRef = useRef<unknown>(undefined);

  useEffect(() => {
    if (refreshKey === undefined || Object.is(lastRefreshKeyRef.current, refreshKey)) return;
    lastRefreshKeyRef.current = refreshKey;
    cmRef.current?.view?.dispatch({});
  }, [refreshKey]);

  useEffect(() => {
    if (!insertTextRequest || lastInsertRequestIdRef.current === insertTextRequest.id) return;
    const view = cmRef.current?.view;
    if (!view) return;

    lastInsertRequestIdRef.current = insertTextRequest.id;
    const selection = view.state.selection.main;
    const before = view.state.sliceDoc(Math.max(0, selection.from - 2), selection.from);
    const after = view.state.sliceDoc(selection.to, Math.min(view.state.doc.length, selection.to + 2));
    const prefix = insertTextRequest.block && before.trim().length > 0 ? '\n\n' : '';
    const suffix = insertTextRequest.block && after.trim().length > 0 ? '\n\n' : '';
    const insert = `${prefix}${insertTextRequest.text}${suffix}`;
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: { anchor: selection.from + insert.length },
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

  return (
    <div ref={containerRef} className={fillHeight ? 'relative flex h-full' : 'relative flex min-h-[360px]'}>
      {headings.length > 0 && (
        <MarkdownToc
          headings={headings}
          currentLine={currentLine}
          onNavigate={handleNavigate}
          pinned={viewState.tocPinned}
          onPinChange={(pinned) => setViewState((prev) => ({ ...prev, tocPinned: pinned }))}
        />
      )}

      <div ref={scrollRef} className={fillHeight ? 'flex-1 overflow-auto' : 'min-w-0 flex-1 overflow-visible'}>
        <CodeMirror
          ref={cmRef}
          value={editorValue}
          extensions={extensions}
          theme={theme}
          onChange={handleChange}
          height={fillHeight ? '100%' : 'auto'}
          onKeyDown={(event) => {
            lastInputStartedAtRef.current = performance.now();
            lastInputKindRef.current = `key:${event.key}`;
          }}
          onBeforeInput={(event) => {
            lastInputStartedAtRef.current = performance.now();
            lastInputKindRef.current = `beforeinput:${event.nativeEvent.inputType}`;
          }}
          basicSetup={false}
        />
      </div>
    </div>
  );
}
