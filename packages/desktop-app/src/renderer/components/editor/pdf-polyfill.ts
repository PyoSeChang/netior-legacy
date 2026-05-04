// Polyfill URL.parse for Electron's Chromium (<126) ??required by pdfjs-dist 4.x
if (typeof URL.parse !== 'function') {
  (URL as unknown as Record<string, unknown>).parse = function (url: string, base?: string) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}
