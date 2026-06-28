```yaml
date: 2026-06-26
package: netior-service, desktop-app, netior-core
related_area: runtime-skeleton
scope:
  - service-startup
  - desktop-ipc
  - sidecar-ping
related_files:
  - packages/netior-core/src
  - packages/netior-service/src
  - packages/desktop-app/src/main
  - packages/desktop-app/src/preload
  - packages/desktop-app/src/renderer
related_docs:
  - docs/01-architecture/NETIOR_ARCHITECTURE_DRAFT.md
commit_ids: []
```

# Runtime Skeleton

## Goal

`netior-service`와 `desktop-app`이 실제로 통신하는 최소 runtime을 만든다.

결과물을 한 문장으로 요약하면:

```text
Desktop renderer에서 preload/main을 거쳐 netior-service의 ping/health를 호출할 수 있다.
```

## Background

아키텍처 문서 기준으로 desktop renderer는 service에 직접 붙는 것을 기본값으로 하지 않는다.

이미 합의된 원칙:

- renderer -> preload -> main -> service 경유를 기본값으로 한다.
- service URL/token/full API surface는 renderer에 그대로 노출하지 않는다.
- `netior-service`는 domain API와 persistence authority다.
- DB 직접 접근은 service/core 경계 안에 둔다.

아직 결정되지 않은 것:

- service port discovery 방식
- dev/prod sidecar packaging 세부 방식

## Scope

이번 범위에 포함되는 것:

- `netior-service` HTTP server skeleton
- `/health` REST endpoint
- JSON-RPC `system.ping`
- SSE placeholder endpoint
- desktop main IPC handler
- preload bridge
- renderer ping client
- sidecar manager placeholder

이번 범위에서 제외하는 것:

- domain operation
- DB migration
- resource content API
- interactive view SDK
- MCP/Narre

범위가 넓어질 때 다시 확인할 조건:

- service authentication이 필요해지는 경우
- packaged app에서 sidecar 경로를 확정해야 하는 경우

## Plan

### Step 1. Service Runtime

- 작업: HTTP server와 health/ping endpoint를 만든다.
- 완료 조건: service 단독 실행 시 health와 ping이 응답한다.
- 검증: local HTTP request와 JSON-RPC request.

### Step 2. Desktop Bridge

- 작업: main IPC handler와 preload API를 만든다.
- 완료 조건: renderer가 `window.netior.system.ping()` 같은 제한된 API를 호출한다.
- 검증: renderer smoke 화면에 ping 결과 표시.

### Step 3. Sidecar Placeholder

- 작업: desktop main에 service start/stop/health check 흐름을 둔다.
- 완료 조건: desktop 실행 시 service가 준비 상태가 된다.
- 검증: desktop app 시작 후 renderer ping 성공.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `00-repo-package-boilerplate.md`
- Electron main/preload/renderer skeleton

외부 의존성 또는 capability:

- 없음

## Risks

위험:

- renderer가 service endpoint를 직접 알게 되면 이후 security boundary가 무너진다.
- sidecar lifecycle과 domain API 구현을 동시에 하면 원인 분리가 어려워진다.

완화 방법:

- ping 외의 API는 만들지 않는다.
- service client는 main process에 먼저 둔다.

## Validation

무엇을 확인해야 하는가?

- renderer가 service에 직접 접근하지 않는가
- main이 service lifecycle을 소유하는가
- JSON-RPC/REST/SSE endpoint가 역할별로 분리되어 있는가

테스트 또는 수동 확인:

- service health request
- JSON-RPC ping
- desktop renderer ping smoke

## Open Questions

- [ ] dev port를 고정할지 동적 discovery로 갈지
- [ ] service auth token을 언제 도입할지

## Follow-up

- [ ] App shell과 primitive UI 기반을 만든다.
