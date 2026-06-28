```yaml
date: 2026-06-26
package: desktop-app, netior-service
related_area: explorer-view
scope:
  - explorer-renderer
  - semantic-file-explorer
  - resource-assignment-surface
related_files:
  - packages/desktop-app/src/renderer
  - packages/netior-service/src
related_docs:
  - docs/02-domain/view/NETIOR_VIEW_MODEL.md
  - docs/03-ui/NETIOR_UI_LAYOUT.md
commit_ids: []
```

# Explorer View

## Goal

Netior식 의미 기반 파일 탐색기인 Explorer View를 구현한다.

결과물을 한 문장으로 요약하면:

```text
사용자는 Explorer에서 Resource, Instance, Kind assignment, 변경 신호, 미해석 대상을 함께 볼 수 있다.
```

## Background

Explorer는 단순 파일 탐색기가 아니다. 파일과 폴더만 보여주는 것이 아니라 World/Model 정의가 Resource에 어떻게 할당되어 있는지 보여준다.

이미 합의된 원칙:

- MVP ViewType은 `explorer`, `canvas`만 둔다.
- Explorer는 자유 배치 View가 아니다.
- Explorer는 tree/list/filter/detail editor 진입이 중심이다.
- View는 source of truth가 아니다.

아직 결정되지 않은 것:

- Explorer View state를 어느 정도 영속화할지
- Explorer와 Sidebar의 Model tree 책임을 어떻게 나눌지

## Scope

이번 범위에 포함되는 것:

- Explorer renderer
- World/Model tree 표시
- directory binding 표시
- Resource tree/list
- assigned/unassigned 표시
- Kind badge/icon
- Instance 연결 상태
- Relation 요약
- changed/unassigned filter
- context menu
- open editor action
- create instance / link resource / assign kind action

이번 범위에서 제외하는 것:

- Canvas layout
- automatic AI interpretation
- complex saved query builder
- timeline/evolution dedicated view

범위가 넓어질 때 다시 확인할 조건:

- Explorer가 View인지 Sidebar인지 책임이 흐려지는 경우
- large directory rendering 성능 문제가 생기는 경우

## Plan

### Step 1. Data Query

- 작업: `model.summary`, `model.listResources`, `model.listUnassignedResources` 등 Explorer query를 연결한다.
- 완료 조건: Explorer에 필요한 data shape가 service에서 나온다.
- 검증: query operation tests.

### Step 2. Explorer Renderer

- 작업: tree/list/filter UI를 구현한다.
- 완료 조건: Resource와 assignment 상태를 탐색할 수 있다.
- 검증: sample world 수동 확인.

### Step 3. Context Actions

- 작업: open editor, create instance, link resource, assign kind action을 연결한다.
- 완료 조건: Explorer에서 최소 해석 흐름이 가능하다.
- 검증: resource -> instance -> kind assignment flow.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `09-resource-minimal-operation.md`
- `07-domain-model-editors.md`

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- Explorer가 파일 탐색기에 머물 수 있다.
- Explorer가 domain mutation source of truth처럼 동작할 수 있다.

완화 방법:

- Explorer는 operation command surface로만 mutation을 호출한다.
- assignment state와 unassigned state를 1차 정보로 보여준다.

## Validation

무엇을 확인해야 하는가?

- 무엇이 있고, 무엇으로 해석됐고, 무엇이 미해석인지 보이는가
- context action이 service operation을 통해서만 동작하는가
- Resource와 Instance가 UI에서 구분되는가

테스트 또는 수동 확인:

- sample world 탐색
- unassigned filter
- create/link/assign action
- editor open action

## Open Questions

- [ ] changed filter의 source가 Resource status인지 domain event인지
- [ ] Explorer View config를 MVP에서 저장할지

## Follow-up

- [ ] Canvas View를 구현한다.
