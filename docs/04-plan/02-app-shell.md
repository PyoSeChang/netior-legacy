```yaml
date: 2026-06-26
package: desktop-app
related_area: app-shell
scope:
  - home-screen
  - workspace-screen
  - titlebar
  - layout-shell
related_files:
  - packages/desktop-app/src/renderer
  - packages/desktop-app/src/main
  - packages/desktop-app/src/preload
related_docs:
  - docs/03-ui/NETIOR_UI_LAYOUT.md
  - docs/04-plan/NETIOR_RENDERER_MIGRATION_PLAN.md
commit_ids: []
```

# Desktop App Shell

## Goal

Netior의 기본 화면 구조를 구현한다.

결과물을 한 문장으로 요약하면:

```text
Home과 Workspace가 있고, Workspace는 app chrome, sidebar, view pane, editor pane으로 나뉜다.
```

## Background

UI 문서 기준으로 Netior는 titlebar를 구현한다. 다만 titlebar와 editor tab strip이 분리된 층처럼 보이면 안 된다.

이미 합의된 원칙:

- Home Screen과 Workspace Screen만 둔다.
- Native OS titlebar처럼 보이는 titlebar는 피한다.
- Netior-owned app chrome을 둔다.
- View와 Editor가 동시에 살아있는 split workspace를 유지한다.
- Inspector는 별도 고정 panel이 아니라 editor tab/details mode다.

아직 결정되지 않은 것:

- split pane의 정확한 resize persistence
- detached editor window의 titlebar 정책

## Scope

이번 범위에 포함되는 것:

- `AppShell`
- App titlebar/chrome
- Home screen placeholder
- Workspace screen placeholder
- Activity rail placeholder
- Sidebar placeholder
- View pane placeholder
- Editor pane placeholder
- Editor tab strip placeholder
- light/dark/theme/font/i18n hook 자리

이번 범위에서 제외하는 것:

- 실제 editor forms
- Explorer/Canvas renderer
- terminal/browser editor integration
- domain service data binding

범위가 넓어질 때 다시 확인할 조건:

- titlebar 구현이 기존 Electron window controls와 충돌하는 경우
- legacy layout component를 직접 재사용하려는 경우

## Plan

### Step 1. Shell Composition

- 작업: Home/Workspace 분기와 공통 shell을 만든다.
- 완료 조건: 앱 실행 후 Home과 Workspace placeholder를 전환할 수 있다.
- 검증: renderer smoke와 수동 화면 확인.

### Step 2. App Chrome

- 작업: app titlebar, world switcher placeholder, window controls, drag region을 둔다.
- 완료 조건: titlebar가 있으며 tab strip과 같은 chrome 계층으로 보인다.
- 검증: 창 이동, window controls, click target 확인.

### Step 3. Workspace Split

- 작업: activity rail, sidebar, view pane, editor pane을 배치한다.
- 완료 조건: 빈 panel들이 안정적인 크기와 rounded layout으로 표시된다.
- 검증: desktop/mobile은 아니지만 주요 window size에서 overflow 확인.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `01-runtime-skeleton.md`
- `docs/03-ui/NETIOR_UI_LAYOUT.md`

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- shell에서 domain UI를 너무 빨리 구현하면 primitive component 없이 산발적인 UI가 생긴다.
- legacy NetworkWorkspace를 그대로 끼우면 새 ViewPane 구조가 흐려진다.

완화 방법:

- 이 단계는 placeholder만 둔다.
- ViewPane은 Explorer/Canvas 구현 전까지 빈 renderer로 유지한다.

## Validation

무엇을 확인해야 하는가?

- titlebar가 구현되었는가
- chrome과 tab strip의 시각 계층이 분리되지 않는가
- Home/Workspace 화면 구조가 분명한가

테스트 또는 수동 확인:

- Electron smoke
- window resize
- titlebar drag/window controls

## Open Questions

- [ ] world switcher placeholder를 어디까지 구현할지
- [ ] split pane size를 MVP에서 persistence할지

## Follow-up

- [ ] Primitive UI component를 만든다.
