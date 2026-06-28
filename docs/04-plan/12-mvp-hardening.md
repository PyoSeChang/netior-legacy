```yaml
date: 2026-06-26
package: netior
related_area: mvp-hardening
scope:
  - build
  - tests
  - qa
  - documentation-sync
related_files:
  - packages/shared
  - packages/netior-core
  - packages/netior-service
  - packages/desktop-app
related_docs:
  - docs/06-test/README.md
  - docs/05-development-log/README.md
commit_ids: []
```

# MVP Hardening

## Goal

세상 정의, 최소 동작, Explorer/Canvas View가 하나의 안정적인 MVP 흐름으로 동작하게 만든다.

결과물을 한 문장으로 요약하면:

```text
사용자는 World를 열고 정의를 만들고 Resource에 할당하고 Explorer/Canvas에서 확인할 수 있다.
```

## Background

MVP hardening은 기능 추가 단계가 아니라, 앞 단계들이 하나의 제품 흐름으로 연결되는지 확인하는 단계다.

이미 합의된 원칙:

- 일반 사용자가 ontology 구축 비용을 낮게 느껴야 한다.
- AI 없이도 world definition, manual assignment, view 탐색이 가능해야 한다.
- 미확정 설계는 테스트 기준으로 고정하지 않는다.
- UI 결정이 domain/product 결정을 대체하지 않는다.

아직 결정되지 않은 것:

- release artifact 기준
- packaged desktop smoke 범위

## Scope

이번 범위에 포함되는 것:

- typecheck/build 안정화
- migration tests
- repository tests
- service operation tests
- renderer smoke tests
- 핵심 user flow QA
- empty/loading/error state
- confirmation 필요한 mutation 확인
- 문서와 구현 차이 정리

이번 범위에서 제외하는 것:

- MCP/Narre integration
- advanced capability/SDK
- interactive HTML sandbox
- full AI validation loop

범위가 넓어질 때 다시 확인할 조건:

- MVP에서 AI translator가 필수로 요구되는 경우
- 기존 사용자 데이터 migration이 release blocker가 되는 경우

## Plan

### Step 1. Automated Checks

- 작업: typecheck, build, unit/integration tests를 정리한다.
- 완료 조건: root command가 안정적으로 통과한다.
- 검증: CI 또는 local full check.

### Step 2. MVP User Flow QA

- 작업: World open -> definition -> resource -> assignment -> explorer -> canvas 흐름을 검증한다.
- 완료 조건: 한 sample world에서 끝까지 수행 가능하다.
- 검증: manual QA checklist.

### Step 3. Documentation Sync

- 작업: 구현과 문서 차이를 정리하고 development log를 남긴다.
- 완료 조건: docs가 현재 구현의 책임 경계를 반영한다.
- 검증: docs review.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `00-repo-package-boilerplate.md`부터 `11-canvas-view.md`까지
- `docs/06-test/README.md`

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- hardening 단계에서 새 기능을 계속 넣으면 MVP가 끝나지 않는다.
- 테스트가 UI snapshot에 치우치면 domain model 검증이 약해진다.

완화 방법:

- hardening은 버그 수정과 검증으로 제한한다.
- 핵심 flow 테스트를 우선한다.

## Validation

무엇을 확인해야 하는가?

- World/Model/Kind/RelationKind 정의가 가능하다.
- Resource와 Instance가 분리되어 동작한다.
- Kind assignment, Property value, Relation assertion이 기록된다.
- Evidence/Decision 기본 흐름이 보존된다.
- Explorer와 Canvas가 source of truth가 아니라 projection으로 동작한다.

테스트 또는 수동 확인:

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- service operation integration
- desktop smoke
- sample world manual QA

## Open Questions

- [ ] MVP release 전에 packaged installer까지 검증할지
- [ ] docs와 구현 차이를 development log 하나로 남길지 단계별로 남길지

## Follow-up

- [ ] Capability/SDK, interactive HTML, AI translator/actor/validator, MCP/Narre integration을 후속 roadmap으로 분리한다.
