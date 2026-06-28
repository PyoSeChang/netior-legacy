```yaml
date: 2026-06-26
package: desktop-app, netior-service
related_area: canvas-view
scope:
  - canvas-renderer
  - view-items
  - network-projection
related_files:
  - packages/desktop-app/src/renderer
  - packages/netior-service/src
related_docs:
  - docs/02-domain/view/NETIOR_VIEW_MODEL.md
  - docs/04-plan/NETIOR_RENDERER_MIGRATION_PLAN.md
commit_ids: []
```

# Canvas View

## Goal

Netior의 network 철학을 source of truth가 아닌 projection으로 구현한다.

결과물을 한 문장으로 요약하면:

```text
Canvas는 Kind, RelationKind, Instance, Resource, Relation을 배치해 보는 View이며 world data를 소유하지 않는다.
```

## Background

기존 `NetworkWorkspace`는 old network/domain model과 강하게 결합되어 있으므로 직접 migration하지 않는다. 새 Canvas는 View model 기준으로 만든다.

이미 합의된 원칙:

- Canvas는 View의 한 종류다.
- 같은 Canvas 안 같은 subject 중복 배치는 MVP에서 금지한다.
- visual-only edge는 MVP에서 금지한다.
- Browse mode와 Edit mode를 분리한다.
- Edit mode에서는 domain operation/capability action을 실행하지 않는다.
- Inspector는 별도 panel이 아니라 editor tab이다.

아직 결정되지 않은 것:

- node resize를 MVP에 넣을지
- group/ungroup을 최소형으로 넣을지

## Scope

이번 범위에 포함되는 것:

- View persistence 연결
- `view_items` load/save
- built-in canvas node types
- built-in canvas edge types
- Canvas renderer
- pan/zoom
- browse/edit mode
- node drag/drop
- area select
- relation edge display
- resource mapping edge display
- context menu
- hide/remove from canvas
- open editor action
- same subject duplicate block

이번 범위에서 제외하는 것:

- visual-only edge
- custom node type editor UI
- calendar/gantt/timeline ViewType
- interactive HTML embedding inside canvas
- auto layout advanced plugin

범위가 넓어질 때 다시 확인할 조건:

- 같은 subject alias/portal이 실제 workflow에서 필요한 경우
- canvas extension UI가 MVP에 필요해지는 경우

## Plan

### Step 1. View Item Persistence

- 작업: Canvas node/edge item load/save operation을 연결한다.
- 완료 조건: subject 배치와 hidden/locked/collapsed 상태를 저장할 수 있다.
- 검증: reload 후 layout 유지.

### Step 2. Canvas Interaction

- 작업: pan/zoom, browse/edit, drag/drop, area select를 구현한다.
- 완료 조건: 배치 편집과 읽기 조작이 분리된다.
- 검증: browse mode에서 domain action, edit mode에서 layout action 확인.

### Step 3. Canvas Actions

- 작업: context menu, open editor, hide/remove, edge display를 연결한다.
- 완료 조건: Canvas가 relation projection과 editor 진입 surface로 동작한다.
- 검증: sample relation display와 context action.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `10-explorer-view.md`
- `05-domain-schema-migrations.md`
- `06-service-domain-operations.md`

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- Canvas가 다시 앱 전체의 engine이 될 수 있다.
- old NetworkWorkspace를 재사용하다가 legacy model이 섞일 수 있다.

완화 방법:

- CanvasRenderer를 새로 구현하고 old canvas는 reference로만 사용한다.
- 모든 subject data는 service query에서 가져오고 layout만 View가 저장한다.

## Validation

무엇을 확인해야 하는가?

- CanvasNode가 subject 자체를 소유하지 않는가
- same subject duplicate block이 동작하는가
- Hide/Remove/Archive가 구분되는가
- edit mode에서 domain operation이 실행되지 않는가

테스트 또는 수동 확인:

- pan/zoom/drag
- area select
- relation edge display
- hide/remove
- reload layout

## Open Questions

- [ ] node resize MVP 포함 여부
- [ ] group node와 model_group의 초기 범위

## Follow-up

- [ ] MVP hardening 단계로 넘어간다.
