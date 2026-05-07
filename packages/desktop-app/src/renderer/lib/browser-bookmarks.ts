export interface BrowserBookmark {
  url: string;
  title: string;
  faviconUrl?: string;
  createdAt: number;
}

const browserBookmarksKey = 'netior.browser.bookmarks';

function readRawBookmarks(): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(browserBookmarksKey) ?? '[]');
  } catch {
    return [];
  }
}

export function loadBrowserBookmarks(): BrowserBookmark[] {
  const raw = readRawBookmarks();
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is BrowserBookmark => (
      typeof item === 'object'
      && item !== null
      && typeof (item as BrowserBookmark).url === 'string'
      && typeof (item as BrowserBookmark).title === 'string'
      && typeof (item as BrowserBookmark).createdAt === 'number'
    ))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function saveBrowserBookmarks(bookmarks: BrowserBookmark[]): void {
  window.localStorage.setItem(browserBookmarksKey, JSON.stringify(bookmarks));
}

export function findBrowserBookmark(url: string, bookmarks = loadBrowserBookmarks()): BrowserBookmark | undefined {
  return bookmarks.find((bookmark) => bookmark.url === url);
}

export function upsertBrowserBookmark(bookmark: BrowserBookmark): BrowserBookmark[] {
  const next = [
    bookmark,
    ...loadBrowserBookmarks().filter((item) => item.url !== bookmark.url),
  ];
  saveBrowserBookmarks(next);
  return next;
}

export function removeBrowserBookmark(url: string): BrowserBookmark[] {
  const next = loadBrowserBookmarks().filter((item) => item.url !== url);
  saveBrowserBookmarks(next);
  return next;
}
