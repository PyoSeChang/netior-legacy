import React, { useEffect, useRef } from 'react';
import type { EditorTab } from '../../types/editor';
import { FileEditor } from './FileEditor';
import { TerminalEditor } from './TerminalEditor';
import { NarreEditor } from './NarreEditor';
import { AgentEditor } from './AgentEditor';
import { BrowserEditor } from './BrowserEditor';
import { ModelEditor } from './ModelEditor';
import { KindEditor } from './KindEditor';
import { RelationKindEditor } from './RelationKindEditor';
import { InstanceEditor } from './InstanceEditor';
import { PlaceholderEditor } from './PlaceholderEditor';
import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { focusHyperTerminalSurface } from '../../lib/terminal/hyper-fork/term-registry';

interface EditorContentProps {
  tab: EditorTab;
}

const DOMAIN_PLACEHOLDER_TYPES = new Set([
  'world',
  'property',
  'resource',
  'view',
]);

export function EditorContent({ tab }: EditorContentProps): JSX.Element {
  const isActive = useEditorStore((s) => {
    if (tab.hostId === MAIN_HOST_ID) return s.activeTabId === tab.id;
    const host = s.hosts[tab.hostId];
    return host?.activeTabId === tab.id;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    const el = containerRef.current;
    const timer = requestAnimationFrame(() => {
      if (!el || el.contains(document.activeElement)) return;
      if (tab.type === 'terminal') {
        focusHyperTerminalSurface(tab.targetId);
        return;
      }
      const cmContent = el.querySelector<HTMLElement>('.cm-content');
      if (cmContent) {
        cmContent.focus();
        return;
      }
      const focusable = el.querySelector<HTMLElement>('input, textarea, [contenteditable], [tabindex]');
      if (focusable) focusable.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [isActive, tab.targetId, tab.type]);

  let content: JSX.Element;
  if (tab.type === 'model') {
    content = <ModelEditor tab={tab} />;
  } else if (tab.type === 'kind') {
    content = <KindEditor tab={tab} />;
  } else if (tab.type === 'relationKind') {
    content = <RelationKindEditor tab={tab} />;
  } else if (tab.type === 'instance') {
    content = <InstanceEditor tab={tab} />;
  } else if (DOMAIN_PLACEHOLDER_TYPES.has(tab.type)) {
    content = <PlaceholderEditor tab={tab} label={tab.type} />;
  } else {
    switch (tab.type) {
      case 'file':
        content = <FileEditor tab={tab} />;
        break;
      case 'terminal':
        content = <TerminalEditor tab={tab} />;
        break;
      case 'narre':
        content = <NarreEditor tab={tab} />;
        break;
      case 'agent':
        content = <AgentEditor tab={tab} />;
        break;
      case 'browser':
        content = <BrowserEditor tab={tab} />;
        break;
      default:
        content = (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            Unknown editor type
          </div>
        );
    }
  }

  return <div ref={containerRef} className="h-full min-h-0 w-full min-w-0 bg-surface-editor">{content}</div>;
}
