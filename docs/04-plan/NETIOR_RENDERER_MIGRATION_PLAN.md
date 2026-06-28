# Netior Renderer Migration Plan

이 문서는 새 Netior 모델로 전환할 때 renderer 영역에서 무엇을 유지, 수정, 교체할지 조사한 1차 계획이다.

범위는 renderer component 중심이다.

- App shell / layout
- Sidebar / activity rail
- Canvas
- 통합 editor
- terminal editor
- browser / HTML preview
- interactive view runtime
- shortcuts
- toast / confirm / native notification

이 문서는 구현 세부 task list가 아니라 migration 판단 문서다. 실제 구현 전 각 단계에서 코드 단위 task로 다시 쪼갠다.

## 현재 구조 요약

### App Entry

Reference:

- `packages/desktop-app/src/renderer/App.tsx`

현재 `App`은 다음을 전역 mount한다.

- `WorkspaceShell`
- `WorldHome`
- `SettingsModal`
- `ShortcutOverlay`
- `ToastContainer`
- `ConfirmDialog`
- `MissingFilesDialog`
- `useGlobalShortcuts`
- `useNetiorSync`

판단:

- 전역 modal/toast/shortcut mount 구조는 유지 가능하다.
- `WorkspaceShell`과 `WorldHome` 분기는 새 구조에도 맞다.
- titlebar 도입으로 `WindowControls` 주입 방식은 재검토해야 한다.

### Workspace Shell

Reference:

- `packages/desktop-app/src/renderer/components/workspace/WorkspaceShell.tsx`

현재 `WorkspaceShell`은 다음을 조합한다.

- `ActivityBar`
- `Sidebar`
- `NetworkWorkspace`
- `EditorTabStrip`
- `EditorContent`
- `FullModeEditor`
- `FloatWindowLayer`
- `SplitPaneRenderer`
- `MinimizedEditorTabs`
- tab drag/drop
- side/full/float editor mode

판단:

- split editor architecture는 재사용 가치가 크다.
- 하지만 `NetworkWorkspace`가 workspace의 primary surface로 고정되어 있으므로, 새 구조에서는 `ViewPane`이 필요하다.
- 기존 `NetworkTabStrip`은 새 `ViewRemote`의 reference로 사용한다.
- dedicated app titlebar 결정에 따라 `WindowControls`는 tab strip/right slot이 아니라 app titlebar 쪽으로 이동하는 것이 기본이다.

### Canvas / Network Workspace

Reference:

- `packages/desktop-app/src/renderer/components/workspace/NetworkWorkspace.tsx`
- `packages/desktop-app/src/renderer/components/workspace/InteractionLayer.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NodeLayer.tsx`
- `packages/desktop-app/src/renderer/components/workspace/EdgeLayer.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NetworkControls.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NodeContextMenu.tsx`
- `packages/desktop-app/src/renderer/components/workspace/EdgeContextMenu.tsx`
- `packages/desktop-app/src/renderer/components/workspace/layout-plugins/*`
- `packages/desktop-app/src/renderer/components/workspace/node-components/*`
- `packages/desktop-app/src/renderer/stores/network-store.ts`
- `packages/desktop-app/src/renderer/services/network-service.ts`

Measured size:

- `NetworkWorkspace.tsx`: about 4,249 lines

현재 기능:

- pan / zoom
- node drag
- selection box
- context menu
- edge rendering
- node rendering
- layout plugins: freeform, calendar, gantt, timeline, semantic 등
- network hierarchy
- network controls
- file/object node creation
- old network/domain service coupling

판단:

- `NetworkWorkspace` 자체를 migration하지 않는다. old `network/rootNetwork/schema/meaning/edge` 모델과 강하게 결합되어 있다.
- 새 Canvas는 `View`와 `CanvasNode/CanvasEdge` 모델을 기준으로 처음부터 구현한다.
- 기존 canvas 코드는 reference로만 사용한다. 구현체를 직접 들어내거나 점진적으로 개조하는 방식은 피한다.

Reference 후보:

- `InteractionLayer`: pan/zoom/drag/selection 요구사항 reference
- `Background`: dot grid reference
- `EdgeLayer` / `EdgeRouteLine`: SVG edge rendering reference
- `NodeLayer`: node placement/render loop reference
- `WorkspaceContextMenuSurface`: context menu surface reference
- node visual/layout components: built-in node renderer reference
- 일부 layout plugin 아이디어: calendar/gantt는 MVP 이후 또는 DB 구조만 준비

교체 대상:

- `NetworkWorkspace` orchestration
- `network-store` 중심 data loading
- old edge creation/editing flow
- schema/meaning 기반 semantic projection
- network hierarchy navigation
- `NetworkControls` naming and responsibility

새 구조:

```text
ViewPane
├─ ViewRemote
└─ ViewRenderer
   ├─ ExplorerRenderer
   └─ CanvasRenderer
```

Canvas MVP:

- `browse/edit` mode
- pan/zoom
- area select
- node drag/drop
- node resize later
- group/ungroup later or minimal
- `Hide from Canvas`
- `Remove from Canvas`
- context menu
- double-click open editor
- edge display only for accepted supported edge subjects
- same View 안 subject 중복 배치 금지

### Integrated Editor

Reference:

- `packages/desktop-app/src/renderer/components/editor/EditorContent.tsx`
- `packages/desktop-app/src/renderer/components/editor/EditorTabStrip.tsx`
- `packages/desktop-app/src/renderer/stores/editor-store.ts`
- `packages/desktop-app/src/renderer/components/editor/SplitPaneRenderer.tsx`
- `packages/desktop-app/src/renderer/components/editor/modes/*`

Measured size:

- `editor-store.ts`: about 1,521 lines

현재 구조:

- `EditorContent`가 `EditorTab.type` 기반으로 editor component를 route한다.
- `editor-store`가 tab lifecycle, side/full/float/detached layout, active tab, dirty state를 관리한다.
- `EditorTabStrip`은 tab rendering, reorder, context menu, right slot을 처리한다.
- `FullModeEditor`, `FloatWindowLayer`, `DetachedEditorShell`이 editor surface를 공유한다.

판단:

- editor system은 유지 대상이다.
- 새 domain model에 맞춰 `EditorTabType`과 editor route를 개편한다.
- `schema`, `meaning`, `network`, `rootNetwork`, `edge`, `context`는 새 모델에 직접 맞지 않는다. 단계적으로 `model`, `kind`, `relationKind`, `instance`, `resource`, `view` 중심으로 대체한다.
- terminal, browser, file editor는 통합 editor의 일부로 유지한다.

새 editor 후보:

- `ModelEditor`
- `KindEditor`
- `RelationKindEditor`
- `InstanceEditor`
- `ResourceEditor` 또는 `FileEditor` 재사용
- `ViewEditor` 또는 `CanvasViewEditor`는 필요 여부 보류
- `NarreEditor`
- `TerminalEditor`
- `BrowserEditor`

주의:

- `Inspector` 별도 panel은 만들지 않는다.
- details/interactive는 editor 내부 mode로 유지한다.
- Canvas action은 `open_editor`를 통해 editor tab을 연다.

### File / Browser / HTML Editor

Reference:

- `packages/desktop-app/src/renderer/components/editor/FileEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/editor-utils.ts`
- `packages/desktop-app/src/renderer/components/editor/BrowserEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/markdown/MarkdownEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/CodeEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/ImageViewer.tsx`
- `packages/desktop-app/src/renderer/components/editor/PdfViewer.tsx`

Current routing:

- `.md` -> `MarkdownEditor`
- text/code formats -> `CodeEditor`
- `.png/.jpg/...` -> `ImageViewer`
- `.pdf` -> `PdfViewer`
- `.html/.htm` -> `BrowserEditor` first, `CodeEditor` second

판단:

- 확장자 기반 routing은 유지한다.
- `.html` preview는 기존 `BrowserEditor` 경로를 유지할 수 있다.
- interactive HTML SDK/sandbox와 일반 HTML preview는 분리해야 한다.
- 일반 file preview는 editor 기능이고, interactive view/module은 권한/SDK가 붙는 runtime이다.

Migration:

- `FileEditor`는 Resource/File editor로 유지.
- `editor-utils` extension map은 새 Resource handler 정책과 연결한다.
- HTML interactive runtime은 Capability/SDK 단계에서 별도 sandbox 정책을 추가한다.

### Terminal Editor

Reference:

- `packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx`
- `packages/desktop-app/src/renderer/lib/terminal/open-terminal-tab.ts`
- `packages/desktop-app/src/renderer/lib/terminal/hyper-fork/*`
- `packages/desktop-app/src/renderer/lib/terminal/engine/*`
- main/preload pty IPC paths

Measured size:

- `TerminalEditor.tsx`: about 1,020 lines

판단:

- terminal은 통합 editor 기능으로 유지한다.
- 새 domain model과 직접 결합되지 않으므로 migration risk는 낮다.
- app titlebar와 editor shell 변경 시 tab sizing/focus/shortcut integration만 재검증하면 된다.

주의:

- global shortcuts가 terminal input을 가로채는 경로가 있다.
- font setting은 terminal-specific font로 분리되어야 한다.
- terminal session notification/agent integration은 알림 정책과 함께 정리한다.

### Browser Editor

Reference:

- `packages/desktop-app/src/renderer/components/editor/BrowserEditor.tsx`
- `packages/desktop-app/src/renderer/lib/open-browser-tab.ts`
- `packages/desktop-app/src/renderer/lib/browser-bookmarks.ts`

Measured size:

- `BrowserEditor.tsx`: about 563 lines

판단:

- browser는 통합 editor 기능으로 유지한다.
- 일반 browser tab, local HTML preview, future interactive HTML runtime의 책임을 구분한다.
- BrowserEditor는 user-facing browser/editor이고, interactive runtime은 controlled SDK host다.

### Interactive View Runtime

Reference:

- `packages/desktop-app/src/renderer/components/editor/interactive/InteractiveViewPanel.tsx`
- `packages/desktop-app/src/renderer/components/editor/interactive/DynamicInteractiveView.tsx`
- `packages/desktop-app/src/renderer/components/editor/interactive/InteractiveViewRuntime.tsx`
- `packages/desktop-app/src/renderer/lib/interactive-view-validator.ts`
- `packages/desktop-app/src/renderer/services/interactive-view-template-service.ts`
- `packages/desktop-app/src/renderer/services/interactive-view-state-service.ts`

현재 구조:

- Instance editor 내부 mode로 붙는다.
- `InteractiveViewProvider`가 fields/properties/content/viewState/openObject/updateFieldValue를 제공한다.
- dynamic source는 React component로 compile된다.
- schema/field/property 중심이라 새 Kind/Property/Instance 모델과 직접 호환되지 않는다.

판단:

- 개념은 유지한다.
- 현재 구현은 legacy schema/field 기반이므로 직접 재사용보다 runtime pattern/reference로 둔다.
- 새 runtime은 `Kind/Property/Instance/Resource` 기준 SDK로 재정의해야 한다.

Migration:

- MVP에서는 Instance editor 내부 interactive mode만 유지 목표로 둔다.
- Canvas node나 View module로 interactive HTML을 embedding하는 것은 Capability/SDK 단계로 미룬다.
- validator/sandbox 정책은 기존 validator를 참고하되 새 API boundary로 다시 작성한다.

### Shortcuts

Reference:

- `packages/desktop-app/src/renderer/shortcuts/useGlobalShortcuts.ts`
- `packages/desktop-app/src/renderer/shortcuts/shortcut-registry.ts`
- `packages/desktop-app/src/renderer/shortcuts/shortcut-utils.ts`
- `packages/desktop-app/src/renderer/components/shortcuts/ShortcutOverlay.tsx`
- `packages/desktop-app/src/main/index.ts`

현재 구조:

- Renderer에서 `keydown` capture를 사용한다.
- Main process `before-input-event`가 일부 app-level shortcuts를 먼저 intercept한다.
- Shortcut overlay는 registry 기반이다.
- Terminal/editor와 충돌을 피하기 위한 조건이 있다.

판단:

- registry/overlay 구조는 유지한다.
- shortcut scope는 새 UI 구조에 맞춰 재정의한다.

새 scope 후보:

- `global`
- `appChrome`
- `view`
- `canvasBrowse`
- `canvasEdit`
- `explorer`
- `editor`
- `terminal`
- `browser`
- `narre`
- `modal`

Migration:

- old `network` scope는 `canvas` 또는 `view`로 교체한다.
- `toggleEditorMode` 같은 side/full 전환은 새 layout policy 확정 후 유지 여부 결정.
- main process shortcut interception은 terminal/browser가 key를 먹는 경우에만 최소 유지한다.

### Toast, Confirm, Native Notification

Reference:

- `packages/desktop-app/src/renderer/components/ui/Toast.tsx`
- `packages/desktop-app/src/renderer/components/ui/ConfirmDialog.tsx`
- `packages/desktop-app/src/renderer/components/ui/Modal.tsx`
- `packages/desktop-app/src/main/index.ts`
- `packages/desktop-app/src/renderer/lib/terminal-agent-notifier.tsx`

현재 구조:

- `ToastContainer`가 `App`에 global mount된다.
- `showToast` / `showCustomToast`는 imperative module-level API다.
- `ConfirmDialog`는 modal 기반이다.
- main process는 minimized window일 때 native notification을 띄우고 클릭 시 tab focus event를 보낸다.

판단:

- Toast/Confirm/Modal은 유지한다.
- 알림 기능은 Narre/agent 전용에서 general notification service로 확장 가능하게 정리해야 한다.
- native notification은 유지하되, 새 editor tab model과 focus target을 맞춰야 한다.

Migration:

- `agent:notifyNative`를 일반 notification boundary로 확장할지 검토한다.
- UI toast는 renderer notification center까지는 MVP에서 필요 없다.
- `toastKey` 기반 dedupe는 유지 가치가 있다.

## Keep / Adapt / Replace

| Area | Decision | Reason |
|---|---|---|
| `App` global mounting | Adapt | 전역 modal/toast/shortcut 구조는 유효하나 titlebar shell 추가 필요 |
| `WorkspaceShell` | Adapt heavily | split/editor/float 구조는 유용하지만 ViewPane 중심으로 재구성 필요 |
| `ActivityBar` | Adapt | top/middle/bottom 구조는 유효하나 Explorer/Canvas/Narre primary nav로 재매핑 |
| `Sidebar` | Replace most content | old worlds/networks/files/object panel 구조가 새 Model/View 책임과 다름 |
| `NetworkWorkspace` | Replace from scratch | old network engine과 강결합, 4k+ lines monolith |
| `InteractionLayer` | Reference only | 새 Canvas input model을 처음부터 구현할 때 요구사항 참고 |
| `NodeLayer`, `EdgeLayer`, `Background` | Reference only | rendering primitive 요구사항 참고, 직접 재사용은 기본 방침 아님 |
| layout plugins | Defer/adapt | calendar/gantt는 ViewType 확장 단계에서 재검토 |
| `EditorContent` | Adapt | routing 구조 유지, tab types 교체 |
| `editor-store` | Keep/adapt | tab lifecycle/split/float 가치 큼, old tab types 정리 필요 |
| `EditorTabStrip` | Keep/adapt | rounded tab/chrome reference 유지 |
| `FileEditor` | Keep/adapt | Resource/File editor로 유지 |
| `TerminalEditor` | Keep | domain migration 영향 낮음 |
| `BrowserEditor` | Keep/adapt | HTML preview 유지, interactive runtime과 분리 |
| Interactive View | Adapt concept, rewrite model binding | schema/field 기반이므로 새 Kind/Property 기준 SDK 필요 |
| Shortcuts | Adapt | registry 유지, scope 재정의 |
| Toast/Confirm/Modal | Keep | UI infra 유지 |
| Native notification | Adapt | agent-specific에서 general notification boundary로 정리 |

## Migration Phases

### Phase 0. Stabilize References

목표:

- 기존 UI reference 파일을 확정한다.
- 새 문서의 용어와 renderer migration 기준을 맞춘다.

산출물:

- `NETIOR_UI_LAYOUT.md`
- `NETIOR_VIEW_MODEL.md`
- `NETIOR_RENDERER_MIGRATION_PLAN.md`

### Phase 1. App Shell and Titlebar

목표:

- dedicated app titlebar를 구현한다.
- titlebar와 editor tab strip의 색상/경계를 통일한다.
- Home/Workspace 공통 app shell을 만든다.
- 새 renderer token 체계를 적용한다.

작업:

- `AppShell` 또는 `NetiorAppChrome` component 추가
- `WindowControls`를 titlebar 오른쪽으로 이동
- `WorkspaceShell`의 `windowControls` rightSlot 의존 제거 또는 축소
- Home screen에도 같은 titlebar 적용
- old renderer class/token 사용처를 새 token 체계로 교체
- chrome, sidebar, view remote, editor tab strip, editor body에 새 surface/text/border token 적용

검증:

- 창 drag region과 interactive controls 충돌 없음
- titlebar와 editor tab strip 사이 강한 경계 없음
- light/dark theme에서 chrome 계층 유지
- token 누락으로 hardcoded color가 남지 않음

### Phase 2. Editor System Preservation

목표:

- 기존 editor tab infrastructure를 유지하면서 새 editor type을 준비한다.

작업:

- `EditorTabType` 새 모델 후보 추가
- `ModelEditor`, `KindEditor`, `RelationKindEditor`, `InstanceEditor` scaffold
- old `SchemaEditor`, `MeaningEditor`, `NetworkEditor`, `RootNetworkEditor`, `EdgeEditor`는 compatibility 또는 migration-only로 격리
- `EditorContent` route 정리

검증:

- tab open/close/reorder/split/float/detached 동작 유지
- terminal/browser/file editor 동작 유지
- object details/interactive는 editor 내부 mode로 유지

### Phase 3. View Pane MVP

목표:

- `NetworkWorkspace` 대신 `ViewPane` 구조를 도입한다.

작업:

- `ViewPane`
- `ViewRemote`
- `ExplorerRenderer`
- `CanvasRenderer`
- `view-store` 또는 service client

검증:

- Explorer/Canvas 전환 가능
- ViewRemote가 app titlebar와 책임 분리
- sidebar primary nav와 ViewPane 상태 연동

### Phase 4. Canvas MVP

목표:

- old network canvas가 아니라 새 Canvas View를 구현한다.

작업:

- `CanvasNode`, `CanvasEdge`, `CanvasNodeType`, `CanvasEdgeType` rendering adapter
- pan/zoom/drag/area select input model 신규 구현
- node/edge/background rendering 신규 구현
- browse/edit mode 분리
- context menu action binding
- `open_editor` action 연결
- `Hide from Canvas`, `Remove from Canvas`
- 새 token 체계로 canvas surface, node, edge, selection, context menu 스타일 적용

검증:

- pan/zoom
- area select
- node drag/drop
- same subject duplicate block
- 다른 Model subject reference 표시
- editor open action

### Phase 5. Sidebar Rebuild

목표:

- Sidebar를 새 primary navigation과 Model/View 중심으로 재구성한다.

작업:

- primary nav: Home / Explorer / Canvas / Narre
- middle: bookmarks, pinned Models, pinned Views, recent Resources
- bottom: Terminal, Browser, Settings, status
- old `NetworkList`, `FileTree`, `ObjectPanel`의 일부만 재사용

검증:

- Home/Workspace 전환 명확
- Explorer/Canvas 진입 명확
- utility는 primary nav와 분리

### Phase 6. Shortcuts and Notifications

목표:

- 새 layout/view/editor scope에 맞게 shortcuts와 notification을 정리한다.

작업:

- shortcut scope rename: `network` -> `canvas/view`
- `canvasBrowse`, `canvasEdit` 추가
- ShortcutOverlay section 재구성
- native notification focus target을 새 editor tab model에 맞춤
- Toast/Confirm API 유지

검증:

- terminal/browser/editor 입력과 shortcut 충돌 없음
- modal open 상태에서 global shortcut 억제
- native notification click이 올바른 editor tab을 focus

### Phase 7. Interactive HTML / SDK Later

목표:

- MVP 이후 interactive HTML/SDK를 새 domain operation boundary 위에 얹는다.

작업:

- current interactive runtime을 reference로 새 SDK 설계
- schema/field dependency 제거
- Kind/Property/Instance/Resource 기반 SDK로 재정의
- sandbox/permission 검증
- Canvas node/view module embedding 검토

## Key Risks

1. `NetworkWorkspace` monolith

4k+ lines이고 old domain model에 강하게 묶여 있다. 직접 수정은 위험하다. 새 CanvasRenderer를 처음부터 만들고 기존 코드는 reference로만 사용한다.

2. Old naming leakage

`schema`, `meaning`, `network`, `rootNetwork`, `edge`가 renderer 곳곳에 남아 있다. 새 모델에서 `Kind`, `RelationKind`, `Model`, `View`, `CanvasEdge`로 바꾸되 compatibility layer를 짧게 둔다.

3. Shortcut conflict

main process `before-input-event`, renderer `keydown capture`, terminal input, browser input이 모두 단축키에 관여한다. 새 shortcut registry는 scope와 priority를 명확히 가져야 한다.

4. Interactive runtime mismatch

현재 interactive view는 schema/field/property 기반이다. 새 model과 맞추려면 concept만 유지하고 binding은 다시 설계해야 한다.

5. Titlebar integration

titlebar는 구현하지만 editor tab strip과 색상/경계가 끊기면 기존 Netior layout 감각이 사라진다. app chrome token을 먼저 정리해야 한다.

6. Token migration cost

renderer migration 시 token 체계 자체가 바뀐다. 기존 컴포넌트를 가져오더라도 style class를 그대로 재사용할 수 없고, 새 surface/text/border/accent/status token을 일일이 적용해야 한다. 이 작업은 단순 후처리가 아니라 각 컴포넌트 migration의 필수 단계다.

## Immediate Next Investigation

다음 조사 대상:

- `network-store.ts`와 `network-service.ts`에서 renderer가 직접 기대하는 old network API 목록
- `EditorTabType` 사용처 전체
- `SchemaEditor`, `MeaningEditor`, `InstanceEditor`에서 재사용 가능한 UI section
- `TerminalEditor` IPC surface
- `BrowserEditor` security setting과 local file URL handling
- `ShortcutRegistry` 전체 scope/key inventory
- `terminal-agent-notifier.tsx`와 main native notification focus flow
