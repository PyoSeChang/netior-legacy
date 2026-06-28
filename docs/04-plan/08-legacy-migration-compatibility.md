```yaml
date: 2026-06-26
package: netior-core, desktop-app
related_area: legacy-migration
scope:
  - old-schema
  - old-meaning
  - old-network
  - compatibility
related_files:
  - packages/netior-core/src/migrations
  - packages/desktop-app/src/renderer/components
related_docs:
  - docs/02-domain/NETIOR_DEFINITION_MODEL.md
  - docs/05-development-log/00-새출발.md
commit_ids: []
```

# Legacy Migration / Compatibility

## Goal

기존 Netior 자산 중 새 모델로 옮길 것과 버릴 것을 분리하고 최소 migration path를 만든다.

결과물을 한 문장으로 요약하면:

```text
legacy schema/meaning/network 자산을 새 World/Model/Kind/Resource/Assignment 모델로 옮기거나 격리하는 기준이 생긴다.
```

## Background

새 모델은 기존 Netior를 그대로 확장하는 것이 아니다. 특히 `meaning`과 `schema_field_bindings` 복잡도를 새 모델에 그대로 이식하면 안 된다.

이미 합의된 원칙:

- Instance content를 강하게 소유하지 않는다.
- `schema_field_bindings`식 범용 behavior 계층을 그대로 재현하지 않는다.
- Canvas/network는 source of truth가 아니라 projection이다.
- old editor/menu는 새 모델을 흐리면 숨기거나 migration-only로 둔다.

아직 결정되지 않은 것:

- 기존 DB를 자동 변환할지 수동 importer로 둘지
- old meaning 중 definition 계층으로 남길 범위

## Scope

이번 범위에 포함되는 것:

- old rootNetwork/world -> `world_nodes` mapping 전략
- old schema -> Kind 후보 mapping
- old schema field -> Property 후보 mapping
- old concept/instance -> Instance/Resource 후보 mapping
- old relationship/edge -> RelationKind/RelationAssertion 후보 mapping
- old meaning -> 유지/폐기/외부화 분류
- old interactive view -> Resource/editor/runtime migration 후보
- compatibility UI 숨김/격리 전략

이번 범위에서 제외하는 것:

- 완전 자동 migration 보장
- Narre/MCP migration
- 모든 old network layout 복원

범위가 넓어질 때 다시 확인할 조건:

- 기존 사용자 데이터 보존이 MVP 필수 요구가 되는 경우
- old interactive view를 즉시 실행해야 하는 경우

## Plan

### Step 1. Inventory

- 작업: old DB table, renderer editor, network canvas 의존성을 목록화한다.
- 완료 조건: keep/adapt/replace/delete 분류가 생긴다.
- 검증: `rg` 기반 사용처 목록과 문서화.

### Step 2. Mapping Draft

- 작업: old schema/meaning/network object를 새 모델로 옮기는 mapping을 작성한다.
- 완료 조건: 자동 가능/수동 필요/보류 대상이 구분된다.
- 검증: 샘플 DB 또는 fixture로 dry-run.

### Step 3. Compatibility Boundary

- 작업: old UI/route/API를 숨기거나 migration-only로 격리한다.
- 완료 조건: 새 UI에서 old model을 primary path로 노출하지 않는다.
- 검증: renderer navigation과 editor route 확인.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `05-domain-schema-migrations.md`
- `07-domain-model-editors.md`
- legacy codebase inventory

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- migration을 핑계로 old meaning/field binding 복잡도가 되살아날 수 있다.
- old network layout을 보존하려다 Canvas가 다시 engine이 될 수 있다.

완화 방법:

- current definition model을 기준으로 옮길 수 없는 것은 보류한다.
- old canvas layout은 view projection 후보로만 다룬다.

## Validation

무엇을 확인해야 하는가?

- Property definition에 value가 들어가지 않는가
- Meaning/field binding이 새 model에 그대로 복제되지 않는가
- old network가 source of truth로 남지 않는가

테스트 또는 수동 확인:

- migration dry-run
- compatibility route check
- old key/name 사용처 `rg`

## Open Questions

- [ ] old DB를 자동 migrate할 최소 버전 범위
- [ ] old meaning category를 새 모델에서 어떤 이름으로 다룰지

## Follow-up

- [ ] Resource minimal operation을 구현한다.
