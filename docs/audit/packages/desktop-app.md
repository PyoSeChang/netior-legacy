# packages/desktop-app Audit

Status: scanning

## Initial Scope

- Target files: 366
- Existing test files: 19
- Main IPC registrations: 165
- Renderer components: 163
- Renderer stores: 14
- Renderer services: 21

## Initial Feature Candidates

| Candidate | Evidence | Status |
|---|---|---|
| Electron shell/window behavior | `src/main/index.ts`, `components/ui/WindowControls.tsx` | unmapped |
| Project home and project CRUD | `components/home/**`, `project-store.ts`, `project-service.ts` | unmapped |
| Workspace/network canvas | `components/workspace/**`, `network-store.ts`, `network-service.ts` | unmapped |
| Editor tab system | `components/editor/**`, `editor-store.ts` | unmapped |
| Instance/schema/model editors | `components/editor/*Editor.tsx`, stores/services | unmapped |
| File tree and filesystem actions | `components/sidebar/FileTree.tsx`, `fs-service.ts`, `fs-ipc.ts` | unmapped |
| Narre editor and chat | `components/editor/narre/**`, `narre-service.ts`, `narre-ipc.ts` | unmapped |
| Terminal and agent runtime UI | `TerminalEditor.tsx`, terminal libs, pty IPC | unmapped |
| Interactive views | `components/editor/interactive/**`, interactive view services | unmapped |
| Settings, shortcuts, activity bar | `components/settings/**`, `shortcuts/**`, `activity-bar-store.ts` | unmapped |

## Feature Records

### DESK-0001 Electron Main Runtime, Window Shell, And Browser Session

- Status: traced
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/main/index.ts`
  - `src/main/runtime/**`
  - `src/main/logging.ts`
  - `src/main/system-fonts.ts`
- Type: Electron main process
- User/caller behavior: Netior starts as a desktop app with a main window, title-bar controls, detached windows, persisted bounds, browser permissions/downloads, app shortcuts, and native notifications.
- System behavior: configures app userData/sessionData, initializes logging/runtime coordination, configures browser partition permissions/downloads, manages BrowserWindow instances, registers shell/window/browser/editor/settings/font IPC, and coordinates shutdown.
- Entry points:
  - Electron app lifecycle
  - `window:*`
  - `browser:*`
  - `shell:openExternal`
  - `editor:*`
  - `settings:*`
  - `fonts:listSystem`
- Inputs: Electron lifecycle events, IPC messages, browser permission/download events
- Outputs: BrowserWindows, IPC responses/events, persisted browser permission decisions
- State changes: runtime registration, window bounds/state, browser permissions, downloads
- Persistence: app userData/sessionData files
- Dependencies: Electron, runtime path helpers, logging, sidecar managers, agent runtime manager
- Failure cases: invalid persisted bounds, permission timeout, download path collision, detached window sync failure, runtime coordination failure.
- Error handling: many browser permission paths fall back to deny; IPC handlers return booleans/results; startup logs runtime information.
- Async/loading behavior: Electron event-driven async IPC
- i18n/display relevance: none directly
- Linked indexes:
  - ipc-channels: window/browser/editor/settings shell groups
- Notes: `runtime-scope.test.ts` exists; full main-process behavior is mostly manual/integration tested.

### DESK-0002 Production/Development Sidecar Process Management

- Status: mapped
- Risk: high
- Test status: unknown
- Package: `packages/desktop-app`
- Locations:
  - `src/main/process/sidecar-runtime.ts`
  - `src/main/process/netior-service-manager.ts`
  - `src/main/process/narre-server-manager.ts`
- Type: sidecar lifecycle
- User/caller behavior: desktop starts/stops bundled or development netior-service and Narre sidecars for DB and AI functionality.
- System behavior: resolves runtime paths, starts sidecar processes, passes ports/data/env, coordinates provider/settings sync, and stops sidecars on shutdown.
- Entry points:
  - `startNetiorService`
  - `stopNetiorService`
  - `stopNarreServer`
  - Narre config sync from main
- Inputs: runtime scope, packaged resources, ports, data paths, provider settings
- Outputs: running sidecar processes
- State changes: child process lifecycle
- Persistence: sidecar data under shared user data root
- Dependencies: SVC-0001, NARRE-0001, runtime path helpers
- Failure cases: missing bundled sidecar, port conflict, packaged path mismatch, stale process, native binding/runtime mismatch.
- Error handling: pending detailed branch audit
- Async/loading behavior: child process startup/shutdown
- i18n/display relevance: none
- Linked indexes:
  - service-endpoints: netior-service and Narre health
- Notes: Installer/packaging behavior should be cross-checked separately.

### DESK-0003 Preload Bridge And Renderer Electron API

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/desktop-app`
- Locations:
  - `src/preload/index.ts`
- Type: preload bridge / IPC boundary
- User/caller behavior: renderer code can call desktop APIs through `window.electron` without direct Node/Electron access.
- System behavior: exposes grouped APIs for app/window/shell/browser/notifications/projects/instances/networks/layouts/objects/edges/relationships/contexts/files/modules/schemas/models/DSL/interactive views/fs/config/terminal/agents/Narre and event subscriptions.
- Entry points:
  - `contextBridge.exposeInMainWorld('electron', electronAPI)`
- Inputs: renderer method calls and callback registrations
- Outputs: `ipcRenderer.invoke/send` calls and event unsubscribe functions
- State changes: none directly; all mutations happen through main IPC/service/FS
- Persistence: none directly
- Dependencies: Electron preload, main IPC handlers
- Failure cases: channel mismatch, missing unsubscribe, unsafe API exposure, raw-string drift from shared `IPC_CHANNELS`.
- Error handling: IPC result handling is downstream in renderer services.
- Async/loading behavior: promise-returning invoke methods and event callbacks
- i18n/display relevance: none
- Linked indexes:
  - ipc-channels: preload-to-main mapping
  - entry-points: preload bridge methods
- Notes: Later audit should compare every exposed method with a main handler and renderer service consumer.

### DESK-0004 Main IPC Registration And Service Facade

- Status: mapped
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/main/ipc/index.ts`
  - `src/main/ipc/*.ts`
  - `src/main/netior-service/netior-service-client.ts`
- Type: main IPC facade
- User/caller behavior: renderer operations for persisted Netior data and desktop capabilities are executed through main process IPC.
- System behavior: registers 165 main IPC handlers/events across project, instance, network, layout, file, filesystem, schema, model, Narre, terminal, agent, context, config, and DSL surfaces, returning `IpcResult<T>` for invoke handlers.
- Entry points:
  - `registerAllIpc`
  - `ipcMain.handle`
  - `ipcMain.on`
- Inputs: preload IPC invocations/events
- Outputs: `IpcResult<T>`, side effects, broadcast events
- State changes: SQLite via netior-service, filesystem writes/deletes, terminal processes, Narre streams, agent definitions
- Persistence: DB, filesystem, settings, Narre/session files depending on handler
- Dependencies: SVC-0003, SVC-0004, NARRE APIs, pty manager, filesystem APIs
- Failure cases: handler/channel mismatch, service unavailable, unwrapped errors, stale IDs, filesystem path hazards, SSE forwarding errors.
- Error handling: individual handlers wrap success/error envelopes; detailed handler branch audit pending.
- Async/loading behavior: async IPC handlers and sidecar HTTP calls
- i18n/display relevance: built-in display consumers should use shared resolver in renderer, not IPC.
- Linked indexes:
  - ipc-channels: 165 main registrations
- Notes: This maps the IPC surface; each domain handler needs later branch-level records.

### DESK-0005 Renderer App Shell, Global Sync, Modals, And Toasts

- Status: traced
- Risk: medium
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/App.tsx`
  - `src/renderer/hooks/useNetiorSync.ts`
  - `src/renderer/hooks/useI18n.ts`
  - `src/renderer/shortcuts/**`
  - `src/renderer/components/settings/**`
  - `src/renderer/components/shortcuts/**`
  - `src/renderer/components/ui/Toast.tsx`
- Type: renderer app shell
- User/caller behavior: app loads projects, opens workspace, handles global shortcuts/save/sync, shows settings, shortcut overlay, missing path dialog, confirmations, toasts, and window controls.
- System behavior: initializes global shortcut hooks, loads project list on mount, syncs stores when current project changes, renders `WorkspaceShell`, and mounts shared modals/containers.
- Entry points:
  - `App`
  - `useGlobalShortcuts`
  - `useNetiorSync`
- Inputs: current project state, UI store flags, shortcut/window events
- Outputs: mounted workspace and modal surfaces
- State changes: Zustand stores and renderer UI state
- Persistence: via stores/services when triggered
- Dependencies: project/UI/settings stores, renderer services, i18n
- Failure cases: project load failure swallowed, stale project sync, missing path resolution failure.
- Error handling: initial `loadProjects().catch(() => {})`; modals/stores handle later errors.
- Async/loading behavior: React effects and async store loads
- i18n/display relevance: modal labels use `useI18n`.
- Linked indexes:
  - renderer-components: app shell and global modals
- Notes: UI component detail remains pending.

### DESK-0006 Renderer Service Layer

- Status: mapped
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/services/*.ts`
- Type: renderer service facade
- User/caller behavior: stores/components call typed service functions instead of raw `window.electron` methods.
- System behavior: wraps preload APIs, unwraps IPC results, and groups project, instance, schema, model, network, layout, file, fs, Narre, agent, context, DSL, editor prefs, and interactive-view operations.
- Entry points:
  - service functions under `src/renderer/services`
  - `unwrapIpc`
- Inputs: UI/store payloads and IDs
- Outputs: typed domain data or thrown errors
- State changes: through preload/main IPC only
- Persistence: DB/filesystem/Narre through IPC handlers
- Dependencies: DESK-0003, DESK-0004
- Failure cases: IPC failure envelope, missing `window.electron`, stale service method, type drift.
- Error handling: `unwrapIpc` converts failed IPC results to thrown errors.
- Async/loading behavior: promise-based API calls
- i18n/display relevance: none directly
- Linked indexes:
  - renderer services index
- Notes: Service files are mapped by surface; per-service branch detail pending.

### DESK-0007 Zustand Store Layer

- Status: mapped
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/stores/*.ts`
  - `src/renderer/__tests__/stores.test.ts`
- Type: renderer state management
- User/caller behavior: project, editor, network, schema, model, instance, file, context, settings, module, activity bar, selection, and UI state update predictably across the app.
- System behavior: uses Zustand stores to load data through services, hold current selections, manage editor tabs/layouts, persist settings, cache project state, and coordinate network object selection.
- Entry points:
  - `useProjectStore`
  - `useEditorStore`
  - `useNetworkStore`
  - `useSchemaStore`
  - `useModelStore`
  - `useInstanceStore`
  - `useSettingsStore`
  - other store hooks
- Inputs: UI actions, IPC/service results, sync hooks
- Outputs: renderer state updates and derived UI state
- State changes: Zustand stores; some settings persisted through config IPC
- Persistence: settings/config and domain data through services
- Dependencies: renderer services, i18n/display helpers, editor/session libs
- Failure cases: stale async loads, race between project changes, dirty tab loss, detached window state divergence.
- Error handling: store-specific; detailed action audit pending.
- Async/loading behavior: async store actions and subscriptions
- i18n/display relevance: settings store controls locale/theme; domain stores should not use localized labels as identity.
- Linked indexes:
  - stores: 14 store files
- Notes: Existing tests cover some store/editor behavior, but not every store action.

### DESK-0008 Workspace And Editor Surface Router

- Status: mapped
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/components/workspace/**`
  - `src/renderer/components/editor/**`
  - `src/renderer/lib/open-*.ts`
  - `src/renderer/lib/editor-*.ts`
- Type: renderer user-facing workspace/editor shell
- User/caller behavior: users navigate workspace sidebars, open object/file/network/Narre/terminal/editor tabs, split/detach/minimize tabs, and edit domain objects.
- System behavior: routes tab types to editor components, manages workspace chrome/context menus, opens files/networks/browser/terminal tabs, bridges detached editor state, and renders editor modes.
- Entry points:
  - `WorkspaceShell`
  - `EditorContent`
  - `EditorTabStrip`
  - `SplitPaneRenderer`
  - `FullModeEditor`
  - `FloatWindowLayer`
- Inputs: current project, editor store state, object/file/network actions
- Outputs: workspace/editor UI and domain service calls
- State changes: editor store, domain stores, filesystem/DB through services
- Persistence: editor prefs, DB records, files depending on editor
- Dependencies: DESK-0006, DESK-0007, CORE/SVC/NARRE domain APIs
- Failure cases: dirty close conflicts, stale file tabs, detached sync issues, unsupported file routing, editor mode layout bugs.
- Error handling: close confirm dialogs, unsupported fallback, stale watchers; detail pending.
- Async/loading behavior: React state/effects plus async services
- i18n/display relevance: editor labels must use shared display resolver for built-ins.
- Linked indexes:
  - renderer-components: workspace/editor groups
- Notes: This is only the shell/router record; individual editors get separate records later.

### DESK-0009 Project Home, Project Switching, And Missing Path Recovery

- Status: traced
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/components/home/ProjectHome.tsx`
  - `src/renderer/components/home/ProjectCard.tsx`
  - `src/renderer/components/home/ProjectCreateDialog.tsx`
  - `src/renderer/components/home/MissingFilesDialog.tsx`
  - `src/renderer/stores/project-store.ts`
  - `src/renderer/services/project-service.ts`
- Type: renderer project lifecycle
- User/caller behavior: users create, open, restore, update, delete, and recover projects whose root path or file paths moved.
- System behavior: loads project list, restores the last project from config, rejects duplicate root directories, validates root/file existence through fs IPC, caches/restores per-project renderer state, updates module root paths when a project root is reconnected, and clears stores on project close/delete.
- Entry points:
  - `ProjectHome`
  - `useProjectStore.loadProjects`
  - `useProjectStore.restoreLastProject`
  - `useProjectStore.createProject`
  - `useProjectStore.openProject`
  - `useProjectStore.resolveMissingPath`
  - `useProjectStore.validateFilePaths`
  - `useProjectStore.deleteProject`
- Inputs: project name, root directory, persisted last project id, filesystem existence checks
- Outputs: project list/current project state, missing path/file dialogs, project/module service calls
- State changes: project store, project state cache, module store, config `lastProjectId`
- Persistence: projects/modules in DB, config, project-state cache
- Dependencies: DESK-0006, DESK-0007, SVC-0003, fs IPC
- Failure cases: duplicate roots, missing root directory, stale last project id, file entity path drift, failed module path update.
- Error handling: duplicate root errors are normalized; some restore/load validation errors are intentionally swallowed; missing path is surfaced as a dialog.
- Async/loading behavior: project list loading flag and background file validation
- i18n/display relevance: project dialogs use locale strings; project identity uses IDs/root paths.
- Linked indexes:
  - renderer-components: `components/home`
  - stores: `project-store`
  - service-endpoints: project/module/fs groups
- Notes: `resolveMissingFile` reconnect is noted as TODO in code and should be treated as incomplete behavior.

### DESK-0010 Activity Bar, Sidebar Navigation, And Project Object Browsing

- Status: traced
- Risk: medium
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/components/sidebar/ActivityBar.tsx`
  - `src/renderer/components/sidebar/Sidebar.tsx`
  - `src/renderer/components/sidebar/NetworkList.tsx`
  - `src/renderer/components/sidebar/FileTree.tsx`
  - `src/renderer/components/sidebar/ObjectPanel.tsx`
  - `src/renderer/stores/activity-bar-store.ts`
  - `src/renderer/stores/ui-store.ts`
- Type: renderer navigation shell
- User/caller behavior: users switch sidebar views, open projects/networks/files/sessions/objects, jump to bookmarked networks, and launch Narre, terminal, agent, browser, settings, or ontology views.
- System behavior: loads sidebar data on project changes, watches module directories for file tree refresh, opens tabs or networks from rail actions, persists configurable activity bar order/bookmarks, and clamps sidebar width.
- Entry points:
  - `ActivityBar`
  - `Sidebar`
  - `useActivityBarStore`
  - `useUIStore`
- Inputs: current project/network, activity bar config, module directories, sidebar button clicks, file tree clicks
- Outputs: sidebar view state, opened editor tabs, network navigation, fs watchers
- State changes: UI store, activity bar config, network/file/module/instance/model stores
- Persistence: activity bar layout config through settings/config IPC
- Dependencies: DESK-0007, DESK-0009, DESK-0011
- Failure cases: stale bookmarks, watcher not unwatched, sidebar data loading races, absent current project.
- Error handling: many sidebar actions fire async work without local error display; detailed per-action audit pending.
- Async/loading behavior: effect-driven loading and filesystem watch callbacks
- i18n/display relevance: rail/sidebar labels use `useI18n`; object identity remains ID-based.
- Linked indexes:
  - renderer-components: `components/sidebar`
  - stores: `activity-bar-store`, `ui-store`
- Notes: Existing activity-bar layout tests cover part of the configurable layout behavior.

### DESK-0011 Network Workspace Canvas, Layout Plugins, Nodes, Edges, And Viewport

- Status: traced
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/components/workspace/NetworkWorkspace.tsx`
  - `src/renderer/components/workspace/NodeLayer.tsx`
  - `src/renderer/components/workspace/EdgeLayer.tsx`
  - `src/renderer/components/workspace/layout-plugins/**`
  - `src/renderer/stores/network-store.ts`
  - `src/renderer/services/network-service.ts`
  - `src/renderer/services/layout-service.ts`
- Type: renderer network canvas
- User/caller behavior: users pan/zoom, select, drag, resize, collapse, add, delete, and connect network nodes; edit edges; navigate network hierarchy; switch browse/edit mode; and use layout-specific controls.
- System behavior: loads full network data, renders layout plugin backgrounds/overlays, resolves node positions and edge visuals, persists viewport/positions/visual overrides, handles hierarchy/contains edges, and keeps selection synchronized with object context.
- Entry points:
  - `NetworkWorkspace`
  - `useNetworkStore.openNetwork`
  - `useNetworkStore.addNode`
  - `useNetworkStore.removeNode`
  - `useNetworkStore.setNodePosition`
  - `useNetworkStore.addEdge`
  - `useNetworkStore.removeEdge`
  - `useNetworkShortcuts`
- Inputs: pointer/keyboard/context-menu/drop events, network IDs, node/edge payloads, layout config JSON
- Outputs: canvas render tree, persisted network/layout updates, opened object/edge tabs
- State changes: network store, selection store, editor store, layout rows
- Persistence: networks, nodes, edges, relationships, layouts, node positions, edge visuals
- Dependencies: CORE-0008, CORE-0009, SVC-0003, DESK-0006
- Failure cases: malformed position JSON, stale current layout, hierarchy orphaning, duplicate structural edges, failed optimistic position save, edge/model fallback mismatch.
- Error handling: invalid persisted position JSON is skipped; hierarchy removal includes repair paths; many UI actions still need branch-level error surfacing audit.
- Async/loading behavior: `openNetwork` loading flag, async service calls, optimistic position/visual updates
- i18n/display relevance: network prompts and labels use `useI18n`; built-in model display should use shared resolver.
- Linked indexes:
  - renderer-components: `components/workspace`
  - stores: `network-store`, `network-object-selection-store`
  - service-endpoints: network/layout/edge/relationship groups
- Notes: `NetworkWorkspace.tsx` is very large and needs a later branch checklist for pointer, drop, hierarchy, temporal, Narre mention, and deletion paths.

### DESK-0012 Editor Tab Lifecycle, Layout Modes, Detach, Split, Dirty Close, And Focus

- Status: traced
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/stores/editor-store.ts`
  - `src/renderer/components/editor/EditorContent.tsx`
  - `src/renderer/components/editor/EditorTabStrip.tsx`
  - `src/renderer/components/editor/SplitPaneRenderer.tsx`
  - `src/renderer/components/editor/modes/**`
  - `src/renderer/components/editor/CloseConfirmDialog.tsx`
  - `src/renderer/lib/editor-session-registry.ts`
- Type: editor state and layout engine
- User/caller behavior: users open, focus, rename, close, save-and-close, minimize, split, float, full-screen, detach, reattach, and reorder editor tabs.
- System behavior: normalizes tab IDs, coerces view modes, stores split trees, manages detached host state, persists float geometry, checks dirty/session/terminal state before close, routes tab types to editor components, and focuses editor content when active.
- Entry points:
  - `useEditorStore.openTab`
  - `useEditorStore.requestCloseTab`
  - `useEditorStore.setViewMode`
  - `useEditorStore.splitTab`
  - `useEditorStore.detachTab`
  - `EditorContent`
- Inputs: tab open params, drag/drop events, close requests, editor session state
- Outputs: tab records, split layouts, detached window IPC calls, routed editor UI
- State changes: editor store, editor prefs, session registry cleanup, detached host records
- Persistence: editor prefs and draft/session state through helper registries
- Dependencies: DESK-0001, DESK-0003, DESK-0006, terminal/session libs
- Failure cases: layout tree corruption, duplicate tab IDs, stale detached hosts, dirty data loss, terminal process still alive, focus stealing.
- Error handling: close confirmation for dirty/terminal tabs; fallback unknown editor rendering; detailed path audit pending.
- Async/loading behavior: `openTab` may load editor prefs; close save path awaits registered session save.
- i18n/display relevance: tab titles may be localized by callers; identity uses tab type/target ID.
- Linked indexes:
  - renderer-components: editor shell/modes
  - stores: `editor-store`
- Notes: Existing editor shortcut/layout tests cover some behavior, not every tree mutation.

### DESK-0013 File Tree, Filesystem Operations, And File Editors/Viewers

- Status: mapped
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/components/sidebar/FileTree.tsx`
  - `src/renderer/components/editor/FileEditor.tsx`
  - `src/renderer/components/editor/markdown/MarkdownEditor.tsx`
  - `src/renderer/components/editor/PdfViewer.tsx`
  - `src/renderer/components/editor/ImageViewer.tsx`
  - `src/renderer/components/editor/UnsupportedFallback.tsx`
  - `src/renderer/stores/file-store.ts`
  - `src/renderer/services/fs-service.ts`
  - `src/renderer/services/file-service.ts`
- Type: project filesystem UI
- User/caller behavior: users browse module directories, open files, edit text/markdown, view PDFs/images, create/rename/delete/move/copy files or directories, and recover stale file tabs.
- System behavior: builds file trees from filesystem IPC, watches directories, routes file extensions to viewers/editors, tracks open file content/dirty state, writes file content, and maintains file entity metadata.
- Entry points:
  - `FileTree`
  - `openFileTab`
  - `useFileStore.loadFileTree`
  - `useFileStore.saveFile`
  - `fsService.*`
- Inputs: absolute paths, relative paths, drag/drop, clipboard, file contents, file dialog selections
- Outputs: file tree nodes, file editor tabs, filesystem writes/deletes, file entity records
- State changes: file store, editor store, filesystem, file metadata
- Persistence: project files on disk and file entity DB rows
- Dependencies: DESK-0004, CORE-0010, SVC-0003, fs IPC
- Failure cases: path normalization bugs, deleted/moved files, binary/text mismatch, destructive delete hazards, watcher drift, stale tab reload conflicts.
- Error handling: unsupported fallback and stale watcher exist; destructive branch behavior needs detailed audit.
- Async/loading behavior: file tree loading paths, async read/write/watch calls
- i18n/display relevance: file UI labels only; file path identity is stable path/ref data.
- Linked indexes:
  - filesystem-effects
  - renderer-components: `components/sidebar/FileTree`, file editor/viewer components
- Notes: Filesystem IPC should receive its own safety/path validation checklist before claiming branch-complete coverage.

### DESK-0014 Instance, Schema, Model, Context, Network, Edge, Project, And Ontology Editors

- Status: mapped
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/components/editor/InstanceEditor.tsx`
  - `src/renderer/components/editor/SchemaEditor.tsx`
  - `src/renderer/components/editor/ModelEditor.tsx`
  - `src/renderer/components/editor/ContextEditor.tsx`
  - `src/renderer/components/editor/NetworkEditor.tsx`
  - `src/renderer/components/editor/EdgeEditor.tsx`
  - `src/renderer/components/editor/ProjectEditor.tsx`
  - `src/renderer/components/editor/OntologyEditor.tsx`
  - `src/renderer/stores/instance-store.ts`
  - `src/renderer/stores/schema-store.ts`
  - `src/renderer/stores/model-store.ts`
  - `src/renderer/stores/context-store.ts`
- Type: domain object editing
- User/caller behavior: users create and edit instances, schema fields/meanings, models, contexts, networks, edges, projects, and ontology views from editor tabs.
- System behavior: editor components load domain records through stores/services, update persisted rows, maintain properties/field bindings/edge visuals, and reflect built-in ontology display data.
- Entry points:
  - `EditorContent` domain editor cases
  - domain store CRUD actions
  - `schemaService`, `modelService`, `instanceService`, `contextService`, `networkService`
- Inputs: form fields, schema/model selections, edge visual payloads, context members, editor tab target IDs
- Outputs: updated domain records and editor UI state
- State changes: domain stores, editor dirty/session state, DB rows
- Persistence: DB through netior-service/core repositories
- Dependencies: CORE-0005 through CORE-0015, SVC-0003, DESK-0006
- Failure cases: stale target IDs, incomplete schema binding runtime support, missing built-in display keys, edge model fallback mismatch, unsaved draft conflicts.
- Error handling: component-specific; branch-level editor form validation pending.
- Async/loading behavior: async store/service calls; dirty/session handling depends on editor session registry.
- i18n/display relevance: high; built-in labels should route through shared display resolver.
- Linked indexes:
  - renderer-components: domain editor components
  - stores: instance/schema/model/context/network stores
- Notes: This groups many domain editors; next pass should split instance, schema, model, and edge editors if the audit needs form-level coverage.

### DESK-0015 Narre Renderer Editor, Chat, Mentions, Cards, And Supervisor UI

- Status: mapped
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/components/editor/NarreEditor.tsx`
  - `src/renderer/components/editor/narre/**`
  - `src/renderer/services/narre-service.ts`
  - `src/renderer/lib/narre-session-store.ts`
  - `src/renderer/lib/narre-ui-state.ts`
  - `src/renderer/hooks/useNarreMentionDrag.ts`
- Type: Narre renderer UX
- User/caller behavior: users open Narre, manage sessions, send/interrupt/steer chat, use mentions/slash skills, inspect tool logs, respond to cards, and view supervisor/run/agent surfaces.
- System behavior: calls Narre REST/IPC services, subscribes to stream events, renders localized MCP tool/card output, handles mention search/drag/drop, and stores Narre UI/session state.
- Entry points:
  - `NarreEditor`
  - `NarreChat`
  - `NarreSessionList`
  - `NarreMentionInput`
  - `NarreToolLog`
  - `narreService.onStreamEvent`
- Inputs: chat text, session IDs, provider/API key state, stream events, card responses
- Outputs: messages, cards, tool logs, session state, Narre IPC/HTTP calls
- State changes: Narre UI state, session store, editor tab state
- Persistence: Narre server session files and renderer local state
- Dependencies: NARRE-0002 through NARRE-0010, DESK-0004, DESK-0006
- Failure cases: SSE disconnect, event ordering issues, stale session IDs, missing tool display resolver entries, interrupted stream cleanup.
- Error handling: service unwrap and UI-specific handling; event branch audit pending.
- Async/loading behavior: REST promises plus stream event callbacks
- i18n/display relevance: high; MCP tool presentation should use resolver-backed names/descriptions.
- Linked indexes:
  - narre-events
  - renderer-components: `components/editor/narre`
- Notes: Narre lifecycle tracing can use the `narre-observability` skill if response delivery issues are investigated later.

### DESK-0016 Terminal, Agent Editor, Browser Editor, And External Tool Surfaces

- Status: mapped
- Risk: high
- Test status: partially-tested
- Package: `packages/desktop-app`
- Locations:
  - `src/renderer/components/editor/TerminalEditor.tsx`
  - `src/renderer/lib/terminal/**`
  - `src/renderer/components/editor/AgentEditor.tsx`
  - `src/renderer/services/agent-service.ts`
  - `src/renderer/components/editor/BrowserEditor.tsx`
  - `src/renderer/lib/open-browser-tab.ts`
- Type: embedded tool editors
- User/caller behavior: users open terminal sessions, interact with agent definitions/skills, open embedded browser tabs, and receive terminal/agent notifications.
- System behavior: routes terminal tabs to a Hyper-style terminal surface, tracks process/session/todo state, stores user agent definitions/skills, and bridges browser tab behavior through Electron browser IPC.
- Entry points:
  - `openTerminalTab`
  - `TerminalEditor`
  - `AgentEditor`
  - `BrowserEditor`
  - `agentService`
- Inputs: terminal launch config, shell input/output events, agent definition form data, browser URLs
- Outputs: terminal UI, agent records, browser webcontents, notifications/toasts
- State changes: editor store, terminal runtime/tracker state, agent storage, browser tab favicon/title state
- Persistence: agent definitions/skills, terminal/editor state depending on runtime, browser session data
- Dependencies: DESK-0001, DESK-0004, SH-0004, terminal IPC
- Failure cases: live terminal close, shell process leak, command output parsing drift, agent skill storage mismatch, unsafe browser permissions.
- Error handling: terminal tabs trigger close confirmation when process is alive; other branches pending detailed audit.
- Async/loading behavior: terminal event streams, async agent CRUD, browser events
- i18n/display relevance: agent/browser/terminal UI labels use renderer i18n.
- Linked indexes:
  - renderer-components: terminal/agent/browser editors
  - filesystem-effects: agent skill storage
- Notes: Terminal tests exist for engine/link/parser/viewport behavior.
