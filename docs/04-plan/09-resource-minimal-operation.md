```yaml
date: 2026-06-26
package: netior-service, desktop-app
related_area: resource-operation
scope:
  - directory-open
  - resource-discovery
  - minimal-world-operation
related_files:
  - packages/netior-service/src
  - packages/desktop-app/src/main
  - packages/desktop-app/src/renderer
related_docs:
  - docs/02-domain/NETIOR_DEFINITION_MODEL.md
  - docs/02-domain/NETIOR_DOMAIN_OPERATIONS.md
commit_ids: []
```

# Resource / Minimal Operation

## Goal

외부 파일과 폴더 위에 Netior의 열린 ontology를 적용하는 최소 흐름을 만든다.

결과물을 한 문장으로 요약하면:

```text
사용자는 World directory를 열고 Resource를 발견한 뒤 Instance에 연결하고 Kind/Property/Relation을 기록할 수 있다.
```

## Background

Resource는 Instance의 원본, 위치, 근거, 내용의 출처다. Resource는 ontology relation의 endpoint가 아니다.

이미 합의된 원칙:

- World는 하나의 root directory와 연결된다.
- Directory가 자동으로 Model이 되지는 않는다.
- Resource change는 측정 대상이다.
- Instance-Resource mapping은 Evidence 자체가 아니다.
- Property value는 Resource 없이도 존재할 수 있다.

아직 결정되지 않은 것:

- file watcher를 이 단계에서 얼마나 깊게 넣을지
- fingerprint 계산 방식

## Scope

이번 범위에 포함되는 것:

- World directory open
- file/folder Resource discovery
- Resource register/list/get
- unassigned Resource query
- observed/changed/missing/ignored 상태 최소형
- REST resource content read
- create Instance from Resource
- link/unlink Resource
- assign Kind from editor/explorer
- manual Property value 입력
- Relation assertion 생성
- domain event/history 최소 기록

이번 범위에서 제외하는 것:

- AI interpretation
- automatic assignment
- full diff/snapshot engine
- resource content write stream
- external service connector

범위가 넓어질 때 다시 확인할 조건:

- sub-resource가 MVP에서 필수가 되는 경우
- large directory performance 문제가 생기는 경우

## Plan

### Step 1. Directory Open and Discovery

- 작업: World root directory를 선택하고 file/folder Resource를 등록한다.
- 완료 조건: service에서 Resource list를 조회할 수 있다.
- 검증: sample directory scan.

### Step 2. Resource to Instance Flow

- 작업: Resource에서 Instance를 만들고 link한다.
- 완료 조건: Instance-Resource mapping이 생성되고 primary Resource를 지정할 수 있다.
- 검증: create/link/unlink tests.

### Step 3. Minimal Assignment Flow

- 작업: Kind assignment, Property value, Relation assertion을 editor/API에서 수행한다.
- 완료 조건: Resource 기반 Instance에 의미를 얹을 수 있다.
- 검증: end-to-end manual flow.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `06-service-domain-operations.md`
- `07-domain-model-editors.md`

외부 의존성 또는 capability:

- filesystem access through desktop main

## Risks

위험:

- Resource discovery가 곧 자동 ontology 생성으로 오해될 수 있다.
- content read/write가 domain state를 우회할 수 있다.

완화 방법:

- discovery는 Resource 등록까지만 한다.
- 의미 해석은 assignment operation을 통해서만 기록한다.

## Validation

무엇을 확인해야 하는가?

- Resource와 Instance가 분리되어 있는가
- Resource 없는 manual property value가 가능한가
- Resource content read가 domain mutation을 우회하지 않는가

테스트 또는 수동 확인:

- sample world directory smoke
- Resource list/unassigned query
- create instance from resource
- assign kind/property/relation

## Open Questions

- [ ] fingerprint를 mtime/size 기반으로 시작할지 hash까지 할지
- [ ] ignored resource 정책을 어디에 저장할지

## Follow-up

- [ ] Explorer View를 구현한다.
