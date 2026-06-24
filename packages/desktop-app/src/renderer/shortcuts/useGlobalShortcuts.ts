import { useEffect } from 'react';
import { useEditorStore, getActiveLeaf, collectLeaves, MAIN_HOST_ID } from '../stores/editor-store';
import { getSession } from '../lib/editor-session-registry';
import { useWorldStore } from '../stores/world-store';
import { useUIStore } from '../stores/ui-store';
import { useSettingsStore } from '../stores/settings-store';
import { jumpToNextUnacknowledgedAgent } from '../lib/terminal-agent-notifier';
import { openTerminalTab as openTerminalTabInHost } from '../lib/terminal/open-terminal-tab';
import { openBrowserTab as openBrowserTabInHost } from '../lib/open-browser-tab';
import { consumeShortcutEvent, isEditableTarget, isPrimaryModifier, logShortcut } from './shortcut-utils';

export function cycleTab(direction: 1 | -1): void {
  const result = getActiveLeaf();
  if (!result) return; // float/detached ??no-op

  const { leaf } = result;
  const { activeTabId, setActiveTab } = useEditorStore.getState();
  if (!activeTabId) return;

  const idx = leaf.tabIds.indexOf(activeTabId);
  if (idx < 0) return;
  const next = (idx + direction + leaf.tabIds.length) % leaf.tabIds.length;
  setActiveTab(leaf.tabIds[next]);
}

export function activateTabByNumber(indexKey: string): void {
  const result = getActiveLeaf();
  if (!result) return; // float/detached ??no-op

  const index = Number(indexKey);
  if (Number.isNaN(index) || index < 1 || index > 9) return;

  const { tabIds } = result.leaf;
  const target = index === 9 ? tabIds[tabIds.length - 1] : tabIds[index - 1];
  if (!target) return;

  useEditorStore.getState().setActiveTab(target);
}

export function cyclePane(direction: 1 | -1): void {
  const result = getActiveLeaf();
  if (!result) return;

  const layout = result.mode === 'side'
    ? useEditorStore.getState().sideLayout
    : useEditorStore.getState().fullLayout;
  if (!layout) return;

  const leaves = collectLeaves(layout);
  if (leaves.length <= 1) return;

  const { activeTabId } = useEditorStore.getState();
  const currentIdx = leaves.findIndex((l) => l.tabIds.includes(activeTabId!));
  if (currentIdx < 0) return;

  const nextIdx = (currentIdx + direction + leaves.length) % leaves.length;
  useEditorStore.getState().setActiveTab(leaves[nextIdx].activeTabId);
}

function openTerminalTab(): void {
  openTerminalTabInHost();
}

function openBrowserTab(): void {
  const { browser } = useSettingsStore.getState();
  const { focusedHostId } = useEditorStore.getState();
  void openBrowserTabInHost(browser.homeUrl, focusedHostId);
}

function toggleToc(): void {
  window.dispatchEvent(new CustomEvent('toc:toggle'));
}

function toggleEditorMode(): void {
  const { activeTabId, tabs, setViewMode } = useEditorStore.getState();
  if (!activeTabId) return;
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab || tab.hostId !== MAIN_HOST_ID) return;

  if (tab.viewMode === 'side') {
    setViewMode(activeTabId, 'full');
  } else if (tab.viewMode === 'full') {
    setViewMode(activeTabId, 'side');
  }
  // float/detached: no-op
}

function openNarreTab(): void {
  const rootNetworkId = useWorldStore.getState().currentWorld?.id;
  if (!rootNetworkId) return;

  void useEditorStore.getState().openTab({
    type: 'narre',
    targetId: rootNetworkId,
    title: 'Narre',
  });
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const handleAppShortcut = (shortcut: string): void => {
      if (shortcut === 'nextTab') {
        logShortcut('shortcut.global.nextTab');
        cycleTab(1);
        return;
      }

      if (shortcut === 'previousTab') {
        logShortcut('shortcut.global.previousTab');
        cycleTab(-1);
        return;
      }

      if (shortcut.startsWith('openTabByIndex:')) {
        const indexKey = shortcut.split(':')[1];
        if (!indexKey) return;
        logShortcut('shortcut.global.openTabByIndex');
        activateTabByNumber(indexKey);
        return;
      }

      if (shortcut === 'nextPane') {
        logShortcut('shortcut.global.nextPane');
        cyclePane(1);
        return;
      }

      if (shortcut === 'previousPane') {
        logShortcut('shortcut.global.previousPane');
        cyclePane(-1);
        return;
      }

      if (shortcut === 'jumpToLastAgent') {
        logShortcut('shortcut.global.jumpToLastAgent');
        jumpToNextUnacknowledgedAgent();
        return;
      }
    };

    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!isPrimaryModifier(event)) return;

      const editable = isEditableTarget(event.target);
      const key = event.key.toLowerCase();
      const isSlashKey = key === '/' || key === '?' || event.code === 'Slash';

      if (key === 's') {
        consumeShortcutEvent(event);
        const tabId = useEditorStore.getState().activeTabId;
        if (!tabId) return;
        logShortcut('shortcut.global.saveActiveTab');
        void getSession(tabId)?.save();
        return;
      }

      if (key === 'w') {
        consumeShortcutEvent(event);
        const tabId = useEditorStore.getState().activeTabId;
        if (!tabId) return;
        logShortcut('shortcut.global.closeActiveTab');
        useEditorStore.getState().requestCloseTab(tabId);
        return;
      }

      if (key === ',') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.openSettings');
        useUIStore.getState().setShowSettings(true);
        return;
      }

      if (isSlashKey) {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.openShortcutOverlay');
        useUIStore.getState().setShowShortcutOverlay(true);
        return;
      }

      if (!event.shiftKey && !event.altKey && key === 'b') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.toggleSidebar');
        useUIStore.getState().toggleSidebar();
        return;
      }

      if (event.shiftKey && !event.altKey && key === 'b') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.openBrowser');
        openBrowserTab();
        return;
      }

      if (event.shiftKey && !event.altKey && key === 'n') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.openTerminal');
        openTerminalTab();
        return;
      }

      if (!event.shiftKey && !event.altKey && key === '.') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.jumpToLastAgent');
        jumpToNextUnacknowledgedAgent();
        return;
      }

      if (event.altKey && !event.shiftKey && key === 'n') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.openNarre');
        openNarreTab();
        return;
      }

      if (event.shiftKey && !event.altKey && key === 'o') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.toggleToc');
        toggleToc();
        return;
      }

      if (!event.shiftKey && !event.altKey && key === '\\') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.toggleEditorMode');
        toggleEditorMode();
        return;
      }

      if (editable) return;

      if (event.altKey && !event.shiftKey && key === 'arrowright') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.nextPane');
        cyclePane(1);
        return;
      }

      if (event.altKey && !event.shiftKey && key === 'arrowleft') {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.previousPane');
        cyclePane(-1);
        return;
      }

      if (key === 'tab') {
        consumeShortcutEvent(event);
        logShortcut(event.shiftKey ? 'shortcut.global.previousTab' : 'shortcut.global.nextTab');
        cycleTab(event.shiftKey ? -1 : 1);
        return;
      }

      if (!event.shiftKey && !event.altKey && /^[1-9]$/.test(key)) {
        consumeShortcutEvent(event);
        logShortcut('shortcut.global.openTabByIndex');
        activateTabByNumber(key);
      }
    };

    window.addEventListener('keydown', handler, true);
    const cleanupAppShortcut = window.electron.window.onAppShortcut(handleAppShortcut);
    return () => {
      window.removeEventListener('keydown', handler, true);
      cleanupAppShortcut();
    };
  }, []);
}
