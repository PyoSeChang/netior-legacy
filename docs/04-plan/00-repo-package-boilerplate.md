```yaml
date: 2026-06-26
package: netior
related_area: boilerplate
scope:
  - workspace
  - package-boundary
  - build-system
related_files:
  - package.json
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - packages/shared
  - packages/netior-core
  - packages/netior-service
  - packages/desktop-app
related_docs:
  - docs/00-product/NETIOR_PHILOSOPHY.md
  - docs/01-architecture/NETIOR_ARCHITECTURE_DRAFT.md
commit_ids: []
```

# Repo / Package Boilerplate

## Goal

새 Netior를 개발할 수 있는 최소 monorepo 골격을 만든다.

결과물을 한 문장으로 요약하면:

```text
아무 도메인 기능이 없어도 shared, core, service, desktop-app 패키지가 build/typecheck/test 가능한 상태가 된다.
```

## Background

새 Netior MVP는 `mcp`, `narre-server`를 제외하고 시작한다.

이미 합의된 원칙:

- 초기 MVP package는 `shared`, `netior-core`, `netior-service`, `desktop-app`만 둔다.
- `netior-service`가 domain state와 persistence의 권위자다.
- `desktop-app`은 UI와 OS host다.
- MCP와 Narre는 service contract가 안정된 뒤 붙는 client/runtime이다.

아직 결정되지 않은 것:

- 기존 repo 위에서 점진 개편할지, 새 workspace branch처럼 정리할지
- legacy package를 즉시 제거할지, compatibility로 남길지

## Scope

이번 범위에 포함되는 것:

- `pnpm` workspace 구성
- package skeleton 생성
- TypeScript 설정
- build/typecheck/test script
- package exports
- path alias 초안
- Vitest 최소 설정

이번 범위에서 제외하는 것:

- 실제 DB schema
- Electron UI 구현
- domain operation 구현
- MCP/Narre package

범위가 넓어질 때 다시 확인할 조건:

- 기존 legacy package와 새 package가 동시에 build되어야 하는 경우
- package naming을 기존 `@netior/core`와 호환해야 하는 경우

## Plan

### Step 1. Workspace Skeleton

- 작업: root `package.json`, `pnpm-workspace.yaml`, 공통 scripts를 정리한다.
- 완료 조건: `pnpm install`과 `pnpm typecheck`가 빈 패키지 기준으로 실행된다.
- 검증: root command가 package resolution 오류 없이 완료된다.

### Step 2. Package Skeleton

- 작업: `packages/shared`, `packages/netior-core`, `packages/netior-service`, `packages/desktop-app`를 만든다.
- 완료 조건: 각 package가 자체 `package.json`과 `src/index.ts`를 가진다.
- 검증: 각 package import/export가 TypeScript에서 해석된다.

### Step 3. Build/Test Base

- 작업: tsconfig, build script, Vitest scaffold를 둔다.
- 완료 조건: 최소 placeholder test가 통과한다.
- 검증: `pnpm build`, `pnpm typecheck`, `pnpm test`.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `docs/01-architecture/NETIOR_ARCHITECTURE_DRAFT.md`
- Node.js, pnpm, TypeScript

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- legacy package 이름과 새 package 이름이 충돌할 수 있다.
- build 설정을 과하게 만들면 이후 migration이 무거워진다.

완화 방법:

- 기능 구현 없이 package boundary와 command만 먼저 통과시킨다.
- MCP/Narre는 package skeleton에서도 제외한다.

## Validation

무엇을 확인해야 하는가?

- package import 경계가 명확한가
- root command가 안정적으로 도는가
- desktop이 아직 service logic을 직접 소유하지 않는 구조인가

테스트 또는 수동 확인:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## Open Questions

- [ ] 기존 legacy package를 같은 workspace에 둘지 분리할지
- [ ] package 이름을 기존 이름 그대로 유지할지 새 이름으로 시작할지

## Follow-up

- [ ] Runtime skeleton 단계로 넘어간다.
