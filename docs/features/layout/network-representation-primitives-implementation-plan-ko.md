# Network Representation Primitives Implementation Plan

작성일: 2026-05-19

관련 개념 문서: `docs/features/layout/network-representation-primitives-ko.md`

## 목표

Schema에 묶여 있던 표현 책임을 제거하고, network type, node type, edge type, surface runtime, representation primitive 기반으로 네트워크 표현 시스템을 재구성한다.

초기 목표는 모든 표현 자유도를 한 번에 여는 것이 아니다. 우선 canvas runtime 기반 user-defined network type을 가능하게 만들고, Calendar는 grid runtime 기반 built-in network type으로 정리한다.

## 구현 원칙

- fallback으로 기존 schema/node shape 경로를 유지하지 않는다.
- node type 없는 network node를 허용하지 않는다.
- edge type 없는 edge를 장기적으로 허용하지 않는다.
- 사용자 정의는 primitive composition이지 임의 renderer/runtime authoring이 아니다.
- model/meaning/DSL 기반 projection을 우선한다.
- Calendar는 built-in network type이며 grid runtime을 사용한다.
- 이미 적용된 migration은 수정하지 않고 새 migration을 추가한다.

## Phase 0. 현재 경로 정리 완료 조건

목표:

- schema가 node rendering을 결정하지 않게 한다.
- `schema.node_shape` 활성 사용처를 제거한다.

완료 기준:

- Schema type/create/update surface에 `node_shape`가 없다.
- SchemaEditor에 node shape 선택 UI가 없다.
- NetworkWorkspace가 schema에서 shape를 읽지 않는다.
- MCP/Narre prompt/preview/mention surface가 schema node shape를 노출하지 않는다.
- 새 migration으로 `schemas.node_shape`를 제거한다.
- `rg "node_shape|nodeShape"` 결과는 과거 migration과 제거 migration에만 남는다.

## Phase 1. Core Grammar Schema 추가

목표:

- network type, node type, edge type을 DB와 shared type에 도입한다.

새 테이블 초안:

```sql
network_types (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_kind TEXT NOT NULL,
  surface_runtime TEXT NOT NULL,
  grammar_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

node_types (
  id TEXT PRIMARY KEY,
  network_type_id TEXT NOT NULL REFERENCES network_types(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_kind TEXT NOT NULL,
  renderer_key TEXT NOT NULL,
  presentation_json TEXT NOT NULL DEFAULT '{}',
  projection_json TEXT NOT NULL DEFAULT '{}',
  interface_json TEXT NOT NULL DEFAULT '{}',
  placement_json TEXT NOT NULL DEFAULT '{}',
  interaction_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

edge_types (
  id TEXT PRIMARY KEY,
  network_type_id TEXT NOT NULL REFERENCES network_types(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_kind TEXT NOT NULL,
  renderer_key TEXT NOT NULL,
  presentation_json TEXT NOT NULL DEFAULT '{}',
  routing_json TEXT NOT NULL DEFAULT '{}',
  interface_json TEXT NOT NULL DEFAULT '{}',
  interaction_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

기존 테이블 변경:

```sql
networks.network_type_id TEXT REFERENCES network_types(id)
network_nodes.node_type_id TEXT REFERENCES node_types(id)
edges.edge_type_id TEXT REFERENCES edge_types(id)
edges.source_port_key TEXT
edges.target_port_key TEXT
edges.route_json TEXT
```

초기에는 기존 데이터 마이그레이션을 위해 일부 nullable로 추가한 뒤, seed/backfill 후 rebuild migration에서 NOT NULL로 잠근다.

완료 기준:

- shared types에 NetworkType, NodeType, EdgeType이 있다.
- core repository에 CRUD가 있다.
- service/MCP/IPC/preload/renderer service 최소 read path가 있다.
- 기존 network full load가 node type, edge type 정보를 포함할 수 있다.

## Phase 2. Built-In Default Grammar Seed

목표:

- 기존 freeform/default 네트워크를 fallback 없이 명시적 built-in grammar로 변환한다.

Built-in seed:

```text
network_type: default
surface_runtime: canvas

node_types:
- default.basic_node
- default.portal_node
- default.group_node
- default.hierarchy_node

edge_types:
- default.basic_edge
```

Backfill 규칙:

- 기존 일반 node는 `default.basic_node`
- 기존 `portal` node는 `default.portal_node`
- 기존 `group` 또는 `box` node는 `default.group_node`
- 기존 `hierarchy` node는 `default.hierarchy_node`
- 기존 edge는 `default.basic_edge`

주의:

- 이는 fallback이 아니다. migration이 기존 데이터를 새 grammar로 명시 변환하는 것이다.
- 기존 `network_nodes.node_type` 문자열은 변환 후 제거하거나 legacy migration-only field로 격리한다.

완료 기준:

- 기존 프로젝트를 열었을 때 모든 network node가 node type을 가진다.
- 모든 edge가 edge type을 가진다.
- renderer는 schema shape 없이 default node type renderer로 표시한다.

## Phase 3. Surface Runtime Registry 도입

목표:

- NetworkWorkspace가 layout plugin 하나에 모든 책임을 묶지 않고 surface runtime 계약을 통해 network type을 해석한다.

Runtime 계약 초안:

```ts
interface SurfaceRuntime {
  key: 'canvas' | 'grid';
  validateGrammar(grammar: NetworkGrammar): ValidationResult;
  resolveNodes(input: ResolveNodesInput): ResolvedNodeView[];
  resolveEdges(input: ResolveEdgesInput): ResolvedEdgeView[];
  renderSurface(props: SurfaceRuntimeRenderProps): JSX.Element;
  handleNodeDrop?(context: NodeDropContext): Writeback[];
  handleEdgeCreate?(context: EdgeCreateContext): EdgeDraft;
}
```

Canvas runtime v1:

- 기존 NetworkWorkspace, NodeLayer, EdgeLayer의 기능을 단계적으로 runtime 내부로 이동한다.
- 초기에는 thin wrapper로 시작한다.

Grid runtime v1:

- Calendar가 사용할 최소 grid shell을 제공한다.
- 사용자 정의 grid network type은 아직 열지 않는다.

완료 기준:

- network type의 `surface_runtime`으로 runtime을 선택한다.
- runtime 미등록은 fallback 렌더링이 아니라 오류 상태로 표시한다.
- canvas runtime에서 기존 default network가 동작한다.

## Phase 4. Node Renderer Registry

목표:

- `NodeCardDefault`를 전역 기본값이 아니라 `default.basic_node`의 renderer 중 하나로 낮춘다.

구성:

```text
node-renderers/
- basic-card
- portal-card
- group-container
- hierarchy-container
- grid-item-card
```

Renderer registry:

```ts
nodeRendererRegistry.get(rendererKey)
```

원칙:

- renderer key가 없으면 diagnostic node를 표시한다.
- diagnostic node는 fallback이 아니라 데이터/개발 오류 표시다.

완료 기준:

- RenderNode의 shape 중심 로직이 node type presentation 해석으로 대체된다.
- NodeCardDefault 이름을 basic renderer에 맞게 정리한다.
- node type renderer key가 렌더링 경로의 필수 입력이 된다.

## Phase 5. Data Projection Primitive

목표:

- node card가 어떤 데이터를 보여줄지 node type projection으로 정의한다.

Projection spec 초안:

```ts
type DataProjectionExpression =
  | { source: 'instance.title' }
  | { source: 'field'; fieldId: string }
  | { source: 'meaning'; meaning: FieldMeaningBindingKey }
  | { source: 'dsl'; expression: NetiorDslExpression };

type NodeProjectionSpec = {
  title?: DataProjectionExpression;
  subtitle?: DataProjectionExpression;
  badges?: DataProjectionExpression[];
  body?: Array<{
    label?: string;
    value: DataProjectionExpression;
    format?: string;
  }>;
};
```

구현:

- existing semantic projection을 재사용한다.
- meaning projection은 내부적으로 DSL `field.value`로 낮출 수 있게 한다.
- renderer는 resolved projection value만 받는다.

완료 기준:

- default basic node가 projection spec으로 title/icon/color를 표시한다.
- Calendar item이 meaning-bound time/title/badge projection을 사용한다.
- schema field id 직접 참조는 허용하되, built-in node type은 meaning/DSL 중심으로 작성한다.

## Phase 6. Node Interface와 Ports

목표:

- 연결점을 node type의 interface로 정의한다.

Interface spec 초안:

```ts
type NodeInterfaceSpec = {
  ports: Array<{
    key: string;
    label?: string;
    side: 'top' | 'right' | 'bottom' | 'left' | 'center';
    role: 'input' | 'output' | 'bidirectional';
    accepts?: string[];
    emits?: string[];
  }>;
  connectionRules?: Array<{
    portKey: string;
    accepts?: string[];
    emits?: string[];
  }>;
};
```

구현:

- Node renderer가 port anchor positions를 노출한다.
- Edge resolver가 `source_port_key`, `target_port_key`를 사용한다.
- 포트가 없는 node type은 interface spec에서 ports가 빈 배열인 상태다.

완료 기준:

- canvas runtime에서 edge endpoint가 port를 기준으로 계산될 수 있다.
- port 없는 node type과 port 있는 node type이 명시적으로 구분된다.
- edge creation UI가 가능한 port/edge type을 필터링한다.

## Phase 7. Edge Type과 Routing Primitive

목표:

- edge visual/routing을 edge type으로 이동한다.

Routing spec 초안:

```ts
type EdgeRoutingSpec = {
  strategy: 'shortest' | 'straight' | 'orthogonal' | 'bezier' | 'manual';
  avoidNodes?: boolean;
};
```

Presentation spec 초안:

```ts
type EdgePresentationSpec = {
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  directed?: boolean;
  markerStart?: string;
  markerEnd?: string;
  labelPlacement?: 'midpoint' | 'source' | 'target';
};
```

구현:

- 기존 edge model의 line_style/directness와 edge visual override를 edge type/edge route layer로 재검토한다.
- Model은 semantic meaning layer로 유지한다.
- EdgeType은 representation layer다.

완료 기준:

- EdgeLayer가 edge type presentation/routing을 사용한다.
- 기존 edge model fallback 없이 migration으로 edge type을 부여한다.
- edge-level override는 layout-specific visual override인지, edge instance setting인지 분리한다.

## Phase 8. Built-In Calendar Grammar

목표:

- Calendar를 grid runtime 위의 built-in network type으로 정리한다.

Built-in seed:

```text
network_type: calendar
surface_runtime: grid

node_types:
- calendar.event_item
- calendar.all_day_item
- calendar.milestone_item

edge_types:
- calendar.dependency
```

Calendar built-in 고정 영역:

- date grid 계산
- view mode shell
- event stacking
- all-day row
- recurrence expansion
- drag writeback

Primitive 재사용 영역:

- data projection
- item presentation
- color/badge rule
- limited edge presentation

완료 기준:

- Calendar plugin이 schema shape 없이 node type/projection/semantic meaning으로 item을 배치한다.
- Calendar network type은 grid runtime을 사용한다.
- Calendar 특수 알고리즘은 primitive 폭발 없이 built-in grammar/runtime boundary 안에 있다.

## Phase 9. User-Defined Canvas Network Type

목표:

- 사용자가 canvas runtime 기반 network type을 만들 수 있게 한다.

UI 범위 v1:

- network type 생성
- node type 생성/수정
- edge type 생성/수정
- renderer 선택
- projection slot 설정
- ports 설정
- edge style/routing 선택

제한:

- surface runtime은 `canvas`만 선택 가능
- custom renderer source 작성 불가
- custom routing algorithm 작성 불가
- grid runtime user-defined type은 보류

완료 기준:

- 사용자가 Algorithm 같은 custom network type을 만들 수 있다.
- 사용자가 Cause/Condition 같은 node type을 만들 수 있다.
- 사용자가 Requires/Produces 같은 edge type을 만들 수 있다.
- 이 모든 것은 system primitive 조합으로 저장된다.

## Phase 10. MCP Tool Surface와 Narre Prompt 정렬

목표:

- 변경된 network representation 개념을 Narre와 MCP가 같은 언어로 다루게 한다.
- Narre가 schema/model 설계와 network representation 설계를 혼동하지 않게 한다.
- Network Builder가 단순 node/edge 생성자가 아니라 network type grammar를 읽고 조합하는 에이전트가 되게 한다.

현재 코드베이스 조사 결과:

- `packages/netior-mcp/src/tools/network-tools.ts`의 `create_network`/`update_network`는 현재 name, scope, parent만 다루며 `network_type_id`나 `surface_runtime`을 모른다.
- `packages/netior-mcp/src/tools/network-node-tools.ts`의 `node_type`은 `basic | portal | group | hierarchy` enum이다. 이는 새 개념의 representation node type이 아니라 기존 canvas role/occurrence type에 가깝다.
- 같은 파일의 `node_config`는 `freeform | grid | list`와 sort 설정을 `metadata.nodeConfig`에 저장한다. 이 기능은 새 구조에서 node type primitive나 placement/container primitive로 재배치해야 한다.
- `packages/netior-mcp/src/tools/edge-tools.ts`의 `create_edge`/`update_edge`는 edge semantic model과 description만 다루며 `edge_type_id`, port key, routing config를 모른다.
- `packages/shared/src/constants/netior-mcp-tools.ts`의 graph tool 설명도 현재 object placement, node role, edge model binding 중심이다.
- `packages/netior-mcp/src/tools/project-tools.ts`의 `get_project_summary`는 schemas, edge_models, instances, networks, network_tree를 요약하지만 network_types, node_types, edge_types, primitive catalog, surface runtime digest를 제공하지 않는다.
- `packages/narre-server/src/project-prompt-metadata.ts`와 `packages/narre-server/src/system-prompt.ts`는 schema/model/meaning/network tree를 prompt digest로 제공하지만 network representation grammar는 제공하지 않는다.
- `packages/narre-server/src/runtime/narre-runtime.ts`의 `network-builder` system instruction은 concrete Netior network structure 생성을 말하지만 network type grammar, representation primitive, node/edge type 선택을 말하지 않는다.
- `packages/narre-server/src/prompts/bootstrap.ts`는 domain -> ontology -> workspace projection -> schema/model projection -> starter graph 순서를 갖고 있다. 이 흐름은 유지하되 workspace projection 단계에 built-in/custom network type 선택과 representation grammar 설계를 추가해야 한다.
- `docs/narre/architecture/mcp-coverage-by-surface-ko.md`는 현재 `node_type`, raw metadata, `node_config`를 NR05의 강한 coverage로 보고 있고, layout-aware placement와 edge visual override를 gap으로 본다. 새 구조에서는 이 coverage 표도 primitive/grammar 기준으로 다시 분류해야 한다.

MCP tool 변경안:

```text
list_network_representation_primitives
  - system fixed primitive catalog를 읽는다.
  - surface_runtime(canvas, grid), node renderer, edge renderer, routing strategy,
    projection source, port placement, container placement primitive를 포함한다.

list_network_types
get_network_type
create_network_type
update_network_type
delete_network_type
  - 사용자 정의 network type grammar를 다룬다.
  - built-in network type은 삭제/임의 수정이 불가능해야 한다.

list_node_types
create_node_type
update_node_type
delete_node_type
  - 특정 network type 안의 representation node type을 다룬다.
  - renderer, projection, interface/ports, placement, interaction spec을 저장한다.

list_edge_types
create_edge_type
update_edge_type
delete_edge_type
  - 특정 network type 안의 representation edge type을 다룬다.
  - edge semantic model과 representation edge type은 분리한다.

validate_network_grammar
  - network type, node types, edge types가 system primitive catalog와 runtime contract를 만족하는지 저장 전 검증한다.
```

기존 graph tool 변경안:

- `create_network`는 `network_type_id` 또는 stable `network_type_key`를 받는다. 생략 허용은 하지 않는다. 새 네트워크는 반드시 어떤 network type의 instance인지 명시한다.
- `update_network`는 network type 변경을 별도 정책으로 다룬다. runtime이 달라지는 변경은 migration/confirmation이 필요한 고위험 변경이다.
- `get_network_full`은 network, network type, resolved node types, resolved edge types, runtime key, primitive resolution diagnostics를 함께 반환한다.
- `create_network_node`의 기존 `node_type` 문자열은 `node_type_id` 또는 `node_type_key`로 대체한다. 기존 `basic/portal/group/hierarchy` 값은 migration에서 built-in default node type으로 변환하고 tool schema에서는 제거한다.
- `update_network_node`도 `node_type_id` 또는 `node_type_key`를 사용한다. role/container 설정은 node type spec 또는 runtime-specific placement state로 이동한다.
- `create_edge`는 `edge_type_id` 또는 `edge_type_key`를 받는다. `model_id`는 edge의 의미이고, `edge_type_id`는 표현이다. 둘은 서로 대체하지 않는다.
- `create_edge`/`update_edge`는 `source_port_key`, `target_port_key`, optional `route_json`을 다룬다.
- layout node position/edge visual tool은 단순 visual override 도구가 아니라 runtime-specific placement state 도구로 재분류한다.

Narre prompt 변경안:

- base system prompt의 Search Strategy에 다음 구분을 추가한다.
  - schema/model: 작업 세계에 무엇이 존재하고 어떤 의미를 갖는지
  - network type: 어떤 작업 표면을 만들지
  - node type/edge type: 그 표면에서 무엇이 어떤 표현으로 나타나는지
  - primitive: 시스템이 제공하는 미시적 표현 도구
- Tool Policy에 `list_network_representation_primitives`와 `list_network_types`를 우선 조회하는 규칙을 추가한다. 네트워크를 만들거나 재구성하기 전에는 target network type을 먼저 결정한다.
- Network Builder system instruction을 갱신한다. Network Builder는 사용자 의도를 concrete network structure로만 바꾸는 것이 아니라, 필요하면 custom canvas network type grammar를 설계하고 검증한 뒤 node/edge를 배치한다.
- `/bootstrap`의 Stage 3 Workspace Projection에 다음 단계를 추가한다.
  1. built-in Default/Calendar가 충분한지 판단한다.
  2. 충분하지 않으면 user-defined canvas network type이 필요한지 판단한다.
  3. custom network type이면 node type, edge type, projection, ports, routing을 먼저 제안한다.
  4. 승인 후 네트워크, 스키마/모델, 인스턴스, node/edge placement를 생성한다.
- Calendar 요청에서는 custom calendar-like primitive 폭발을 만들지 않는다. built-in Calendar network type과 grid runtime을 선택하고, item projection만 의미/DSL 기반으로 조정한다.
- Narre는 schema visual default를 만들거나 요구하지 않는다. 노드 카드에 보일 필드는 node type projection spec으로 다룬다.

평가와 문서 변경안:

- `docs/narre/architecture/mcp-coverage-by-surface-ko.md`의 NR05/NR06/NR13을 새 grammar 기준으로 재분류한다.
- `docs/narre/plans/mcp-expansion-plan.md`의 graph/layout tool 계획을 network type, node type, edge type, primitive catalog 중심으로 갱신한다.
- Narre eval에 다음 시나리오를 추가한다.
  - Algorithm network 생성: Cause/Condition node type, Requires/Produces edge type, port 있는 node와 port 없는 node를 구분한다.
  - Calendar network 생성: built-in Calendar network type을 선택하고 custom grid runtime을 만들지 않는다.
  - 기존 schema에 node shape를 추가하려 하지 않고 node type projection으로 카드 표시를 설계한다.
  - edge semantic model과 edge representation type을 동시에 올바르게 지정한다.

완료 기준:

- MCP tool schema에서 기존 role 문자열 `node_type`이 새 representation node type과 충돌하지 않는다.
- Narre prompt digest가 network type grammar와 primitive catalog를 포함한다.
- Network Builder가 network type을 먼저 선택하거나 생성한 뒤 node/edge를 배치한다.
- `get_project_summary`와 `get_network_full`만 읽어도 Narre가 현재 네트워크 표현 문법을 이해할 수 있다.
- Calendar와 Default built-in network type은 사용자 정의 network type과 같은 읽기 계약으로 노출된다.

## Phase 11. Cleanup과 Legacy 차단

목표:

- 새 구조가 들어간 뒤 옛 경로가 재도입되지 않게 한다.

제거 대상:

- schema-owned node rendering code
- shape fallback path
- renderer-level default rectangle fallback
- edge model visual fallback 중 representation 책임에 해당하는 부분
- legacy locale key
- Narre/MCP에서 schema visual을 암시하는 prompt/tool schema

검증:

```bash
rg "node_shape|nodeShape"
rg "shape.*schema|schema.*shape"
rg "rectangle.*fallback|fallback.*rectangle"
```

완료 기준:

- 옛 경로 이름이 migration/eval fixture 외 활성 소스에서 발견되지 않는다.
- 새 network type/node type/edge type 경로에 테스트가 있다.
- built-in seed 누락 시 테스트가 실패한다.

## 테스트 계획

Core:

- migration applies to existing database
- built-in default grammar exists per project
- every network has network type
- every network node has node type
- every edge has edge type
- node type/edge type CRUD
- cascade behavior

Shared:

- type validation helpers
- primitive spec validation
- DSL projection spec validation

Desktop renderer:

- default network renders through node type renderer
- no schema shape dependency
- ports resolve edge endpoints
- edge routing strategy changes path
- projection renders meaning-bound values

MCP/Narre:

- create/update network type
- create/update node type
- create/update edge type
- Narre prompt describes primitive composition, not schema visual defaults
- confirmation preview displays projection/interface/edge primitive settings

Calendar:

- time.start item appears in grid
- all-day item appears in all-day row
- drag writes date/time fields
- recurrence expansion still works
- Calendar does not require user-defined grid primitive authoring

## Open Questions

- `network_type_id`는 project-scoped built-in row로 둘지, global built-in row와 project overlay를 나눌지 결정해야 한다.
- built-in grammar update versioning을 어떻게 할지 정해야 한다.
- edge semantic model과 edge representation type의 연결 UI를 어떻게 보여줄지 정해야 한다.
- node type assignment를 자동 제안할 때 DSL discovery 결과를 어느 시점에 저장할지 정해야 한다.
- grid runtime을 user-defined에 언제 열지 결정해야 한다.

## 권장 구현 순서 요약

1. Core grammar tables and types
2. Default built-in grammar seed and migration
3. Surface runtime registry
4. Node renderer registry
5. Data projection primitive
6. Node interface and ports
7. Edge type and routing
8. Calendar on grid runtime
9. User-defined canvas network type UI
10. MCP tool surface and Narre prompt alignment
11. Legacy cleanup and regression tests
