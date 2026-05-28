import { useEditorStore } from '../stores/editor-store';

export function normalizeBrowserUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^file:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return null;
    }
  }

  const hasHttpScheme = /^https?:\/\//i.test(trimmed);
  const looksLikeLocalUrl = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(trimmed);
  const looksLikeHostPort = /^[A-Za-z0-9.-]+:\d+(?:[/?#]|$)/.test(trimmed);
  const hasNonHttpScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed) && !hasHttpScheme && !looksLikeHostPort;
  if (hasNonHttpScheme) return null;

  try {
    const url = new URL(
      hasHttpScheme
        ? trimmed
        : `${looksLikeLocalUrl || looksLikeHostPort ? 'http' : 'https'}://${trimmed}`,
    );
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getBrowserTabTitle(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || url);
    }
    return parsed.host || url;
  } catch {
    return url;
  }
}

export function getDefaultFaviconUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') return undefined;
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

export async function openBrowserTab(url: string, hostId?: string): Promise<boolean> {
  const normalized = normalizeBrowserUrl(url);
  if (!normalized) return false;

  await useEditorStore.getState().openTab({
    type: 'browser',
    targetId: normalized,
    title: getBrowserTabTitle(normalized),
    browserFaviconUrl: getDefaultFaviconUrl(normalized),
    browserUrl: normalized,
    viewMode: 'side',
    hostId,
  });
  return true;
}
