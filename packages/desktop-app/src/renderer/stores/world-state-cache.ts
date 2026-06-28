import { useDomainStore } from './domain-store';
import { useEditorStore } from './editor-store';
import { useFileStore, type OpenFile, type ClipboardState, type FileTreeNode } from './file-store';
import type { EditorTab, SplitNode } from '../types/editor';

interface EditorSnapshot {
  tabs: EditorTab[];
  activeTabId: string | null;
  sideLayout: SplitNode | null;
  fullLayout: SplitNode | null;
  sideLastActiveTabId: string | null;
  fullLastActiveTabId: string | null;
  hosts: Record<string, { id: string; label: string; activeTabId: string | null }>;
  focusedHostId: string;
}

interface FileSnapshot {
  fileTree: FileTreeNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  clipboard: ClipboardState | null;
  rootDirs: string[];
}

interface DomainSnapshotCache {
  activeModelId: string | null;
  activeViewType: 'explorer' | 'canvas';
}

interface WorkspaceSnapshot {
  editor: EditorSnapshot;
  file: FileSnapshot;
  domain: DomainSnapshotCache;
}

const APP_WORKSPACE_CACHE_KEY = '__app__';
const cache = new Map<string, WorkspaceSnapshot>();

function containsTab(node: SplitNode | null, tabId: string): boolean {
  if (!node) return false;
  if (node.type === 'leaf') return node.tabIds.includes(tabId);
  return containsTab(node.children[0], tabId) || containsTab(node.children[1], tabId);
}

function setActiveInLeaf(node: SplitNode, tabId: string): SplitNode {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(tabId)) return node;
    return node.activeTabId === tabId ? node : { ...node, activeTabId: tabId };
  }

  const newLeft = setActiveInLeaf(node.children[0], tabId);
  const newRight = setActiveInLeaf(node.children[1], tabId);
  if (newLeft === node.children[0] && newRight === node.children[1]) return node;
  return { ...node, children: [newLeft, newRight] };
}

function normalizeEditorSnapshot(editor: EditorSnapshot): EditorSnapshot {
  return {
    ...editor,
    sideLastActiveTabId: editor.sideLastActiveTabId ?? null,
    fullLastActiveTabId: editor.fullLastActiveTabId ?? null,
    hosts: editor.hosts ?? {},
    focusedHostId: editor.focusedHostId ?? 'main',
  };
}

function capture(): WorkspaceSnapshot {
  const editor = useEditorStore.getState();
  const file = useFileStore.getState();
  const domain = useDomainStore.getState();

  return {
    editor: {
      tabs: editor.tabs,
      activeTabId: editor.activeTabId,
      sideLayout: editor.sideLayout,
      fullLayout: editor.fullLayout,
      sideLastActiveTabId: editor.sideLastActiveTabId,
      fullLastActiveTabId: editor.fullLastActiveTabId,
      hosts: editor.hosts,
      focusedHostId: editor.focusedHostId,
    },
    file: {
      fileTree: file.fileTree,
      openFiles: file.openFiles,
      activeFilePath: file.activeFilePath,
      clipboard: file.clipboard,
      rootDirs: file.rootDirs,
    },
    domain: {
      activeModelId: domain.activeModelId,
      activeViewType: domain.activeViewType,
    },
  };
}

function restore(snapshot: WorkspaceSnapshot): void {
  useEditorStore.setState({ ...normalizeEditorSnapshot(snapshot.editor), pendingCloseTabId: null });
  useFileStore.setState(snapshot.file);
  useDomainStore.setState(snapshot.domain);
}

export function clearAllWorldStores(): void {
  useEditorStore.getState().clear();
  useFileStore.getState().clear();
  useDomainStore.getState().clear();
}

export function saveWorkspaceState(workspaceKey: string): void {
  cache.set(workspaceKey, capture());
}

export function restoreWorkspaceState(workspaceKey: string): boolean {
  const snapshot = cache.get(workspaceKey);
  if (!snapshot) return false;
  restore(snapshot);
  return true;
}

export function deleteWorkspaceState(workspaceKey: string): void {
  cache.delete(workspaceKey);
}

export function hasCachedState(workspaceKey: string): boolean {
  return cache.has(workspaceKey);
}

export interface CachedEditorTabRef {
  rootNetworkId: string;
  tab: EditorTab;
}

export function findCachedWorldEditorTab(tabId: string): CachedEditorTabRef | null {
  for (const [workspaceKey, snapshot] of cache.entries()) {
    if (workspaceKey === APP_WORKSPACE_CACHE_KEY) continue;
    const tab = snapshot.editor.tabs.find((entry) => entry.id === tabId);
    if (tab) {
      return { rootNetworkId: tab.rootNetworkId ?? workspaceKey, tab };
    }
  }

  return null;
}

export function updateCachedWorldEditorTab(
  tabId: string,
  updater: (tab: EditorTab) => EditorTab,
): void {
  for (const [workspaceKey, snapshot] of cache.entries()) {
    if (workspaceKey === APP_WORKSPACE_CACHE_KEY) continue;
    const nextTabs = snapshot.editor.tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
    if (!nextTabs.some((tab, index) => tab !== snapshot.editor.tabs[index])) {
      continue;
    }

    cache.set(workspaceKey, {
      ...snapshot,
      editor: {
        ...normalizeEditorSnapshot(snapshot.editor),
        tabs: nextTabs,
      },
    });
  }
}

export function focusCachedWorldEditorTab(rootNetworkId: string, tabId: string): void {
  const snapshot = cache.get(rootNetworkId);
  if (!snapshot) return;

  const editor = normalizeEditorSnapshot(snapshot.editor);
  const tab = editor.tabs.find((entry) => entry.id === tabId);
  if (!tab) return;

  const sideLayout = containsTab(editor.sideLayout, tabId)
    ? setActiveInLeaf(editor.sideLayout!, tabId)
    : editor.sideLayout;
  const fullLayout = containsTab(editor.fullLayout, tabId)
    ? setActiveInLeaf(editor.fullLayout!, tabId)
    : editor.fullLayout;
  const hosts = tab.hostId !== 'main' && editor.hosts[tab.hostId]
    ? {
        ...editor.hosts,
        [tab.hostId]: { ...editor.hosts[tab.hostId], activeTabId: tabId },
      }
    : editor.hosts;

  cache.set(rootNetworkId, {
    ...snapshot,
    editor: {
      ...editor,
      activeTabId: tab.hostId === 'main' ? tabId : editor.activeTabId,
      sideLayout,
      fullLayout,
      sideLastActiveTabId: containsTab(sideLayout, tabId) ? tabId : editor.sideLastActiveTabId,
      fullLastActiveTabId: containsTab(fullLayout, tabId) ? tabId : editor.fullLastActiveTabId,
      hosts,
      focusedHostId: tab.hostId,
    },
  });
}

export function saveWorldState(rootNetworkId: string): void {
  saveWorkspaceState(rootNetworkId);
}

export function restoreWorldState(rootNetworkId: string): boolean {
  return restoreWorkspaceState(rootNetworkId);
}

export function deleteWorldState(rootNetworkId: string): void {
  deleteWorkspaceState(rootNetworkId);
}

export function saveAppState(): void {
  saveWorkspaceState(APP_WORKSPACE_CACHE_KEY);
}

export function restoreAppState(): boolean {
  return restoreWorkspaceState(APP_WORKSPACE_CACHE_KEY);
}

export function deleteAppState(): void {
  deleteWorkspaceState(APP_WORKSPACE_CACHE_KEY);
}

export function hasCachedAppState(): boolean {
  return hasCachedState(APP_WORKSPACE_CACHE_KEY);
}
