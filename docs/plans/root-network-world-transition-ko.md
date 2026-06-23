# Root Network / World 전환 계획

## 1. 목적

이 문서는 Netior의 최상위 작업 경계를 `Project`에서 `Root Network`로 전환하기 위한 설계 초안이다.

핵심 전환은 단순한 이름 변경이 아니다. 현재 `Project`가 맡고 있는 저장소 루트, ontology scope, 앱 진입점, Narre 세션 경계, MCP 기본 바인딩, UI workspace 책임을 분해하고, Netior의 도메인 모델에 더 맞는 형태로 재배치하는 것이 목적이다.

용어는 다음처럼 구분한다.

- **Root Network**: 내부 도메인 및 구현 용어. 최상위 network이며, 사용자가 여는 작업 세계의 canonical object다.
- **World**: 사용자-facing 제품 용어. Root Network를 앱 UI에서 부르는 이름이다.
- **Network**: World 아래의 하위 작업면이다. 특정 관점, 주제, 장면, 구조를 펼치는 surface다.
- **Universe**: 앱 전체 최상위 network다. 여러 World를 담는 app-level network다.

정리하면 다음과 같다.

```text
Universe
  ├─ Root Network / World
  │   ├─ Network
  │   └─ Network
  └─ Root Network / World
      └─ Network
```

## 2. 배경

현재 모델은 대부분의 객체가 `project_id`를 통해 하나의 `Project` 안에 소속된다.

```text
Project
  ├─ instances
  ├─ schemas
  ├─ meanings
  ├─ relationships
  ├─ networks
  ├─ files
  └─ Narre sessions
```

이 구조는 초기 구현에는 단순하지만, Netior의 실제 도메인에는 몇 가지 불일치가 있다.

첫째, schema와 instance는 항상 network 독립적이지 않다. Network는 단순한 표시 화면이 아니라 해당 세계의 작업면이다. 어떤 schema와 instance는 특정 World 또는 특정 Network에서만 의미를 가진다.

둘째, cross-project 공유가 필요하다. 예를 들어 Diary World와 Novel World가 있을 때, `Person`, `Place`, `Event` 같은 schema나 특정 instance는 둘 사이에서 공유될 수 있다. 반대로 Novel World의 `Magic System Rule` 같은 schema는 특정 World에만 local일 수 있다.

셋째, `Project`는 Netior의 핵심 도메인 언어와 다소 어긋난다. Netior의 중심 은유는 project 관리가 아니라 ontology-backed object를 network 안에서 조직하는 것이다. 사용자가 여는 단위도 본질적으로는 project file bundle이 아니라 하나의 root network, 즉 World에 가깝다.

따라서 새 모델은 다음 명제를 기준으로 한다.

```text
Root Network is the canonical top-level domain object.
World is the product label for a user-openable Root Network.
Schema, instance, and meaning ownership is network-scoped, not project-scoped.
Object ownership, object visibility, and network placement are separate concerns.
```

## 3. 현재 Project 책임

현재 `Project`는 하나의 책임만 가진 객체가 아니다. 여러 시스템 책임이 `project_id`에 함께 묶여 있다.

| 책임 | 현재 구현 |
|---|---|
| 앱 진입 단위 | `currentProject`, `lastProjectId`, ProjectHome |
| 저장소 루트 | `projects.root_dir` |
| DB 소유 및 cascade boundary | `instances.project_id`, `schemas.project_id`, `meanings.project_id`, `networks.project_id` 등 |
| ontology namespace | project별 built-in meanings, meaning categories, schema |
| network bootstrap | project ontology network 생성, Universe에 project portal node 배치 |
| file boundary | project root 아래 file tree, `files.project_id` |
| module boundary | `modules.project_id` |
| object reference scope | `objects.scope = 'project'`, `objects.project_id` |
| relationship boundary | `relationships.project_id` |
| Narre boundary | session, approval, draft, prompt metadata |
| MCP 기본 바인딩 | `defaultProjectBinding`, tool input의 `project_id` |
| terminal cwd | current project root dir |
| renderer workspace cache | project id 기반 snapshot |

이 중 일부는 Root Network로 직접 이전할 수 있다. 하지만 일부는 ownership, visibility, placement로 분해해야 한다.

## 4. 책임 이전 원칙

`Project`를 제거한다고 해서 모든 `project_id`를 `root_network_id`로 단순 치환하면 안 된다. 그러면 기존 project boundary가 root network boundary로 이름만 바뀌어 반복된다.

새 모델에서는 다음 세 책임을 분리한다.

### 4.1 Ownership

Ownership은 schema, instance, meaning 같은 객체가 어느 network 안에서 정의되었는지를 나타낸다. 또한 해당 객체를 누가 삭제, 수정, 패키징, export할 수 있는지를 결정한다.

예:

- Diary Root Network가 소유한 diary entry instance
- Novel의 `Chapter 3 Draft` network가 소유한 temporary scene instance
- Shared Root Network 또는 system scope가 소유한 `Person` schema

후보 컬럼 또는 개념:

- `owner_network_id`
- `owner_scope_id`
- `source_kind/source_ref`와 결합된 owner scope

이때 owner network는 Root Network일 수도 있고, 하위 Network일 수도 있다. Root Network는 가장 넓은 network scope일 뿐, 객체 소유권의 유일한 단위가 아니다.

### 4.2 Visibility

Visibility는 어떤 World 또는 Network에서 객체를 사용할 수 있는지를 나타낸다. Ownership이 객체의 정의 위치라면, visibility는 다른 network에서 그 객체를 사용할 수 있게 여는 공유 정책이다.

예:

- Shared `Person` schema가 Diary World와 Novel World에서 모두 사용 가능
- Novel World의 `MagicSystemRule` schema는 Novel World에서만 사용 가능
- 특정 instance가 두 World에 모두 등장 가능

후보 테이블:

- `root_network_object_bindings`
- `scope_object_bindings`
- `network_object_bindings`
- `object_scope_bindings(scope_network_id, include_descendants)`

이 layer는 cross-world 공유를 표현하는 핵심이다.

### 4.3 Placement

Placement는 객체가 특정 network surface 위에 node로 배치되었는지를 나타낸다.

현재 `network_nodes -> objects` 구조가 이미 이 역할을 맡고 있다. 이 책임은 유지하되, `objects`의 scope 의미는 재정의해야 한다.

```text
Object ownership: where the object belongs.
Object visibility: where the object can be used.
Network placement: where the object appears as a node.
```

## 5. 새 도메인 구조

### 5.1 Universe

Universe는 app-level network다. 여러 World를 담는 최상위 공간이며, World는 Universe 안에 portal node로 나타날 수 있다.

현재 `kind = 'universe'` network는 이 역할을 이미 부분적으로 수행한다. 다만 현재는 Universe가 project object를 담고 있다. 전환 후에는 project object 대신 Root Network object를 담는다.

### 5.2 Root Network

Root Network는 사용자가 여는 최상위 network다. UI에서는 World라고 부른다.

Root Network가 맡는 책임:

- World 이름
- storage root 또는 storage mounts
- 기본 ontology 작업면
- 하위 network tree의 root
- Narre/session/tool 기본 컨텍스트
- World-level object의 owner network
- Universe 안의 portal 대상

Root Network는 단순 container가 아니라 작업면이다. 현재의 project ontology network가 맡던 역할은 별도 child network로 유지하기보다 Root Network 자체로 이전하는 것이 자연스럽다.

즉 World를 열었을 때 보이는 Root Network surface는 그 World의 기본 ontology/work surface다. schema, meaning category, meaning, World-level instance는 이 Root Network 위에 직접 배치될 수 있다.

내부 표현 후보:

```ts
type NetworkKind = 'universe' | 'root' | 'ontology' | 'network';
```

UI 표현:

```text
New World
Open World
World Settings
World Ontology
```

### 5.3 Network

Network는 Root Network 아래의 하위 작업면이다.

Network가 맡는 책임:

- schema, instance, meaning의 local definition scope가 될 수 있음
- node/edge 배치
- layout state
- hierarchy/group/portal 표현
- 특정 관점의 object organization
- local interaction surface

하위 network도 schema, instance, meaning을 소유할 수 있다. 다만 소유와 배치는 분리된다. 어떤 network가 `Chapter Beat` schema를 정의할 수 있지만, 그 schema가 반드시 같은 network 위에 node로 배치되어야 하는 것은 아니다.

### 5.4 Ontology Surface

현재 project ontology network는 Root Network surface로 이전한다.

역할:

- World에서 사용 가능한 schema, meaning, category를 보여주는 managed surface
- local ontology와 shared/imported ontology를 구분해 보여줄 수 있음
- sync 기준은 localized label이나 generated id가 아니라 stable object ref와 scope binding이어야 함

필요하다면 별도의 ontology view network를 만들 수 있지만, canonical ontology surface는 Root Network 자체다.

## 6. 책임 이전표

| 현재 Project 책임 | 새 책임자 |
|---|---|
| `Project.id` | Root Network id |
| `Project.name` | Root Network name, UI label은 World name |
| `Project.root_dir` | Root Network storage root 또는 storage mount |
| `currentProject` | `currentRootNetwork` 또는 `currentWorld` |
| `lastProjectId` | `lastRootNetworkId` |
| ProjectHome | WorldHome |
| ProjectCard | WorldCard |
| ProjectCreateDialog | WorldCreateDialog |
| ProjectEditor | RootNetworkEditor 또는 WorldSettingsEditor |
| project ontology network | Root Network ontology/work surface |
| Universe project portal node | Universe world/root-network portal node |
| `objects.scope = 'project'` | owner/visibility scope로 재정의 |
| project-scoped list API | owned/visible/placed query로 분리 |
| Narre project session | Root Network session |
| project user agent | World user agent |
| MCP default project binding | default root network/world binding |
| terminal project cwd | current World storage root |

## 7. Frontend 변경 범위

### 7.1 앱 진입

현재 앱은 `ProjectHome -> WorkspaceShell(project)` 흐름이다.

전환 후에는 다음 흐름이 된다.

```text
WorldHome
  -> openWorld(rootNetwork)
    -> WorkspaceShell(worldContext)
```

주요 변경 파일:

- `packages/desktop-app/src/renderer/App.tsx`
- `packages/desktop-app/src/renderer/stores/project-store.ts`
- `packages/desktop-app/src/renderer/components/home/ProjectHome.tsx`
- `packages/desktop-app/src/renderer/components/home/ProjectCard.tsx`
- `packages/desktop-app/src/renderer/components/home/ProjectCreateDialog.tsx`

### 7.2 Sidebar / ActivityBar

UI label은 `Projects`에서 `Worlds`로 바뀐다. Universe sidebar는 root networks 목록을 보여준다.

현재 project가 있을 때만 활성화되는 항목은 current World 기준으로 바뀐다.

- Networks
- Files
- Ontology
- Narre
- Sessions
- Terminal
- Agents

주요 변경 파일:

- `components/sidebar/ActivityBar.tsx`
- `components/sidebar/Sidebar.tsx`
- `components/sidebar/NetworkList.tsx`
- `components/sidebar/BookmarkedNetworkSidebar.tsx`
- `stores/activity-bar-store.ts`
- `lib/activity-bar-layout.ts`

### 7.3 Store와 서비스

현재 store API는 대부분 `projectId`를 인자로 받는다.

```ts
loadByProject(projectId)
loadNetworks(projectId)
loadNetworkTree(projectId)
```

전환 후에는 단순 rename보다 의미 분리가 필요하다.

```ts
loadOwnedInstances(rootNetworkId)
loadVisibleInstances(rootNetworkId)
loadAvailableSchemas(rootNetworkId)
loadAvailableMeanings(rootNetworkId)
loadNetworkTree(rootNetworkId)
```

공유 모델을 지원하려면 UI도 `Local`, `Shared`, `Imported`, `System` 같은 출처 구분을 표시할 수 있어야 한다.

### 7.4 Editor tab metadata

현재 `EditorTab`에는 `projectId`가 들어간다. 전환 후에는 다음 후보 중 하나를 선택해야 한다.

- `rootNetworkId`
- `worldId`
- `workspaceId`
- `scopeId`

내부 정확성을 위해 `rootNetworkId`를 추천한다. UI label은 World를 사용한다.

### 7.5 Narre / Terminal / Agents

Narre, terminal, user agents는 project boundary에 깊게 연결되어 있다.

전환 방향:

```text
projectId -> rootNetworkId
projectRoot -> storageRoot
project user agent -> world user agent
project prompt metadata -> world/root network prompt metadata
```

Narre session storage도 `narre/{projectId}`에서 `narre/{rootNetworkId}`로 이전해야 한다.

## 8. Backend 변경 범위

### 8.1 Root Network API

Project API를 즉시 제거하기 전에 Root Network API를 먼저 추가한다.

후보:

```text
POST /root-networks
GET /root-networks
GET /root-networks/:id
PATCH /root-networks/:id
DELETE /root-networks/:id
```

또는 기존 network API를 확장할 수 있다.

```text
POST /networks { kind: 'root' }
GET /networks?rootOnly=true
```

도메인 명확성을 위해 초기에는 root-network 전용 repository/service facade를 두는 편이 낫다. 내부 저장은 `networks` 테이블을 사용할 수 있다.

### 8.2 Bootstrap

현재 `createProject`가 하던 bootstrap은 `createRootNetwork`로 이전한다.

현재:

```text
createProject
  -> create project row
  -> create project object
  -> seed meaning categories
  -> seed built-in meanings
  -> ensure project ontology network
  -> ensure project node in Universe
```

전환 후:

```text
createRootNetwork
  -> create root network row
  -> register root network object
  -> register storage root
  -> seed or bind meaning categories
  -> seed or bind built-in meanings
  -> ensure world ontology network
  -> ensure root network node in Universe
```

### 8.3 DB scope

`project_id`는 역할별로 분해한다.

후보:

- ownership: `owner_network_id`
- visibility: binding table
- placement: `network_nodes`
- storage: `network_storage_roots`

기존 테이블 중 우선 검토 대상:

- `instances`
- `schemas`
- `meanings`
- `relationships`
- `objects`
- `files`
- `modules`
- `networks`
- `interactive_view_*`
- Narre session files

## 9. Migration 전략

한 번에 `Project`를 제거하지 않는다. 단계적 bridge가 필요하다.

### Phase A. 문서와 용어 고정

- Root Network, World, Network, Universe 용어 확정
- `Project` 책임 이전표 확정
- ownership/visibility/placement 분리 원칙 확정

### Phase B. Root Network 병행 도입

- `NetworkKind`에 root 개념 추가
- Root Network repository/service 추가
- 기존 Project 생성 시 대응 Root Network를 생성하거나 연결
- Universe에는 project node 대신 root network node를 표시하는 경로 추가

### Phase C. Renderer UI를 World 중심으로 전환

- ProjectHome을 WorldHome으로 전환
- currentProject를 currentWorld/currentRootNetwork로 전환
- ActivityBar와 Sidebar label을 Worlds 기준으로 변경
- ProjectEditor를 RootNetworkEditor/WorldSettingsEditor로 대체

이 단계에서는 내부적으로 legacy project bridge를 유지할 수 있다.

### Phase D. Scope query 재설계

- `loadByProject`를 제거 방향으로 전환
- owned/visible/placed query를 분리
- schema/instance/meaning picker에서 local/shared/system 구분
- cross-world object binding 추가

### Phase E. Narre / MCP / Agent 전환

- `defaultProjectBinding`을 root network/world binding으로 변경
- Narre session, approval, draft storage key 이전
- prompt metadata를 World 기준으로 변경
- MCP tool input에서 project_id를 제거하거나 legacy alias로만 유지

### Phase F. Project 제거

- projects table 제거 또는 legacy migration table로 격리
- project IPC/service/preload 제거
- project i18n key 제거
- project-store 제거
- docs에서 Project 도메인 용어 제거
- 테스트 갱신

## 10. 주요 결정 사항

아직 확정해야 할 결정은 다음과 같다.

### 10.1 Root Network kind 이름

후보:

- `kind = 'root'`
- `kind = 'world'`

추천:

- 내부 도메인은 `root`
- UI label은 World

### 10.2 Storage root 모델

후보:

- `networks.storage_root`
- `network_storage_roots`

추천:

- MVP는 단일 storage root로 시작할 수 있다.
- 장기적으로는 여러 mount를 고려해 `network_storage_roots`가 더 적합하다.

### 10.3 Scope 컬럼 이름

후보:

- `root_network_id`
- `owner_network_id`
- `scope_id`
- `owner_scope_id`

추천:

- ownership에는 `owner_network_id`
- World-level query context에는 `root_network_id`
- network-level query context에는 `network_id`
- 더 일반화가 필요해지면 `scope_id` 계층으로 확장

### 10.4 Shared object binding 범위

결정할 것:

- binding 대상이 root network인가, 개별 network인가
- schema/meaning/instance 모두 동일 binding 모델을 쓰는가
- relationship도 cross-world 공유 가능한가

초기 추천:

- network 단위 binding을 기본 모델로 둔다.
- root network binding은 World 전체에 공유하는 특수한 경우로 본다.
- binding에는 descendants 포함 여부를 명시한다.

## 11. 위험 요소

- `Project`를 `World`로 단순 rename하면 기존 boundary 문제가 반복된다.
- Root Network가 작업면이라는 점과 World-level boundary라는 점을 혼동하면 다시 container/object 역할이 섞일 수 있다.
- shared schema/instance를 도입하면 picker, search, Narre mention, MCP query가 모두 scope-aware가 되어야 한다.
- project-scoped built-in meaning id 패턴이 많다. 예: `meaning-${projectId}-contains`
- Narre와 terminal은 project root dir에 강하게 의존한다.
- 삭제/cascade 정책이 복잡해진다. shared object를 어떤 World 삭제가 지울 수 있는지 명확히 해야 한다.

## 12. 제안 결론

Project 제거는 합당하다. 다만 합당한 이유는 Project라는 이름이 마음에 들지 않아서가 아니라, schema와 instance의 실제 소속성이 network에 있고 그 공유 가능성을 `project_id` 하나로 표현할 수 없기 때문이다.

Root Network는 Netior의 도메인에 더 잘 맞는 최상위 객체다. UI에서는 이를 World라고 부르는 것이 자연스럽다.

최종 원칙은 다음과 같다.

```text
Internally: Root Network
Externally: World
Below root: Network
App-wide top: Universe
```

그리고 가장 중요한 모델링 원칙은 다음이다.

```text
Ownership, visibility, and placement must stay separate.
```

이 원칙을 지키면 Diary World와 Novel World가 schema나 instance를 공유할 수 있고, 동시에 특정 Network가 직접 정의한 ontology object도 자연스럽게 표현할 수 있다.
