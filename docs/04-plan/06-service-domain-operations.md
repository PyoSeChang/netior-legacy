```yaml
date: 2026-06-26
package: netior-service, netior-core, shared
related_area: domain-operations
scope:
  - repositories
  - json-rpc
  - validation
related_files:
  - packages/netior-core/src/repositories
  - packages/netior-service/src
  - packages/shared/src/types
related_docs:
  - docs/02-domain/NETIOR_DOMAIN_OPERATIONS.md
  - docs/01-architecture/NETIOR_ARCHITECTURE_DRAFT.md
commit_ids: []
```

# Core Repositories / Service Domain Operations

## Goal

UI 없이도 새 world를 정의하고 assignment를 기록할 수 있는 service operation을 구현한다.

결과물을 한 문장으로 요약하면:

```text
JSON-RPC로 World/Model/Kind/Property/RelationKind/Instance/Resource/Assignment/Evidence/Decision의 최소 operation을 호출할 수 있다.
```

## Background

View보다 먼저 world operation API가 필요하다. Desktop UI, future MCP, interactive HTML은 모두 이 operation 위에 올라가야 한다.

이미 합의된 원칙:

- Domain logic은 service/core에만 둔다.
- Transport adapter는 얇아야 한다.
- CRUD도 world의 동작이다.
- accepted relation은 endpoint Kind constraint를 만족해야 한다.
- AI 또는 자동 생성 판단은 기본적으로 candidate다.

아직 결정되지 않은 것:

- JSON-RPC method 이름의 최종 namespace
- candidate 공통 operation을 언제 도입할지

## Scope

이번 범위에 포함되는 것:

- World/Model tree operation
- Directory binding operation
- Kind operation
- Property operation
- RelationKind operation
- Instance operation
- Resource operation
- Instance-Resource mapping
- Kind assignment
- Property value
- Relation assertion
- Evidence
- Decision
- validation operation 최소형
- query operation 최소형

이번 범위에서 제외하는 것:

- full change detection
- interpretation job
- capability execution
- MCP/Narre adapters
- View renderer

범위가 넓어질 때 다시 확인할 조건:

- service operation이 UI 요구 때문에 비대해지는 경우
- validation이 DB constraint로 충분하지 않은 경우

## Plan

### Step 1. Repository Layer

- 작업: 각 schema group별 repository를 만든다.
- 완료 조건: DB test로 CRUD와 기본 constraint가 검증된다.
- 검증: repository tests.

### Step 2. Application Service

- 작업: visibility, endpoint, cardinality validation이 들어간 service layer를 만든다.
- 완료 조건: 잘못된 assignment/relation이 accepted되지 않는다.
- 검증: service tests.

### Step 3. JSON-RPC Adapter

- 작업: domain operation을 JSON-RPC method로 연결한다.
- 완료 조건: service process에 HTTP JSON-RPC로 operation 호출이 가능하다.
- 검증: JSON-RPC integration tests.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `05-domain-schema-migrations.md`
- `docs/02-domain/NETIOR_DOMAIN_OPERATIONS.md`

외부 의존성 또는 capability:

- JSON schema validation library 후보

## Risks

위험:

- JSON-RPC handler 안에 domain logic이 들어갈 수 있다.
- View 요구를 먼저 반영하면 operation이 projection 전용으로 치우칠 수 있다.

완화 방법:

- handler -> application service -> repository 구조를 강제한다.
- View query는 별도 query operation으로만 둔다.

## Validation

무엇을 확인해야 하는가?

- Kind visibility가 적용되는가
- Relation endpoint constraint가 적용되는가
- Property value가 Instance의 accepted Kind와 호환되는가
- Evidence와 Decision 이력이 남는가

테스트 또는 수동 확인:

- repository tests
- service operation tests
- JSON-RPC integration tests

## Open Questions

- [ ] operation naming을 `kind.create`처럼 유지할지 `definition.kind.create`처럼 묶을지
- [ ] archive와 delete의 API 이름을 어떻게 구분할지

## Follow-up

- [ ] Domain model editor를 구현한다.
