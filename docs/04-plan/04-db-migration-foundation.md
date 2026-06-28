```yaml
date: 2026-06-26
package: netior-core
related_area: db-migration
scope:
  - sqlite
  - migration-runner
  - repository-base
related_files:
  - packages/netior-core/src/db
  - packages/netior-core/src/migrations
  - packages/netior-core/src/repositories
  - packages/netior-core/src/test
related_docs:
  - docs/01-architecture/NETIOR_ARCHITECTURE_DRAFT.md
commit_ids: []
```

# DB / Migration Foundation

## Goal

새 domain schema를 안전하게 추가하고 검증할 수 있는 DB/migration 기반을 만든다.

결과물을 한 문장으로 요약하면:

```text
빈 SQLite DB에 migration을 적용하고 repository test를 in-memory로 실행할 수 있다.
```

## Background

Migration은 후반 데이터 이전만 뜻하지 않는다. 새 domain model을 안정적으로 진화시키는 초기 기반이다.

이미 합의된 원칙:

- DB/native binding의 runtime owner는 service다.
- core는 repository/migration library다.
- 이미 적용된 migration은 수정하지 않고 새 migration을 추가한다.
- SQLite는 WAL과 busy_timeout을 사용한다.

아직 결정되지 않은 것:

- 기존 DB 파일을 그대로 이어갈지 새 DB로 시작할지
- legacy migration과 새 migration namespace를 어떻게 나눌지

## Scope

이번 범위에 포함되는 것:

- SQLite connection wrapper
- migration tracking table
- migration runner
- transaction helper
- repository base pattern
- test DB helper
- in-memory DB test
- seed/built-in source reference 자리

이번 범위에서 제외하는 것:

- 실제 domain schema 전체
- legacy data migration
- service API operation

범위가 넓어질 때 다시 확인할 조건:

- 기존 applied migration과 충돌하는 경우
- 새 DB를 별도 파일로 분리해야 하는 경우

## Plan

### Step 1. Connection and Pragmas

- 작업: DB open, WAL, foreign_keys, busy_timeout 설정을 만든다.
- 완료 조건: service/core에서 동일 wrapper를 사용할 수 있다.
- 검증: in-memory DB open test.

### Step 2. Migration Runner

- 작업: migration table과 apply runner를 만든다.
- 완료 조건: migration이 idempotent하게 적용된다.
- 검증: 같은 migration runner를 두 번 실행해도 성공.

### Step 3. Repository Test Base

- 작업: test DB helper와 transaction helper를 둔다.
- 완료 조건: repository test가 독립 DB에서 실행된다.
- 검증: placeholder repository test.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `00-repo-package-boilerplate.md`
- `01-runtime-skeleton.md`

외부 의존성 또는 capability:

- `better-sqlite3`

## Risks

위험:

- DB 소유권이 desktop으로 새면 architecture boundary가 깨진다.
- legacy migration과 새 migration이 섞여 이해하기 어려워질 수 있다.

완화 방법:

- desktop-app은 DB를 직접 열지 않는다.
- migration naming과 applied tracking을 명확히 한다.

## Validation

무엇을 확인해야 하는가?

- migration 적용 순서가 안정적인가
- foreign key가 켜져 있는가
- test DB가 빠르게 초기화되는가

테스트 또는 수동 확인:

- migration runner test
- transaction rollback test
- in-memory repository test

## Open Questions

- [ ] 새 DB 파일을 기존 `%APPDATA%/netior`와 어떻게 구분할지
- [ ] legacy DB migration은 같은 runner에 둘지 별도 importer로 둘지

## Follow-up

- [ ] New domain schema migrations를 작성한다.
