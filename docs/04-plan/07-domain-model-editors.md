```yaml
date: 2026-06-26
package: desktop-app
related_area: domain-editors
scope:
  - model-editor
  - kind-editor
  - relation-kind-editor
  - instance-editor
related_files:
  - packages/desktop-app/src/renderer/components/editor
  - packages/desktop-app/src/renderer/services
  - packages/desktop-app/src/renderer/stores
related_docs:
  - docs/02-domain/NETIOR_DEFINITION_MODEL.md
  - docs/03-ui/NETIOR_UI_LAYOUT.md
commit_ids: []
```

# Domain Model Editors

## Goal

사용자가 새 Netior의 세계 정의와 기본 assignment를 form editor로 만들고 수정할 수 있게 한다.

결과물을 한 문장으로 요약하면:

```text
Workspace에서 Model, Kind, Property, RelationKind, Instance, Resource를 editor tab으로 열고 편집할 수 있다.
```

## Background

Netior에서 상세 확인과 편집은 별도 inspector panel이 아니라 editor system에 속한다.

이미 합의된 원칙:

- Domain editor는 form surface다.
- Inspector는 별도 고정 panel이 아니다.
- `SchemaEditor`, `MeaningEditor`는 새 모델과 직접 호환되지 않는다.
- Property는 value를 가지지 않는다.
- Instance editor에서 property value와 assignment를 다룬다.

아직 결정되지 않은 것:

- 기존 editor-store를 얼마나 유지할지
- dirty/save flow를 optimistic하게 할지 explicit save로 할지

## Scope

이번 범위에 포함되는 것:

- `WorldEditor`
- `ModelEditor`
- `KindEditor`
- `PropertyEditor` section
- `RelationKindEditor`
- `InstanceEditor`
- `ResourceDetailsEditor`
- Evidence/Decision 최소 표시
- editor tab routing
- form validation
- icon 설정
- service client 연결

이번 범위에서 제외하는 것:

- full Explorer
- Canvas
- interactive HTML runtime
- AI suggestion UI

범위가 넓어질 때 다시 확인할 조건:

- Evidence/Decision editor가 별도 surface를 요구하는 경우
- Instance editor에서 relation graph가 필요해지는 경우

## Plan

### Step 1. Editor Routing

- 작업: 새 `EditorTabType`과 route를 추가한다.
- 완료 조건: placeholder editor tab을 열고 닫을 수 있다.
- 검증: tab lifecycle smoke.

### Step 2. Definition Editors

- 작업: Model/Kind/Property/RelationKind form을 만든다.
- 완료 조건: UI에서 definition CRUD가 가능하다.
- 검증: service mock 또는 실제 service로 CRUD 확인.

### Step 3. Instance/Resource Editors

- 작업: Instance, Resource, assignment, property value, relation 최소 editor를 만든다.
- 완료 조건: 기본 assignment flow를 editor에서 수행할 수 있다.
- 검증: create instance, link resource, assign kind, add property value.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `03-primitive-ui-components.md`
- `06-service-domain-operations.md`

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- editor가 service validation을 우회할 수 있다.
- old Schema/Meaning UI가 새 개념에 섞일 수 있다.

완화 방법:

- 모든 mutation은 service operation을 통해서만 수행한다.
- legacy editor는 migration-only 또는 hidden으로 격리한다.

## Validation

무엇을 확인해야 하는가?

- 사용자가 World/Model/Kind/RelationKind를 만들 수 있는가
- Property form에 value field가 없는가
- Instance에서 Kind assignment와 property value를 구분하는가
- Resource link가 Evidence로 표시되지 않는가

테스트 또는 수동 확인:

- editor smoke
- form validation
- service operation integration

## Open Questions

- [ ] save flow를 auto-save로 갈지 explicit save로 갈지
- [ ] Instance editor에서 relation creation UX를 어떻게 둘지

## Follow-up

- [ ] Legacy migration과 compatibility bridge를 정리한다.
