# Netior Architecture Draft

이 문서는 새 Netior 도메인 모델을 전제로 한 아키텍처 초안이다.

목적은 구현 세부를 확정하는 것이 아니라, 앞으로 Netior가 어떤 프로세스 경계와 API 경계, 실행 경계 위에서 발전해야 하는지 정리하는 것이다.

## 핵심 판단

Electron desktop app은 유지한다.

Netior는 여전히 local-first desktop app이어야 한다. 사용자는 파일 시스템, 터미널, 브라우저, 로컬 AI/agent 실행, interactive view 같은 OS와 가까운 기능을 자연스럽게 써야 한다. Electron은 이 표면을 제공하기에 적합하다.

동시에 Netior의 domain service는 desktop app 안에 섞이지 않고 별도 service package로 분리되어야 한다.

이유는 Netior service의 client가 하나가 아니기 때문이다.

- Desktop app
- MCP server
- Narre / agent runtime
- Interactive view runtime
- 향후 mobile, web, external connector

따라서 Netior의 권위 있는 domain state와 persistence는 `netior-service`가 소유하고, 다른 구성 요소들은 service client 또는 adapter로 동작해야 한다.

## 전체 구조

목표 구조는 다음과 같다.

```text
desktop-app
  renderer
    UI, editor, sidebar, view shell
  preload
    restricted bridge
  main
    sidecar lifecycle, OS integration, watcher, executor host

netior-service
  domain API
  persistence authority
  JSON-RPC / REST / SSE boundary

netior-mcp
  MCP protocol adapter
  netior-service client

narre-server
  agent supervisor/runtime
  netior-service client

interactive-view runtime
  HTML/JS resource execution host
  scoped Netior SDK client
```

핵심 원칙은 다음이다.

- Domain state는 `netior-service`가 소유한다.
- DB 직접 접근은 `netior-service`만 한다.
- Desktop app은 UI와 OS host다.
- MCP, Narre, interactive view는 domain logic을 복제하지 않는다.
- 통신 방식이 여러 개여도 application service는 하나여야 한다.

## Package 책임

### `packages/shared`

`shared`는 순수한 type, constants, i18n, display resolver를 제공한다.

이 패키지는 DB, filesystem, Electron, HTTP server 같은 runtime 책임을 가지면 안 된다. 여러 package가 공유해야 하는 contract만 둔다.

### `packages/netior-core`

`core`는 domain persistence와 repository, migration, domain invariant의 library다.

단, runtime owner는 아니다. `better-sqlite3` 같은 native binding과 실제 DB connection은 service runtime이 소유한다.

### `packages/netior-service`

`service`는 Netior domain의 권위 있는 API server다.

책임:

- World / scope
- Kind / property / relation kind definition
- Resource reference
- Assignment / assertion
- Evidence / decision
- Change event / snapshot
- View definition / layout
- Agent/evolution 기록 중 canonical domain state에 속하는 부분
- DB migration과 persistence ownership
- JSON-RPC, REST, SSE transport adapter

`service`는 domain logic의 중심이다. Desktop, MCP, Narre, interactive view가 같은 world를 다룰 때 이 service를 기준으로 일관성을 유지한다.

### `packages/desktop-app`

`desktop-app`은 사용자-facing desktop surface와 OS integration을 맡는다.

책임:

- Electron window lifecycle
- Renderer UI
- Preload bridge
- Sidecar process lifecycle
- Local directory picker
- File watcher
- Terminal / executor host
- Browser integration
- Interactive view runtime host
- Service event stream을 renderer에 전달

Desktop app은 domain state의 source of truth가 아니다. UI 상태와 OS 실행 책임을 맡는다.

### `packages/netior-mcp`

`netior-mcp`는 MCP protocol adapter다.

MCP tool은 Netior domain logic을 직접 구현하지 않고, `netior-service` API를 호출하는 얇은 adapter여야 한다. MCP tool contract는 가능하면 service의 domain operation과 자연스럽게 대응되어야 한다.

### `packages/narre-server`

`narre-server`는 agent supervisor와 runtime을 맡는다.

책임:

- Narre chat/session
- Translator / Actor / Validator 실행
- Agent definition, runtime profile, session, run, task, assignment, event, approval 관리
- Interpretation job 수행
- Candidate assertion/evidence/validation result 생성
- Service API를 통한 world state 조회와 기록

`narre-server`는 AI 판단을 생성할 수 있지만, canonical world state를 직접 우회해서 바꾸면 안 된다. 결과는 service가 이해하는 candidate, evidence, decision, event 형태로 기록되어야 한다.

## Sidecar 구조

Sidecar는 Electron 앱 옆에서 따로 실행되는 내부 service process다.

사용자는 Netior desktop app 하나를 실행한다고 느끼지만, 내부적으로 desktop main process가 필요한 sidecar들을 실행하고 관리한다.

초기 sidecar 후보:

- `netior-service`
- `narre-server`
- `netior-mcp`

`netior-service`는 desktop app이 정상 동작하려면 거의 항상 필요하다. `narre-server`와 `netior-mcp`는 사용 시점에 lazy start할 수 있다.

Sidecar를 사용하는 이유:

- DB/native binding을 Electron renderer/main과 분리한다.
- 여러 client가 같은 service API를 사용하게 한다.
- AI runtime, MCP server, domain service의 장애 경계를 나눈다.
- packaging 시 sidecar를 명확한 runtime unit으로 포함할 수 있다.
- 로그, restart, health check를 독립적으로 관리할 수 있다.

Desktop main은 sidecar lifecycle의 owner다.

책임:

- dev/prod sidecar path resolve
- port 또는 endpoint discovery
- process start/stop/restart
- health check
- log forwarding
- crash reporting
- app shutdown 시 cleanup

## 통신 방식

Netior service의 public contract는 hybrid 방식이 적합하다.

```text
JSON-RPC
  domain operation

REST
  resource content, binary, preview, asset

SSE
  event stream
```

이것은 service를 여러 벌 만든다는 뜻이 아니다. Transport adapter가 여러 개라는 뜻이다.

올바른 구조:

```text
application service
  assign kind
  accept assertion
  record change
  project view

transport adapters
  JSON-RPC method -> application service
  REST endpoint -> content/resource service
  SSE endpoint -> event bus subscription
```

잘못된 구조:

```text
JSON-RPC 안에 domain logic 구현
REST 안에 같은 domain logic 재구현
MCP 안에 또 다른 domain logic 구현
```

Domain logic은 한 곳에 있어야 하고, transport는 얇아야 한다.

## JSON-RPC의 역할

JSON-RPC는 Netior의 domain operation을 표현한다.

Domain operation은 Netior의 의미 세계를 읽거나 바꾸는 application-level 명령 또는 질의다.

예:

- world/scope 생성과 수정
- kind/property/relation kind 정의
- resource 등록
- kind assignment 생성
- property assertion 생성
- relation assertion 생성
- candidate assertion 승인/거절
- change event 기록
- interpretation job 생성
- view projection 요청
- decision 기록

이런 작업은 단순 resource CRUD보다 operation 성격이 강하다. JSON-RPC method namespace로 명시하는 편이 REST path에 억지로 끼워 넣는 것보다 자연스럽다.

예시:

```text
world.create
world.listScopes
kind.create
property.create
relationKind.create
resource.register
resource.assignKind
assertion.accept
change.record
interpretation.createJob
view.project
decision.record
```

MCP tool call도 내부적으로 이런 domain operation과 대응되기 쉽다.

## REST의 역할

REST는 resource content와 binary transfer에 사용한다.

예:

- Markdown 원문 읽기
- PDF page preview
- Image thumbnail
- Interactive view HTML asset
- File download
- Resource content write stream

이런 데이터는 JSON-RPC payload에 넣기보다 HTTP resource endpoint로 다루는 편이 자연스럽다.

REST endpoint는 domain state를 우회해서 바꾸는 경로가 되면 안 된다. Content 변경이 world state에 영향을 준다면, service는 그 결과를 resource snapshot 또는 change event로 연결해야 한다.

## SSE의 역할

SSE는 service event stream에 사용한다.

Event stream 예:

- resource observed
- change event recorded
- assertion candidate created
- assertion accepted/rejected
- interpretation job progress
- agent run/task/event update
- view stale/updated

Desktop renderer는 service에 직접 SSE로 붙기보다, 기본적으로 desktop main이 service SSE를 구독하고 renderer에 IPC event로 전달하는 구조가 안전하다.

```text
netior-service SSE
  -> desktop main
  -> renderer IPC event
```

향후 양방향 realtime이 필요해지면 WebSocket을 검토할 수 있지만, 초기에는 SSE가 더 단순하다.

## Renderer 접근 방식

Desktop renderer가 `netior-service`에 직접 붙을지, preload/main을 경유할지는 신뢰 경계 문제다.

기본 원칙은 다음이다.

```text
trusted backend client
  -> service 직접 호출 가능

desktop renderer
  -> preload/main 경유를 기본값으로 한다

interactive HTML
  -> 제한된 SDK를 통해 host/preload/main 경유
```

Renderer는 Netior가 만든 React UI지만, 기술적으로는 Chromium 안에서 실행되는 web page다. XSS, 외부 링크, 사용자 또는 AI가 만든 HTML, 실수로 노출된 script가 섞일 수 있다.

따라서 service URL, token, full API surface를 renderer에 그대로 노출하면 renderer 안의 임의 JS도 service client가 될 수 있다.

Preload/main 경유의 목적:

- service endpoint와 token을 숨긴다.
- renderer에 필요한 API만 노출한다.
- 요청 parameter를 검증한다.
- 허용되지 않은 method를 차단한다.
- mutation 전에 approval/policy를 적용한다.
- audit/event log를 남긴다.
- sidecar lifecycle과 error handling을 main에서 통합한다.
- interactive view별 권한을 제한한다.

예:

```text
renderer React
  -> window.netior.world.list()
  -> preload
  -> ipcRenderer.invoke(...)
  -> desktop main
  -> netior-service JSON-RPC
```

MCP server와 Narre server는 trusted backend client에 가까우므로 service API를 직접 호출할 수 있다. 다만 이들도 service가 제공하는 public contract를 통해서만 접근해야 하며 DB를 직접 열면 안 된다.

## Interactive View Runtime

Interactive view의 원본은 HTML 파일 또는 HTML 기반 resource다.

중요한 구분:

```text
interactive-view.html
  원본 resource

그 HTML이 실행되는 Chromium context
  runtime client
```

HTML 파일 자체는 client가 아니다. HTML 안의 JavaScript가 실행되어 Netior SDK를 호출하는 순간, 그 실행 context가 client가 된다.

Netior의 목표는 AI agent가 HTML과 JS를 작성하고, 그 HTML이 Netior SDK를 통해 interactive하게 world/resource/assertion을 읽고 쓸 수 있게 하는 것이다.

예:

- 시험 문제를 `<`, `>` 버튼으로 넘긴다.
- 답안을 입력한다.
- 로컬에서 채점한다.
- 결과를 Netior에 기록한다.
- 필요하면 candidate assertion을 만든다.

이 방향은 유효하다. 다만 interactive HTML이 service 전체 API에 직접 붙으면 안 된다.

권장 구조:

```text
interactive HTML
  -> injected Netior SDK
  -> interactive view host / preload
  -> desktop main
  -> netior-service
```

Interactive view host는 gatekeeper 역할을 한다.

검증 대상:

- 이 view가 어떤 resource에서 실행 중인가
- 어떤 world/scope에 속하는가
- view manifest가 어떤 권한을 요청했는가
- 사용자가 그 권한을 승인했는가
- 요청한 SDK method가 허용되어 있는가
- 요청 대상 resource가 허용 범위 안인가
- read인지 write인지
- write라면 candidate로만 만들 것인지, 바로 반영 가능한지
- parameter schema가 맞는지
- 요청 횟수와 payload 크기가 과하지 않은지

허용 가능한 예:

- 현재 resource 읽기
- 현재 scope 안의 제한된 assertion 조회
- 시험 답안 저장
- 채점 결과를 view state로 저장
- candidate property assertion 생성

차단하거나 승인해야 하는 예:

- world definition 삭제
- 임의 파일 쓰기
- 다른 world의 resource 읽기
- 모든 assertion bulk delete
- service 전체 JSON-RPC method 호출
- 외부 네트워크로 데이터 전송

Interactive view는 React renderer와 같은 권한을 가지면 안 된다. HTML resource별로 제한된 SDK와 permission manifest를 가져야 한다.

## Event Architecture

세계 변화와 agent 실행을 다루려면 event architecture가 중요하다.

이때 event는 두 종류로 나누어야 한다.

```text
Domain event
  영속 기록
  world evolution, audit, validator의 근거

UI event
  일시적 전달
  renderer 갱신, progress 표시
```

예를 들어 change event는 domain event다. 나중에 validator가 분석할 수 있어야 하므로 DB에 남아야 한다.

반면 "progress spinner 갱신" 같은 것은 UI event다. 영속 저장할 필요가 없다.

Service는 domain event를 기록하고, event stream을 통해 client에게 알린다. Desktop main은 service event stream을 받아 renderer IPC로 전달한다.

```text
watcher observes file change
  -> desktop main
  -> service records change event
  -> service emits SSE event
  -> desktop main relays IPC
  -> renderer updates inbox/view
```

Agent event도 world evolution과 연결되어야 한다.

```text
agent run/task/event
  -> interpretation result
  -> candidate assertion/evidence
  -> decision
  -> accepted assertion
```

Validator는 이 축적된 event와 decision pattern을 분석한다.

## Desktop Main의 역할

Desktop main은 domain owner가 아니라 host다.

책임:

- Sidecar lifecycle 관리
- Service health check
- Local directory watcher
- Terminal/executor host
- Browser integration
- Interactive view runtime host
- Renderer IPC gateway
- Service SSE 구독과 relay
- OS permission과 native dialog 처리

Desktop main은 local OS와 service 사이의 adapter다.

예:

```text
file watcher
  -> observed filesystem fact
  -> service change.record
```

```text
interactive view SDK call
  -> main validates scope/permission
  -> service JSON-RPC
```

```text
terminal agent event
  -> main executor host
  -> narre supervisor or service event log
```

## Agent Architecture

기존 agent supervisor/orchestration 모델은 큰 틀에서 유지한다.

유지할 개념:

- AgentDefinition
- RuntimeProfile
- SkillRef
- Session
- Conversation
- Run
- Task
- Assignment
- Event
- Approval
- Executor

새 모델에서 바뀌어야 하는 점은 연결 대상이다. 기존에는 `rootNetworkId` 중심이었지만, 새 모델에서는 world/scope/change/assertion 중심이어야 한다.

Agent 역할은 first-class responsibility가 되어야 한다.

```text
Translator
  사용자 세계관을 Netior definition 후보로 번역한다.

Actor
  확정된 definition 위에서 resource와 assertion을 다룬다.

Validator
  동작 로그, 변화 기록, decision pattern을 분석한다.
```

Agent는 직접 canonical world state를 우회해서 바꾸면 안 된다. Agent output은 service가 기록 가능한 형태여야 한다.

예:

- candidate definition
- candidate assertion
- evidence
- validation report
- approval request
- execution event

## Capability와 Tool의 위치

Netior는 모든 도메인 규칙과 계산을 core에 내장하지 않는다.

Capability는 Netior가 직접 의미를 모르는 계산, 검증, 행동 능력을 world에 연결하기 위한 단위다.

예:

- Markdown에서 등장인물 후보 추출
- 특정 property 규칙 검증
- 외부 service 객체 업데이트
- interactive view 결과 채점
- AI 기반 relation 후보 생성

Capability 자체와 world에 연결하는 binding은 분리되어야 한다.

```text
Capability
  실행 가능한 능력

World capability binding
  이 world/scope에서 그 능력을 어디에, 언제, 어떤 정책으로 쓸지
```

MCP tool, agent skill, plugin, script, external service는 capability를 제공하거나 호출하는 surface가 될 수 있다. 하지만 최종 기록은 service가 이해하는 assertion, evidence, event, decision 형태로 남아야 한다.

## Resource Handling

Netior는 instance 원본을 강하게 소유하지 않는다.

Resource content는 실제 파일, URL, service object, native interactive view 등에 남아 있고, Netior는 resource reference와 그에 대한 assertion/evidence/change를 관리한다.

Architecture 관점에서 resource handling은 두 층으로 나뉜다.

```text
resource identity / metadata / assertion
  netior-service

resource content open/read/write/preview
  service REST 또는 desktop main handler
```

로컬 파일 content를 누가 직접 읽을지는 권한과 packaging에 따라 결정할 수 있다. 하지만 어떤 방식이든 content 변경이 world state에 영향을 준다면 service의 change event로 연결되어야 한다.

## Security and Permission

Netior는 local-first app이지만 permission boundary가 필요하다.

특히 다음 실행 주체는 동일하게 신뢰하면 안 된다.

- Netior first-party React UI
- User-authored interactive HTML
- AI-generated interactive HTML
- Narre agent
- MCP client
- Terminal agent
- External connector

각 주체는 다른 permission profile을 가져야 한다.

핵심 정책:

- AI-generated output은 기본적으로 candidate/draft다.
- Accepted state 변경에는 decision 또는 명시된 policy가 필요하다.
- Interactive view는 scoped SDK만 사용한다.
- Service full API는 untrusted HTML에 노출하지 않는다.
- External network access는 별도 권한으로 다룬다.
- Bulk mutation은 approval 또는 strong policy가 필요하다.

## Local-first와 Packaging

Netior는 기본적으로 local-first desktop app이다.

초기 목표:

- Domain DB는 local app data에 둔다.
- Resource 원본은 user directory에 둔다.
- Sidecar는 desktop app이 관리한다.
- AI 없이도 world definition, manual assignment, view 탐색이 가능해야 한다.

Packaging 원칙:

- Production app은 bundled Node runtime을 사용한다.
- Sidecar는 `resources/sidecars` 아래에 포함한다.
- `netior-service`는 packaged app에서 deep workspace path에 의존하면 안 된다.
- Payload layout이 바뀌면 installer upgrade/uninstall 흐름도 같이 검증해야 한다.

## Architecture Flow Examples

### File Change Flow

```text
user edits markdown file
  -> desktop watcher detects change
  -> desktop main reports measured fact
  -> netior-service records resource snapshot/change event
  -> service emits event
  -> renderer shows change inbox
  -> narre-server may run interpretation job
  -> candidate assertion/evidence created
  -> user accepts/rejects
  -> service records decision and accepted assertion
```

### Interactive Quiz View Flow

```text
user opens quiz interactive HTML
  -> desktop renders HTML in interactive view runtime
  -> Netior SDK is injected with scoped permissions
  -> HTML reads current quiz resources/assertions
  -> user answers questions
  -> HTML submits result through SDK
  -> host validates request
  -> service records result/candidate assertion/event
```

### MCP Tool Flow

```text
external agent calls MCP tool
  -> netior-mcp validates tool args
  -> netior-mcp calls service JSON-RPC
  -> service applies domain operation
  -> result returned through MCP
```

### Agent Interpretation Flow

```text
change event recorded
  -> interpretation job created
  -> narre-server runs Translator/Actor/Validator role
  -> result becomes candidate assertion/evidence/report
  -> user decision or policy resolves candidate
  -> accepted assertion updates world state
```

## Open Architecture Questions

다음 항목은 추가 결정이 필요하다.

- `World`와 하위 scope를 제품 언어에서 어떻게 부를 것인가
- Service port discovery와 authentication 방식을 어떻게 할 것인가
- Desktop renderer가 일부 read-only service call을 직접 할 수 있게 할 것인가
- Interactive view runtime을 iframe, webview, BrowserView, 별도 window 중 무엇으로 시작할 것인가
- Resource content read/write를 service가 직접 맡을지 desktop main handler가 맡을지
- SSE event schema와 persisted domain event schema를 얼마나 맞출 것인가
- MCP와 Narre가 service JSON-RPC를 직접 호출할지, 내부 client SDK를 공유할지
- Capability binding과 agent/tool/skill 용어를 어떻게 정리할 것인가

## 요약

Netior의 새 아키텍처는 Electron UI 위에 여러 client가 붙는 local-first service architecture다.

`netior-service`는 domain과 persistence의 권위자다. `desktop-app`은 UI와 OS host다. `netior-mcp`, `narre-server`, `interactive view runtime`은 각각 MCP, agent, interactive UI를 위한 adapter/client다.

통신은 hybrid로 가져간다. JSON-RPC는 domain operation, REST는 resource content/binary, SSE는 event stream을 담당한다. 하지만 domain logic은 하나의 application service에만 있어야 한다.

Interactive view는 HTML resource로 다루되, 실행 시에는 제한된 SDK와 permission gate를 통해 service에 접근한다. AI가 작성한 HTML도 Netior world를 interactive하게 다룰 수 있지만, service 전체 권한을 직접 얻어서는 안 된다.
