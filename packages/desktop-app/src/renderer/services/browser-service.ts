type BrowserService = {
  clearData: () => Promise<boolean>;
  openDownload: (savePath: string) => Promise<boolean>;
  respondPermission: (id: string, allowed: boolean) => void;
  onDownloadEvent: (callback: (event: unknown) => void) => () => void;
  onPermissionRequest: (callback: (request: unknown) => void) => () => void;
};

export const browserService: BrowserService = {
  clearData: () => window.electron.browser.clearData(),
  openDownload: (savePath: string) => window.electron.browser.openDownload(savePath),
  respondPermission: (id: string, allowed: boolean) => window.electron.browser.respondPermission(id, allowed),
  onDownloadEvent: (callback) => window.electron.browser.onDownloadEvent((event) => callback(event)),
  onPermissionRequest: (callback) => window.electron.browser.onPermissionRequest((request) => callback(request)),
};
