```yaml
date: 2026-06-26
package: netior-core
related_area: domain-schema
scope:
  - definition-schema
  - assignment-schema
  - view-schema
related_files:
  - packages/netior-core/src/migrations
  - packages/netior-core/src/repositories
  - packages/shared/src/types
related_docs:
  - docs/02-domain/NETIOR_DEFINITION_MODEL.md
  - docs/02-domain/view/NETIOR_VIEW_MODEL.md
commit_ids: []
```

# New Domain Schema Migrations

## Goal

새 Netior definition, instance/resource/assignment, view 저장 모델을 DB schema로 만든다.

결과물을 한 문장으로 요약하면:

```text
World, Model, Kind, Property, RelationKind, Instance, Resource, Assignment, Evidence, View를 저장할 수 있는 schema가 생긴다.
```

## Background

새 모델은 definition과 assertion을 분리한다. Property는 value를 가지지 않고, Resource는 relation endpoint가 아니며, Relation은 Instance 사이에 생긴다.

이미 합의된 원칙:

- World와 Model은 단일 tree로 저장한다.
- World는 root directory와 연결된다.
- Model은 0개 이상의 directory binding을 가진다.
- Instance와 Resource는 분리한다.
- Evidence는 Instance-Resource mapping 자체가 아니다.
- View는 source of truth가 아니라 projection이다.

아직 결정되지 않은 것:

- 일부 table/field 이름
- hard delete와 archive 정책의 세부 구현
- built-in seed 데이터의 범위

## Scope

이번 범위에 포함되는 것:

- `world_nodes`
- `model_directory_bindings`
- `kinds`
- `properties`
- `relation_kinds`
- `instances`
- `resources`
- `instance_resource_links`
- `kind_assignments`
- `property_values`
- `relation_assertions`
- `evidence_records`
- `evidence_links`
- `decisions`
- `views`
- `canvas_node_types`
- `canvas_edge_types`
- `view_items`

이번 범위에서 제외하는 것:

- capability binding schema
- interpretation jobs
- full change event schema
- MCP/Narre 관련 schema

범위가 넓어질 때 다시 확인할 조건:

- sub-resource/sub-instance를 MVP에서 실제 구현해야 하는 경우
- ViewType 확장이 MVP에서 필요해지는 경우

## Plan

### Step 1. Definition Schema

- 작업: World/Model, directory binding, Kind, Property, RelationKind schema를 만든다.
- 완료 조건: definition table과 기본 index/constraint가 생성된다.
- 검증: migration test와 FK test.

### Step 2. Assignment Schema

- 작업: Instance, Resource, mapping, assignment, value, relation, evidence, decision schema를 만든다.
- 완료 조건: accepted/candidate 상태를 저장할 수 있다.
- 검증: duplicate accepted assignment 제약 또는 service validation test.

### Step 3. View Schema

- 작업: View, canvas type, view item schema를 만든다.
- 완료 조건: generic view model로 explorer/canvas를 수용할 수 있다.
- 검증: 같은 View 안 subject duplicate block 테스트.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `04-db-migration-foundation.md`
- `docs/02-domain/NETIOR_DEFINITION_MODEL.md`
- `docs/02-domain/view/NETIOR_VIEW_MODEL.md`

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- draft의 old `resource_ref` 중심 assertion 모델과 current `Instance` 중심 모델이 섞일 수 있다.
- `role`, `derived_from` 같은 이름이 RelationKind와 혼동될 수 있다.

완화 방법:

- current 기준 문서인 `NETIOR_DEFINITION_MODEL.md`를 우선한다.
- Instance-Resource mapping에는 `role`을 넣지 않는다.

## Validation

무엇을 확인해야 하는가?

- Property definition에 value가 없는가
- Resource가 relation endpoint가 아닌가
- Relation endpoint constraint를 service에서 검증할 수 있는 구조인가
- Evidence가 target과 분리되어 있는가

테스트 또는 수동 확인:

- migration apply test
- FK/cascade behavior test
- duplicate key/index test

## Open Questions

- [ ] accepted 상태 중복 제약을 DB unique index로 둘지 service validation으로 둘지
- [ ] archive 상태를 모든 table에 둘지 주요 target에만 둘지

## Follow-up

- [ ] Repository와 service operation을 구현한다.
