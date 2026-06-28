import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { release } from 'node:os';
import type {
  AgentNameEvent,
  AgentSessionEvent,
  AgentSessionSnapshot,
  AgentStatusEvent,
  AgentTurnEvent,
  TerminalLaunchConfig,
  TerminalSessionInfo,
  TerminalSessionState,
} from '@netior/shared/types';

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

function getWindowsBuildNumber(): number | null {
  if (process.platform !== 'win32') return null;

  const match = release().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;

  const buildNumber = Number(match[3]);
  return Number.isFinite(buildNumber) ? buildNumber : null;
}

function getWorktreeLabel(): string {
  const normalized = process.cwd().replace(/\\/g, '/');
  const marker = '/.claude/worktrees/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex === -1) return 'main';

  const segments = normalized.slice(markerIndex + marker.length).split('/').filter(Boolean);
  return segments[0] || 'main';
}

const electronAPI = {
  app: {
    worktreeLabel: getWorktreeLabel(),
    readyForOpenFiles: () => ipcRenderer.send('app:renderer-ready-for-open-files'),
    updateWorldContext: (context: { rootNetworkId?: string | null; worldRoot?: string | null }) =>
      ipcRenderer.send('app:update-world-context', context),
    onOpenFiles: (callback: (filePaths: string[]) => void) => {
      const handler = (_event: IpcRendererEvent, filePaths: string[]) => callback(filePaths);
      ipcRenderer.on('app:open-files', handler);
      return () => { ipcRenderer.removeListener('app:open-files', handler); };
    },
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleAlwaysOnTop: () => ipcRenderer.send('window:toggleAlwaysOnTop'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
    isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop') as Promise<boolean>,
    onMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
      const handler = (_event: IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
      ipcRenderer.on('window:maximized-changed', handler);
      return () => { ipcRenderer.removeListener('window:maximized-changed', handler); };
    },
    onAlwaysOnTopChanged: (callback: (isAlwaysOnTop: boolean) => void) => {
      const handler = (_event: IpcRendererEvent, isAlwaysOnTop: boolean) => callback(isAlwaysOnTop);
      ipcRenderer.on('window:always-on-top-changed', handler);
      return () => { ipcRenderer.removeListener('window:always-on-top-changed', handler); };
    },
    onAppShortcut: (callback: (shortcut: string) => void) => {
      const handler = (_event: IpcRendererEvent, shortcut: string) => callback(shortcut);
      ipcRenderer.on('app:shortcut', handler);
      return () => { ipcRenderer.removeListener('app:shortcut', handler); };
    },
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<boolean>,
  },
  browser: {
    clearData: () => ipcRenderer.invoke('browser:clearData') as Promise<boolean>,
    openDownload: (savePath: string) => ipcRenderer.invoke('browser:openDownload', savePath) as Promise<boolean>,
    respondPermission: (id: string, allowed: boolean) => ipcRenderer.send('browser:permission-response', { id, allowed }),
    onDownloadEvent: (callback: (event: BrowserDownloadEvent) => void) => {
      const handler = (_event: IpcRendererEvent, payload: BrowserDownloadEvent) => callback(payload);
      ipcRenderer.on('browser:download-event', handler);
      return () => { ipcRenderer.removeListener('browser:download-event', handler); };
    },
    onPermissionRequest: (callback: (request: BrowserPermissionRequest) => void) => {
      const handler = (_event: IpcRendererEvent, payload: BrowserPermissionRequest) => callback(payload);
      ipcRenderer.on('browser:permission-request', handler);
      return () => { ipcRenderer.removeListener('browser:permission-request', handler); };
    },
  },
  notifications: {
    notifyAgent: (payload: {
      tabId: string;
      rootNetworkId?: string | null;
      title: string;
      message: string;
      playSound: boolean;
    }) => ipcRenderer.invoke('agent:notifyNative', payload) as Promise<boolean>,
    playSound: (kind: 'completion' | 'attention' | 'error') =>
      ipcRenderer.invoke('agent:playInAppSound', kind) as Promise<boolean>,
    onFocusTab: (callback: (payload: { tabId: string; rootNetworkId?: string | null }) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { tabId: string; rootNetworkId?: string | null }) => callback(payload);
      ipcRenderer.on('agent:focusTab', handler);
      return () => { ipcRenderer.removeListener('agent:focusTab', handler); };
    },
  },
  netior: {
    rpc: {
      call: (method: string, params?: unknown) =>
        ipcRenderer.invoke('netior:rpc:call', method, params),
    },
    resources: {
      getContent: (resourceId: string) =>
        ipcRenderer.invoke('netior:resource:getContent', resourceId),
      putContent: (
        resourceId: string,
        input: { base64?: string; text?: string; contentType?: string },
      ) => ipcRenderer.invoke('netior:resource:putContent', resourceId, input),
      deleteContent: (resourceId: string) =>
        ipcRenderer.invoke('netior:resource:deleteContent', resourceId),
    },
    events: {
      subscribe: (callback: (event: unknown) => void) => {
        const handler = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
        ipcRenderer.on('netior:service-event', handler);
        return () => { ipcRenderer.removeListener('netior:service-event', handler); };
      },
    },
  },
  world: {
    create: (data: { name: string; root_uri: string }) =>
      ipcRenderer.invoke('world:create', data),
    list: () => ipcRenderer.invoke('world:list'),
    delete: (id: string) => ipcRenderer.invoke('world:delete', id),
    update: (id: string, data: Record<string, unknown>) => ipcRenderer.invoke('world:update', id, data),
    updateRootDir: (id: string, rootDir: string) => ipcRenderer.invoke('world:updateRootDir', id, rootDir),
  },
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readDirShallow: (dirPath: string, depth?: number) => ipcRenderer.invoke('fs:readDirShallow', dirPath, depth),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    stat: (targetPath: string) => ipcRenderer.invoke('fs:stat', targetPath),
    readBinaryFile: (filePath: string) => ipcRenderer.invoke('fs:readBinaryFile', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', filePath, content),
    openDialog: (options?: Record<string, unknown>) =>
      ipcRenderer.invoke('fs:openDialog', options),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('fs:rename', oldPath, newPath),
    delete: (targetPath: string) => ipcRenderer.invoke('fs:delete', targetPath),
    stashDelete: (targetPath: string) => ipcRenderer.invoke('fs:stashDelete', targetPath),
    restoreDeleted: (stashPath: string, originalPath: string) => ipcRenderer.invoke('fs:restoreDeleted', stashPath, originalPath),
    createFile: (filePath: string) => ipcRenderer.invoke('fs:createFile', filePath),
    createDir: (dirPath: string) => ipcRenderer.invoke('fs:createDir', dirPath),
    copy: (src: string, dest: string) => ipcRenderer.invoke('fs:copy', src, dest),
    move: (src: string, dest: string) => ipcRenderer.invoke('fs:move', src, dest),
    showInExplorer: (targetPath: string) => ipcRenderer.invoke('fs:showInExplorer', targetPath),
    exists: (targetPath: string) => ipcRenderer.invoke('fs:exists', targetPath),
    watchDirs: (dirs: string[]) => ipcRenderer.invoke('fs:watchDirs', dirs),
    unwatchDirs: () => ipcRenderer.invoke('fs:unwatchDirs'),
    hasClipboardFiles: () => ipcRenderer.invoke('fs:hasClipboardFiles'),
    hasClipboardImage: () => ipcRenderer.invoke('fs:hasClipboardImage'),
    writeClipboardFiles: (paths: string[], action: 'copy' | 'cut') => ipcRenderer.invoke('fs:writeClipboardFiles', paths, action),
    readClipboardFiles: () => ipcRenderer.invoke('fs:readClipboardFiles'),
    saveClipboardImage: (filePath: string) => ipcRenderer.invoke('fs:saveClipboardImage', filePath),
    onDirChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('fs:dirChanged', handler);
      return () => { ipcRenderer.removeListener('fs:dirChanged', handler); };
    },
  },
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
  },
  terminal: {
    createInstance: (sessionId: string, launchConfig: TerminalLaunchConfig) =>
      ipcRenderer.invoke('terminal:createInstance', sessionId, launchConfig),
    getSession: (sessionId: string): Promise<{ success: true; data: TerminalSessionInfo | null } | { success: false; error: string }> =>
      ipcRenderer.invoke('terminal:getSession', sessionId),
    attach: (sessionId: string) => ipcRenderer.invoke('terminal:attach', sessionId),
    shutdown: (sessionId: string) => ipcRenderer.invoke('terminal:shutdown', sessionId),
    input: (sessionId: string, data: string) => ipcRenderer.send('terminal:input', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', sessionId, cols, rows),
    getWindowsBuildNumber,
    onExit: (callback: (sessionId: string, exitCode: number) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { sessionId: string; exitCode: number }) =>
        callback(payload.sessionId, payload.exitCode);
      ipcRenderer.on('terminal:exit', handler);
      return () => { ipcRenderer.removeListener('terminal:exit', handler); };
    },
    onReady: (callback: (payload: { sessionId: string; pid: number | null; cwd: string; title: string }) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { sessionId: string; pid: number | null; cwd: string; title: string }) =>
        callback(payload);
      ipcRenderer.on('terminal:ready', handler);
      return () => { ipcRenderer.removeListener('terminal:ready', handler); };
    },
    onData: (callback: (sessionId: string, data: string) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { sessionId: string; data: string }) =>
        callback(payload.sessionId, payload.data);
      ipcRenderer.on('terminal:data', handler);
      return () => { ipcRenderer.removeListener('terminal:data', handler); };
    },
    onTitleChanged: (callback: (sessionId: string, title: string) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { sessionId: string; title: string }) =>
        callback(payload.sessionId, payload.title);
      ipcRenderer.on('terminal:titleChanged', handler);
      return () => { ipcRenderer.removeListener('terminal:titleChanged', handler); };
    },
    onStateChanged: (callback: (sessionId: string, state: TerminalSessionState, exitCode: number | null) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { sessionId: string; state: TerminalSessionState; exitCode: number | null }) =>
        callback(payload.sessionId, payload.state, payload.exitCode);
      ipcRenderer.on('terminal:stateChanged', handler);
      return () => { ipcRenderer.removeListener('terminal:stateChanged', handler); };
    },
    onFontSizeKey: (callback: (key: string) => void) => {
      const handler = (_event: IpcRendererEvent, key: string) => callback(key);
      ipcRenderer.on('terminal:font-size', handler);
      return () => { ipcRenderer.removeListener('terminal:font-size', handler); };
    },
  },
  claude: {
    onSessionEvent: (callback: (event: { ptySessionId: string; claudeSessionId: string | null; type: 'start' | 'stop' }) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { ptySessionId: string; claudeSessionId: string | null; type: 'start' | 'stop' }) =>
        callback(payload);
      ipcRenderer.on('claude:sessionEvent', handler);
      return () => { ipcRenderer.removeListener('claude:sessionEvent', handler); };
    },
    onStatusEvent: (callback: (event: { ptySessionId: string; status: 'idle' | 'working' }) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { ptySessionId: string; status: 'idle' | 'working' }) =>
        callback(payload);
      ipcRenderer.on('claude:statusEvent', handler);
      return () => { ipcRenderer.removeListener('claude:statusEvent', handler); };
    },
    onNameChanged: (callback: (event: { ptySessionId: string; sessionName: string }) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { ptySessionId: string; sessionName: string }) =>
        callback(payload);
      ipcRenderer.on('claude:nameChanged', handler);
      return () => { ipcRenderer.removeListener('claude:nameChanged', handler); };
    },
  },
  agent: {
    getSnapshot: () =>
      ipcRenderer.invoke('agent:getSnapshot') as Promise<AgentSessionSnapshot[]>,
    setName: (terminalSessionId: string, name: string) =>
      ipcRenderer.invoke('agent:setName', terminalSessionId, name) as Promise<boolean>,
    listDefinitions: (rootNetworkId?: string | null) =>
      ipcRenderer.invoke('agent:listDefinitions', rootNetworkId),
    upsertDefinition: (input: Record<string, unknown>) =>
      ipcRenderer.invoke('agent:upsertDefinition', input),
    deleteDefinition: (input: Record<string, unknown>) =>
      ipcRenderer.invoke('agent:deleteDefinition', input),
    upsertSkill: (input: Record<string, unknown>) =>
      ipcRenderer.invoke('agent:upsertSkill', input),
    deleteSkill: (input: Record<string, unknown>) =>
      ipcRenderer.invoke('agent:deleteSkill', input),
    onSessionEvent: (callback: (event: AgentSessionEvent) => void) => {
      const handler = (_event: IpcRendererEvent, payload: AgentSessionEvent) => callback(payload);
      ipcRenderer.on('agent:sessionEvent', handler);
      return () => { ipcRenderer.removeListener('agent:sessionEvent', handler); };
    },
    onStatusEvent: (callback: (event: AgentStatusEvent) => void) => {
      const handler = (_event: IpcRendererEvent, payload: AgentStatusEvent) => callback(payload);
      ipcRenderer.on('agent:statusEvent', handler);
      return () => { ipcRenderer.removeListener('agent:statusEvent', handler); };
    },
    onNameChanged: (callback: (event: AgentNameEvent) => void) => {
      const handler = (_event: IpcRendererEvent, payload: AgentNameEvent) => callback(payload);
      ipcRenderer.on('agent:nameChanged', handler);
      return () => { ipcRenderer.removeListener('agent:nameChanged', handler); };
    },
    onTurnEvent: (callback: (event: AgentTurnEvent) => void) => {
      const handler = (_event: IpcRendererEvent, payload: AgentTurnEvent) => callback(payload);
      ipcRenderer.on('agent:turnEvent', handler);
      return () => { ipcRenderer.removeListener('agent:turnEvent', handler); };
    },
  },
  narre: {
    listSessions: (rootNetworkId: string) => ipcRenderer.invoke('narre:listSessions', rootNetworkId),
    listSkills: (rootNetworkId: string) => ipcRenderer.invoke('narre:listSkills', rootNetworkId),
    listSupervisorAgents: (rootNetworkId?: string | null) => ipcRenderer.invoke('narre:supervisorListAgents', rootNetworkId),
    listSupervisorSkills: (rootNetworkId: string) => ipcRenderer.invoke('narre:supervisorListSkills', rootNetworkId),
    listSupervisorSessions: () => ipcRenderer.invoke('narre:supervisorListSessions'),
    listSupervisorEvents: (afterSeq?: number | null) => ipcRenderer.invoke('narre:supervisorListEvents', afterSeq),
    listSupervisorRuns: (rootNetworkId?: string | null) => ipcRenderer.invoke('narre:supervisorListRuns', rootNetworkId),
    createSupervisorRun: (data: Record<string, unknown>) => ipcRenderer.invoke('narre:supervisorCreateRun', data),
    getSupervisorRun: (runId: string) => ipcRenderer.invoke('narre:supervisorGetRun', runId),
    planSupervisorRun: (runId: string) => ipcRenderer.invoke('narre:supervisorPlanRun', runId),
    runSupervisorRun: (runId: string) => ipcRenderer.invoke('narre:supervisorRunRun', runId),
    cancelSupervisorRun: (runId: string) => ipcRenderer.invoke('narre:supervisorCancelRun', runId),
    listSupervisorApprovals: (runId: string) => ipcRenderer.invoke('narre:supervisorListApprovals', runId),
    resolveSupervisorApproval: (data: Record<string, unknown>) => ipcRenderer.invoke('narre:supervisorResolveApproval', data),
    createSession: (input: string | Record<string, unknown>) => ipcRenderer.invoke('narre:createSession', input),
    getSession: (sessionId: string) => ipcRenderer.invoke('narre:getSession', sessionId),
    updateSessionTitle: (data: Record<string, unknown>) => ipcRenderer.invoke('narre:updateSessionTitle', data),
    deleteSession: (sessionId: string) => ipcRenderer.invoke('narre:deleteSession', sessionId),
    getApiKeyStatus: () => ipcRenderer.invoke('narre:getApiKeyStatus'),
    setApiKey: (key: string) => ipcRenderer.invoke('narre:setApiKey', key),
    searchMentions: (rootNetworkId: string, query: string) => ipcRenderer.invoke('narre:searchMentions', rootNetworkId, query),
    listRuntimeModels: (provider: string) => ipcRenderer.invoke('narre:listRuntimeModels', provider),
    sendMessage: (data: Record<string, unknown>) => ipcRenderer.invoke('narre:sendMessage', data),
    respondToCard: (data: Record<string, unknown>) => ipcRenderer.invoke('narre:respondCard', data),
    interruptMessage: (data: Record<string, unknown>) => ipcRenderer.invoke('narre:interruptMessage', data),
    steerMessage: (data: Record<string, unknown>) => ipcRenderer.invoke('narre:steerMessage', data),
    onStreamEvent: (callback: (event: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('narre:streamEvent', handler);
      return () => { ipcRenderer.removeListener('narre:streamEvent', handler); };
    },
  },
  mocSync: {
    onChangeEvent: (callback: (event: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('netior:service-event', handler);
      return () => { ipcRenderer.removeListener('netior:service-event', handler); };
    },
  },
  editor: {
    detach: (hostId: string, title: string) => ipcRenderer.invoke('editor:detach', hostId, title),
    reattach: (tabId: string, mode: string) => ipcRenderer.send('editor:reattach', tabId, mode),
    closeDetachedWindow: (hostId: string) => ipcRenderer.send('editor:closeDetachedWindow', hostId),
    onDetachedClosed: (callback: (hostId: string) => void) => {
      const handler = (_event: IpcRendererEvent, hostId: string) => callback(hostId);
      ipcRenderer.on('editor:detached-closed', handler);
      return () => { ipcRenderer.removeListener('editor:detached-closed', handler); };
    },
    onReattachToMode: (callback: (tabId: string, mode: string) => void) => {
      const handler = (_event: IpcRendererEvent, tabId: string, mode: string) => callback(tabId, mode);
      ipcRenderer.on('editor:reattach-to-mode', handler);
      return () => { ipcRenderer.removeListener('editor:reattach-to-mode', handler); };
    },
    // Cross-window state sync
    pushState: (state: unknown) => ipcRenderer.send('editor:pushState', state),
    getState: () => ipcRenderer.invoke('editor:getState') as Promise<unknown>,
    onStateSync: (callback: (state: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, state: unknown) => callback(state);
      ipcRenderer.on('editor:syncState', handler);
      return () => { ipcRenderer.removeListener('editor:syncState', handler); };
    },
    // Cross-window tab drag
    setDragTab: (tabId: string) => ipcRenderer.send('editor:dragStart', tabId),
    getDragTab: () => ipcRenderer.invoke('editor:getDragData') as Promise<string | null>,
    getDragTabSync: () => ipcRenderer.sendSync('editor:getDragDataSync') as string | null,
    clearDragTab: () => ipcRenderer.send('editor:dragEnd'),
  },
  settings: {
    pushState: (state: unknown) => ipcRenderer.send('settings:pushState', state),
    getState: () => ipcRenderer.invoke('settings:getState') as Promise<unknown>,
    onStateSync: (callback: (state: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, state: unknown) => callback(state);
      ipcRenderer.on('settings:syncState', handler);
      return () => { ipcRenderer.removeListener('settings:syncState', handler); };
    },
  },
  fonts: {
    listSystem: () => ipcRenderer.invoke('fonts:listSystem') as Promise<string[]>,
  },
  diagnostics: {
    perf: (payload: unknown) => ipcRenderer.send('diagnostics:perf', payload),
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);

export type ElectronAPI = typeof electronAPI;
