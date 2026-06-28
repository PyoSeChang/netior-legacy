import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorTab } from '../../types/editor';
import { AlertTriangle, ArrowLeft, ArrowRight, Bookmark, Copy, Download, ExternalLink, Globe, Lock, MoreVertical, RefreshCw, RotateCcw, Star, Trash2, X } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useEditorStore } from '../../stores/editor-store';
import { useSettingsStore } from '../../stores/settings-store';
import { getBrowserTabTitle, getDefaultFaviconUrl, normalizeBrowserUrl, openBrowserTab } from '../../lib/open-browser-tab';
import {
  findBrowserBookmark,
  loadBrowserBookmarks,
  removeBrowserBookmark,
  type BrowserBookmark,
  upsertBrowserBookmark,
} from '../../lib/browser-bookmarks';

type BrowserWebView = HTMLElement & {
  src: string;
  canGoBack?: () => boolean;
  canGoForward?: () => boolean;
  goBack?: () => void;
  goForward?: () => void;
  reload?: () => void;
  stop?: () => void;
  loadURL?: (url: string) => void;
  getURL?: () => string;
};

interface BrowserDownloadEvent {
  id: string;
  state: 'started' | 'progress' | 'completed' | 'cancelled' | 'interrupted';
  filename: string;
  savePath: string;
  receivedBytes: number;
  totalBytes: number;
  url: string;
}

interface BrowserPermissionRequest {
  id: string;
  origin: string;
  permission: string;
  requestingUrl: string;
}

interface BrowserEditorProps {
  tab: EditorTab;
}

interface MenuPosition {
  x: number;
  y: number;
}

function getSecurityState(url: string): 'secure' | 'insecure' | 'unknown' {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return 'secure';
    if (parsed.protocol === 'http:') return 'insecure';
  } catch { /* unknown */ }
  return 'unknown';
}

function getDownloadLabel(event: BrowserDownloadEvent): string {
  if (event.state === 'completed') return 'Download complete';
  if (event.state === 'cancelled') return 'Download cancelled';
  if (event.state === 'interrupted') return 'Download interrupted';
  return 'Downloading';
}

function getDownloadProgress(event: BrowserDownloadEvent): number | null {
  if (event.totalBytes <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((event.receivedBytes / event.totalBytes) * 100)));
}

function getPermissionLabel(permission: string): string {
  const labels: Record<string, string> = {
    media: 'camera or microphone',
    geolocation: 'your location',
    notifications: 'notifications',
    midi: 'MIDI devices',
    pointerLock: 'pointer lock',
    fullscreen: 'fullscreen',
    openExternal: 'external apps',
    sensors: 'device sensors',
  };
  return labels[permission] ?? permission;
}

function getBestFaviconUrl(favicons: string[]): string | null {
  for (const favicon of favicons) {
    const trimmed = favicon.trim();
    if (/^(https?:|data:image\/)/i.test(trimmed)) return trimmed;
  }
  return null;
}

function BrowserMenuFavicon({ faviconUrl }: { faviconUrl?: string | null }): JSX.Element {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [faviconUrl]);

  if (faviconUrl && !failed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        width={14}
        height={14}
        draggable={false}
        className="block h-3.5 w-3.5 object-contain"
        onError={() => setFailed(true)}
      />
    );
  }

  return <Bookmark size={14} />;
}

export function BrowserEditor({ tab }: BrowserEditorProps): JSX.Element {
  const webviewRef = useRef<BrowserWebView | null>(null);
  const webviewReadyRef = useRef(false);
  const restoredUrl = tab.browserUrl ?? tab.targetId;
  const initialUrlRef = useRef(restoredUrl);
  const bookmarkButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const [address, setAddress] = useState(restoredUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadEvent, setDownloadEvent] = useState<BrowserDownloadEvent | null>(null);
  const [isClearingData, setIsClearingData] = useState(false);
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>(() => loadBrowserBookmarks());
  const [bookmarkMenuPosition, setBookmarkMenuPosition] = useState<MenuPosition | null>(null);
  const [moreMenuPosition, setMoreMenuPosition] = useState<MenuPosition | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<BrowserPermissionRequest | null>(null);
  const navigateTab = useEditorStore((s) => s.navigateTab);
  const updateTitle = useEditorStore((s) => s.updateTitle);
  const updateBrowserFavicon = useEditorStore((s) => s.updateBrowserFavicon);
  const updateBrowserUrl = useEditorStore((s) => s.updateBrowserUrl);
  const browserSettings = useSettingsStore((s) => s.browser);
  const securityState = getSecurityState(address);
  const downloadProgress = downloadEvent ? getDownloadProgress(downloadEvent) : null;
  const normalizedAddress = normalizeBrowserUrl(address);
  const currentBookmark = normalizedAddress ? findBrowserBookmark(normalizedAddress, bookmarks) : undefined;

  useEffect(() => {
    const nextUrl = tab.browserUrl ?? tab.targetId;
    setAddress(nextUrl);
    const webview = webviewRef.current;
    if (!webview) return;
    try {
      if (webviewReadyRef.current && webview.getURL?.() === nextUrl) return;
      if (webviewReadyRef.current && webview.loadURL) {
        webview.loadURL(nextUrl);
      } else {
        webview.src = nextUrl;
      }
    } catch {
      webview.src = nextUrl;
    }
  }, [tab.browserUrl, tab.targetId]);

  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    const removeListener = window.electron.browser.onDownloadEvent((event) => {
      setDownloadEvent(event);
      if (clearTimer) clearTimeout(clearTimer);
      if (event.state === 'completed' || event.state === 'cancelled' || event.state === 'interrupted') {
        clearTimer = setTimeout(() => setDownloadEvent(null), 6000);
      }
    });
    return () => {
      if (clearTimer) clearTimeout(clearTimer);
      removeListener();
    };
  }, []);

  useEffect(() => {
    return window.electron.browser.onPermissionRequest((request) => {
      setPermissionRequest((current) => {
        if (current) {
          window.electron.browser.respondPermission(request.id, false);
          return current;
        }
        return request;
      });
    });
  }, []);

  const updateNavigationState = useCallback(() => {
    const webview = webviewRef.current;
    if (!webview || !webviewReadyRef.current) return;
    try {
      setCanGoBack(webview.canGoBack?.() ?? false);
      setCanGoForward(webview.canGoForward?.() ?? false);
    } catch {
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }, []);

  const commitUrl = useCallback((nextUrl: string) => {
    const normalized = normalizeBrowserUrl(nextUrl);
    if (!normalized) return;
    setAddress(normalized);
    setLoadError(null);
    const webview = webviewRef.current;
    if (webviewReadyRef.current && webview?.loadURL) {
      try {
        webview.loadURL(normalized);
      } catch {
        webview.src = normalized;
      }
    } else if (webview) {
      webview.src = normalized;
    }
    navigateTab(tab.id, {
      type: 'browser',
      targetId: normalized,
      title: getBrowserTabTitle(normalized),
      rootNetworkId: tab.rootNetworkId,
      browserFaviconUrl: getDefaultFaviconUrl(normalized),
      browserUrl: normalized,
    });
  }, [navigateTab, tab.id, tab.rootNetworkId]);

  const runWhenReady = useCallback((action: (webview: BrowserWebView) => void) => {
    const webview = webviewRef.current;
    if (!webview || !webviewReadyRef.current) return;
    try {
      action(webview);
    } catch {
      updateNavigationState();
    }
  }, [updateNavigationState]);

  const clearBrowserData = useCallback(async () => {
    if (!window.confirm('Clear cookies, cache, and site data for the embedded browser?')) return;
    setIsClearingData(true);
    try {
      await window.electron.browser.clearData();
      runWhenReady((webview) => webview.reload?.());
    } finally {
      setIsClearingData(false);
    }
  }, [runWhenReady]);

  const getMenuPosition = useCallback((button: HTMLButtonElement | null): MenuPosition => {
    const rect = button?.getBoundingClientRect();
    if (!rect) return { x: 8, y: 44 };
    return { x: rect.left, y: rect.bottom + 4 };
  }, []);

  const toggleCurrentBookmark = useCallback(() => {
    const normalized = normalizeBrowserUrl(address);
    if (!normalized) return;

    const existing = findBrowserBookmark(normalized, bookmarks);
    if (existing) {
      setBookmarks(removeBrowserBookmark(normalized));
      return;
    }

    setBookmarks(upsertBrowserBookmark({
      url: normalized,
      title: tab.title || getBrowserTabTitle(normalized),
      faviconUrl: tab.browserFaviconUrl ?? getDefaultFaviconUrl(address) ?? getDefaultFaviconUrl(normalized),
      createdAt: Date.now(),
    }));
  }, [address, bookmarks, tab.browserFaviconUrl, tab.title]);

  const openBookmark = useCallback((url: string) => {
    setBookmarkMenuPosition(null);
    setMoreMenuPosition(null);
    commitUrl(url);
  }, [commitUrl]);

  const createBookmarkItems = useCallback((): ContextMenuEntry[] => {
    const normalized = normalizeBrowserUrl(address);
    const isSaved = Boolean(normalized && findBrowserBookmark(normalized, bookmarks));
    const items: ContextMenuEntry[] = [
      {
        label: isSaved ? 'Remove bookmark' : 'Bookmark this page',
        icon: <Star size={14} fill={isSaved ? 'currentColor' : 'none'} />,
        disabled: !normalized,
        onClick: toggleCurrentBookmark,
      },
    ];

    if (bookmarks.length === 0) {
      items.push({ type: 'divider' });
      items.push({
        label: 'No bookmarks yet',
        icon: <Bookmark size={14} />,
        disabled: true,
        onClick: () => {},
      });
      return items;
    }

    items.push({ type: 'divider' });
    for (const bookmark of bookmarks.slice(0, 12)) {
      items.push({
        label: bookmark.title || getBrowserTabTitle(bookmark.url),
        icon: <BrowserMenuFavicon faviconUrl={bookmark.faviconUrl ?? getDefaultFaviconUrl(bookmark.url)} />,
        onClick: () => openBookmark(bookmark.url),
      });
    }
    return items;
  }, [address, bookmarks, openBookmark, toggleCurrentBookmark]);

  const createMoreItems = useCallback((): ContextMenuEntry[] => [
    {
      label: currentBookmark ? 'Remove bookmark' : 'Bookmark this page',
      icon: <Star size={14} fill={currentBookmark ? 'currentColor' : 'none'} />,
      disabled: !normalizedAddress,
      onClick: toggleCurrentBookmark,
    },
    { type: 'divider' },
    {
      label: 'Open externally',
      icon: <ExternalLink size={14} />,
      onClick: () => window.electron.shell.openExternal(address),
    },
    {
      label: 'Clear browser data',
      icon: <Trash2 size={14} />,
      disabled: isClearingData,
      onClick: () => void clearBrowserData(),
    },
  ], [address, clearBrowserData, currentBookmark, isClearingData, normalizedAddress, toggleCurrentBookmark]);

  const resolvePermissionRequest = useCallback((allowed: boolean) => {
    if (!permissionRequest) return;
    window.electron.browser.respondPermission(permissionRequest.id, allowed);
    setPermissionRequest(null);
  }, [permissionRequest]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleStart = () => {
      setLoadError(null);
      setIsLoading(true);
    };
    const handleStop = () => {
      setIsLoading(false);
      updateNavigationState();
    };
    const handleNavigate = (event: Event) => {
      const nextUrl = (event as Event & { url?: string }).url;
      if (!nextUrl) {
        updateNavigationState();
        return;
      }
      setAddress(nextUrl);
      updateBrowserUrl(tab.id, nextUrl);
      updateNavigationState();
    };
    const handleTitle = (event: Event) => {
      const title = (event as Event & { title?: string }).title?.trim();
      if (title) updateTitle(tab.id, title);
    };
    const handleFavicon = (event: Event) => {
      const favicons = (event as Event & { favicons?: string[] }).favicons ?? [];
      const faviconUrl = getBestFaviconUrl(favicons);
      if (faviconUrl) updateBrowserFavicon(tab.id, faviconUrl);
    };
    const handleFailLoad = (event: Event) => {
      const details = event as Event & { errorCode?: number; errorDescription?: string; validatedURL?: string };
      if (details.errorCode === -3) return;
      setLoadError(details.errorDescription || 'Failed to load this page.');
      setIsLoading(false);
      updateNavigationState();
    };
    const handleNewWindow = (event: Event) => {
      event.preventDefault();
      const nextUrl = (event as Event & { url?: string }).url;
      if (!nextUrl) return;
      if (browserSettings.openPopupsInTabs) {
        void openBrowserTab(nextUrl);
      } else {
        void window.electron.shell.openExternal(nextUrl);
      }
    };
    const handleDomReady = () => {
      webviewReadyRef.current = true;
      setLoadError(null);
      updateNavigationState();
    };

    if (typeof webview.canGoBack !== 'function') {
      setLoadError('Embedded browser is not enabled in this window. Fully restart Netior and open the URL again.');
      return;
    }

    webview.addEventListener('did-start-loading', handleStart);
    webview.addEventListener('did-stop-loading', handleStop);
    webview.addEventListener('did-fail-load', handleFailLoad);
    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);
    webview.addEventListener('page-title-updated', handleTitle);
    webview.addEventListener('page-favicon-updated', handleFavicon);
    webview.addEventListener('new-window', handleNewWindow);
    webview.addEventListener('dom-ready', handleDomReady);

    return () => {
      webviewReadyRef.current = false;
      webview.removeEventListener('did-start-loading', handleStart);
      webview.removeEventListener('did-stop-loading', handleStop);
      webview.removeEventListener('did-fail-load', handleFailLoad);
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
      webview.removeEventListener('page-title-updated', handleTitle);
      webview.removeEventListener('page-favicon-updated', handleFavicon);
      webview.removeEventListener('new-window', handleNewWindow);
      webview.removeEventListener('dom-ready', handleDomReady);
    };
  }, [browserSettings.openPopupsInTabs, tab.id, updateBrowserFavicon, updateBrowserUrl, updateNavigationState, updateTitle]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-surface-editor text-default">
      <div className="relative z-20 flex h-11 shrink-0 items-center gap-1 border-b border-subtle bg-surface-panel px-2">
        <IconButton label="Back" disabled={!canGoBack} onClick={() => runWhenReady((webview) => webview.goBack?.())}>
          <ArrowLeft size={16} />
        </IconButton>
        <IconButton label="Forward" disabled={!canGoForward} onClick={() => runWhenReady((webview) => webview.goForward?.())}>
          <ArrowRight size={16} />
        </IconButton>
        <IconButton label={isLoading ? 'Stop' : 'Reload'} onClick={() => {
          runWhenReady((webview) => {
            if (isLoading) webview.stop?.();
            else webview.reload?.();
          });
        }}>
          {isLoading ? <X size={16} /> : <RefreshCw size={16} />}
        </IconButton>
        <IconButton
          ref={bookmarkButtonRef}
          label="Bookmarks"
          onClick={() => {
            setMoreMenuPosition(null);
            setBookmarkMenuPosition(getMenuPosition(bookmarkButtonRef.current));
          }}
        >
          <Bookmark size={16} />
        </IconButton>
        <form
          className="min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            commitUrl(address);
          }}
        >
          <div className="relative">
            {securityState === 'secure' ? (
              <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            ) : securityState === 'insecure' ? (
              <AlertTriangle size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-status-warning" />
            ) : (
              <Globe size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            )}
            <Input
              className="h-8 pl-8 font-mono text-xs"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              spellCheck={false}
            />
          </div>
        </form>
        <IconButton
          ref={moreButtonRef}
          label="More"
          onClick={() => {
            setBookmarkMenuPosition(null);
            setMoreMenuPosition(getMenuPosition(moreButtonRef.current));
          }}
        >
          <MoreVertical size={16} />
        </IconButton>
        {isLoading && (
          <div className="absolute bottom-0 left-0 h-0.5 w-1/3 animate-pulse bg-accent" />
        )}
      </div>
      {bookmarkMenuPosition && (
        <ContextMenu
          x={bookmarkMenuPosition.x}
          y={bookmarkMenuPosition.y}
          items={createBookmarkItems()}
          onClose={() => setBookmarkMenuPosition(null)}
        />
      )}
      {moreMenuPosition && (
        <ContextMenu
          x={moreMenuPosition.x}
          y={moreMenuPosition.y}
          items={createMoreItems()}
          onClose={() => setMoreMenuPosition(null)}
        />
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-base">
        <webview
          ref={(element) => { webviewRef.current = element as BrowserWebView | null; }}
          className="block h-full w-full"
          style={{ display: 'flex', height: '100%', width: '100%' }}
          src={initialUrlRef.current}
          partition="persist:netior-browser"
        />
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-editor px-6 text-center">
            <div className="flex max-w-md flex-col items-center gap-4">
              <AlertTriangle size={28} className="text-status-warning" />
              <div>
                <div className="text-sm font-medium text-default">This page could not be loaded</div>
                <div className="mt-1 text-xs text-muted">{loadError}</div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => runWhenReady((webview) => webview.reload?.())}
                >
                  <RotateCcw size={14} />
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void navigator.clipboard.writeText(address)}
                >
                  <Copy size={14} />
                  Copy URL
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.electron.shell.openExternal(address)}
                >
                  <ExternalLink size={14} />
                  Open externally
                </Button>
              </div>
            </div>
          </div>
        )}
        {browserSettings.showDownloadToast && downloadEvent && (
          <div className="absolute bottom-3 right-3 w-80 max-w-[calc(100%-1.5rem)] rounded-md border border-default bg-surface-panel p-3 text-xs shadow-lg">
            <div className="flex items-start gap-3">
              <Download size={16} className="mt-0.5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-default">{getDownloadLabel(downloadEvent)}</span>
                  {downloadProgress !== null && <span className="text-muted">{downloadProgress}%</span>}
                </div>
                <div className="mt-1 truncate text-muted">{downloadEvent.filename}</div>
                {downloadProgress !== null && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-card">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                )}
                {downloadEvent.state === 'completed' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 px-0"
                    onClick={() => window.electron.browser.openDownload(downloadEvent.savePath)}
                  >
                    Show in folder
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(permissionRequest)}
        title="Browser permission"
        message={permissionRequest
          ? `${permissionRequest.origin} wants to use ${getPermissionLabel(permissionRequest.permission)}.`
          : ''}
        confirmLabel="Allow"
        cancelLabel="Block"
        variant="primary"
        onConfirm={() => resolvePermissionRequest(true)}
        onClose={() => resolvePermissionRequest(false)}
      />
    </div>
  );
}
