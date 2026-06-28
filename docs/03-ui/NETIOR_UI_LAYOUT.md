# Netior UI Layout

이 문서는 Netior의 MVP UI layout 방향을 정리한다.

논점은 색상 token이 아니다. 색상 token, light/dark theme, font setting, i18n은 구현 단계에서 적용할 시스템 concern이다. 이 문서의 범위는 화면 구조, app chrome, sidebar, view layout, editor layout, tab strip의 관계다.

## 결론

Netior는 두 화면을 가진다.

```text
Home Screen
Workspace Screen
```

Workspace Screen은 다음 구조를 가진다.

```text
App Titlebar / App Chrome
Activity Rail + Sidebar + View Layout + Editor Layout
```

Titlebar-less layout, 즉 별도 app titlebar 없이 View Remote와 Editor Tab Strip만으로 창 chrome을 대신하는 방식은 채택하지 않는다.

대신 Netior가 소유하는 app titlebar/app chrome row를 둔다. 다만 이 titlebar가 editor tab strip과 시각적으로 분리되어 보이면 안 된다. App chrome, view remote, editor tab strip은 같은 chrome 색상 계열을 공유하고, 강한 경계선 없이 하나의 상단 영역처럼 이어져야 한다.

```text
titlebar는 있다.
하지만 titlebar와 editor tab strip 사이에 "층"이 생기면 안 된다.
```

## Reference

기존 Netior layout은 스크린샷보다 소스 코드를 reference로 삼는다.

- App entry와 Home/Workspace 분기: `packages/desktop-app/src/renderer/App.tsx`
- Workspace shell: `packages/desktop-app/src/renderer/components/workspace/WorkspaceShell.tsx`
- Activity rail: `packages/desktop-app/src/renderer/components/sidebar/ActivityBar.tsx`
- Sidebar: `packages/desktop-app/src/renderer/components/sidebar/Sidebar.tsx`
- Editor tab strip: `packages/desktop-app/src/renderer/components/editor/EditorTabStrip.tsx`
- Window controls: `packages/desktop-app/src/renderer/components/ui/WindowControls.tsx`
- Home screen: `packages/desktop-app/src/renderer/components/home/WorldHome.tsx`

현재 legacy 구현은 `frame: false`, `titleBarStyle: hidden`을 사용한다.

- `packages/desktop-app/src/main/index.ts`

새 방향은 기존 Netior의 rounded pane, rounded tab, split workspace 감각을 유지하되, dedicated app titlebar를 추가하는 것이다. Native OS titlebar를 그대로 쓰는 것이 아니라, Netior가 제어하는 app chrome을 기본 전제로 한다. 그래야 editor tab strip과 chrome의 색상 통일, drag region, window controls 배치를 일관되게 설계할 수 있다.

## Screen Structure

### Home Screen

Home Screen은 World를 열기 전 또는 World를 선택하는 화면이다.

역할:

- 최근 World 표시
- World 생성
- directory에서 World 열기
- app settings 진입
- theme/font/language 설정 진입

Home Screen에도 app titlebar/app chrome은 존재한다. Workspace와 다른 완전한 landing page가 아니라, 같은 app shell 위에서 World 선택 surface를 보여주는 화면이다.

### Workspace Screen

Workspace Screen은 실제 작업 화면이다.

구조:

```text
App Titlebar
├─ Activity Rail
├─ Sidebar
└─ Main Workspace
   ├─ View Pane
   │  ├─ View Remote
   │  └─ Explorer / Canvas
   └─ Editor Pane
      ├─ Editor Tab Strip
      └─ Editor Content
```

View Pane과 Editor Pane은 split layout으로 공존할 수 있다. Netior는 View와 Editor가 동시에 살아있는 앱이다. View는 세계를 보여주고 조작하는 projection이고, Editor는 subject의 상세 확인과 편집 surface다.

## App Titlebar / App Chrome

Titlebar는 구현한다.

하지만 titlebar는 독립된 검은 막대나 OS chrome처럼 튀면 안 된다. 사진 reference처럼 editor tab strip과 app chrome의 경계가 거의 없어야 한다.

Titlebar가 담당할 것:

- app mark / app name
- current World switcher
- global command/search entry
- sync/status
- settings 또는 app menu 진입
- window controls
- drag region

Titlebar가 담당하지 않을 것:

- View 조작
- Canvas zoom/mode 조작
- Editor tab 조작
- Instance/Resource/Kind domain operation

View 조작은 View Remote가 담당하고, editor tab 조작은 Editor Tab Strip이 담당한다.

### Visual Integration Rule

App Titlebar, View Remote, Editor Tab Strip은 같은 chrome 계층이다.

따라서 다음을 피한다.

- titlebar와 tab strip 사이의 강한 border
- titlebar만 다른 배경색
- titlebar 아래 별도 shadow
- app chrome이 editor보다 한 층 위에 떠 보이는 효과
- OS native titlebar처럼 보이는 색상/높이

권장:

- titlebar와 tab strip은 같은 background token을 사용한다.
- 필요한 divider는 아주 약하게 둔다.
- active tab은 editor body와 자연스럽게 이어진다.
- inactive tab은 chrome 위에 얹힌 낮은 contrast surface로 보인다.
- 창 제어 버튼은 titlebar 오른쪽에 고정하되 시각적으로 조용해야 한다.

## Rounded Layout

Netior는 딱딱하고 compact한 IDE보다 rounded workspace에 가깝다.

유지할 것:

- 둥근 sidebar panel
- 둥근 View/Editor pane
- 둥근 tab shape
- Chrome tab처럼 active tab이 content와 이어지는 형태
- canvas/editor split 사이의 부드러운 resize handle
- 어두운 작업면 위의 dot grid canvas

피할 것:

- 사각형 pane을 빽빽하게 붙인 전통 IDE layout
- toolbar와 tab strip을 층층이 쌓는 구조
- sidebar를 완전히 별도 앱처럼 고립시키는 강한 배경 차이
- landing page 같은 hero UI

## Sidebar

Sidebar는 프레임과 통합되지만 구조적으로는 명확한 영역이다.

```text
Activity Rail
Sidebar Panel
```

Activity Rail은 icon 중심의 primary navigation이고, Sidebar Panel은 현재 primary navigation에 대응하는 상세 tree/list/bookmark surface다.

Sidebar의 큰 배치는 다음과 같다.

```text
Top
- primary navigation

Middle
- bookmarks
- pinned Models
- pinned Views
- recent Resources
- saved queries

Bottom
- utilities
- terminal
- browser
- settings
- account/status
```

MVP primary navigation:

- Home / Worlds
- Explorer
- Canvas
- Narre

넣지 않을 것:

- Kind Editor
- Instance Editor
- RelationKind Editor
- Terminal
- Browser
- Settings
- Diff
- Interactive View

이들은 primary navigation이 아니라 editor tab, utility, context action, 또는 View 내부 action이다.

## View Layout

MVP ViewType은 다음 두 개다.

```ts
type ViewType = 'explorer' | 'canvas'
```

View Pane은 View Remote와 View Renderer로 구성된다.

```text
View Pane
├─ View Remote
└─ Explorer 또는 Canvas
```

View Remote는 app titlebar가 아니다. View Remote는 현재 View를 조작하는 리모콘이다.

공통 기능:

- View 이름
- ViewType 전환
- View 생성/설정
- search/filter
- refresh
- command menu

Canvas 기능:

- browse/edit mode
- zoom in/out
- zoom to fit
- grid
- auto layout
- selection/group/lock

Explorer 기능:

- tree/list
- unassigned filter
- changed filter
- group by
- sort
- detect changes

View Remote의 색상은 app chrome과 이어져야 하지만, 책임은 app chrome과 다르다.

## Editor Layout

Editor는 별도 inspector panel이 아니다. Netior에서 상세 확인과 편집은 editor tab으로 열린다.

Editor Pane은 다음 구조다.

```text
Editor Pane
├─ Editor Tab Strip
└─ Editor Content
```

Editor Tab Strip은 app chrome과 같은 색상 계열을 공유한다. Titlebar가 있더라도 tab strip과 분리되어 보이면 안 된다.

Editor tab은 Chrome tab처럼 rounded shape를 가진다. Active tab은 editor content와 이어져야 하고, inactive tab은 낮은 contrast로 뒤에 놓인다.

Editor 대상:

- Instance
- Resource/File
- Kind
- RelationKind
- Model
- World
- Terminal
- Browser
- Narre
- Interactive mode
- Details mode

Canvas에서 subject를 double click하거나 context action을 실행하면, 별도 inspector가 아니라 해당 editor tab을 연다.

## Theme, Font, I18n

이 문서는 layout 문서이므로 color token 세부값을 확정하지 않는다.

구현 시 요구:

- light/dark theme 선택 가능
- app font 설정 가능
- document font 설정 가능
- terminal font 설정 가능
- diff font 설정 가능
- i18n 적용 가능

Theme과 font는 layout 구조를 깨지 않아야 한다. 특히 font 변경으로 인해 titlebar, tab, sidebar row, view remote control이 overflow되면 안 된다.

## Implementation Notes

기존 Netior 코드는 titlebar-less에 가까운 구조를 가진다.

- `WorkspaceShell`은 activity rail, sidebar, network/view pane, editor pane을 조합한다.
- `EditorTabStrip`은 tab strip과 right slot을 제공한다.
- `WindowControls`는 현재 tab strip/right slot에 주입될 수 있다.
- `WorldHome`도 window controls를 받을 수 있다.

새 방향에서는 dedicated app titlebar를 추가한다. 다만 기존 `EditorTabStrip`과 `WorkspaceShell`의 rounded tab/pane 감각은 reference로 유지한다.

구현 시 검토할 사항:

- app titlebar를 `WorkspaceShell` 바깥의 공통 shell로 둘지
- Home Screen과 Workspace Screen이 같은 titlebar component를 공유할지
- titlebar drag region과 interactive controls의 충돌 처리
- window controls 위치를 titlebar 오른쪽으로 고정할지
- detached editor window에도 같은 titlebar policy를 적용할지
- View Remote와 Editor Tab Strip의 chrome token을 titlebar와 통일할지

## MVP Decision

- Titlebar는 구현한다.
- Native OS titlebar처럼 보이게 하지 않고 Netior-owned app chrome으로 만든다.
- App titlebar와 editor tab strip 사이의 강한 경계는 두지 않는다.
- App titlebar, View Remote, Editor Tab Strip은 같은 chrome 색상 계층을 공유한다.
- 기존 Netior의 rounded pane, rounded tab, split workspace 감각은 유지한다.
- Sidebar는 frame과 시각적으로 통합하되 구조적으로는 Activity Rail과 Sidebar Panel을 유지한다.
- Home Screen과 Workspace Screen만 만든다.
