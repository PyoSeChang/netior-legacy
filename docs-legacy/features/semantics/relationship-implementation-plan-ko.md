# Relationship Implementation Plan

작성일: 2026-05-20

## 목표

네트워크에 종속되지 않는 객체 간 관계를 1급 데이터로 추가한다.

현재 `edges`는 `network_id`, `source_node_id`, `target_node_id`를 가지므로 특정 network surface 안의 node occurrence 연결이다. 따라서 project/domain layer의 독립 관계는 별도 `relationships`로 만든다.

핵심 분리:

```text
Model
- 의미 타입

Relationship
- 특정 object와 object 사이에 실제로 존재하는 관계
- model_id가 의미를 결정한다

Network Edge
- 특정 network 안에서 relationship을 표현하는 occurrence
- edge_type_id가 표현 방식을 결정한다
```

## 현재 코드베이스 조사

### Edge 저장 구조

- `packages/shared/src/types/index.ts`
  - `Edge`는 `network_id`, `source_node_id`, `target_node_id`, `model_id`, `edge_type_id`를 가진다.
  - 현재 `model_id`는 edge의 의미를 직접 가리킨다.
- `packages/netior-core/src/repositories/network.ts`
  - `createEdge`, `updateEdge`, `deleteEdge`는 network edge row만 다룬다.
  - `getNetworkFull`은 network 안의 node/edge와 model, edge type 정보를 같이 반환한다.
- `packages/netior-mcp/src/tools/edge-tools.ts`
  - MCP `create_edge`는 network node 간 edge를 만든다.
  - 이미 `edge_type_id`, port, route 필드가 열려 있지만 relationship은 없다.

결론:

- 기존 Edge는 유지하되 relationship 표현 occurrence로 재정의해야 한다.
- Edge 자체를 독립 관계로 확장하면 network representation과 domain relationship이 다시 섞인다.

### UI 패턴

- `packages/desktop-app/src/renderer/components/editor/EdgeEditor.tsx`
  - 현재 edge의 source/target node label, model, description, visual override를 편집한다.
  - 이 패턴은 `RelationshipEditor`의 기본 form 구조로 재사용 가능하다.
- `packages/desktop-app/src/renderer/components/workspace/NodeContextMenu.tsx`
  - edit mode에서 `Add connection`을 시작한다.
- `packages/desktop-app/src/renderer/components/workspace/NetworkWorkspace.tsx`
  - 연결 gesture 후 `addEdge` 또는 `networkService.edge.create`를 호출한다.
  - hierarchy/contains/entry portal 같은 구조 edge도 같은 edge 생성 경로를 사용한다.
- `packages/desktop-app/src/renderer/services/network-service.ts`
  - renderer service는 `window.electron.*` IPC를 얇게 감싼다.
- `packages/desktop-app/src/main/ipc/network-ipc.ts`
  - main IPC는 netior-service HTTP client를 호출하고 `broadcastChange`를 날린다.

결론:

- Relationship UI도 같은 7-layer 패턴을 따른다.
- editor tab type은 `relationship`을 추가하는 것이 자연스럽다.
- network gesture는 기본적으로 `relationship + edge occurrence`를 함께 만들 수 있어야 한다.

### Model 의미 구조

- `packages/shared/src/types/index.ts`
  - `ModelTargetKind`는 현재 `object | edge | both` 흐름이다.
- `packages/desktop-app/src/renderer/components/editor/ModelEditor.tsx`
  - target kind UI도 object/edge/both를 노출한다.
- `packages/netior-mcp/src/tools/model-tools.ts`
  - MCP `create_model`도 `target_kind: object | edge | both`를 받는다.
- `packages/narre-server/src/system-prompt.ts`
  - `Edge Models`라는 표현을 사용하고 `target_kind === 'edge' || 'both'`를 edge meaning으로 읽는다.

결론:

- 새 relationship 도입과 함께 `edge model` 표현은 `relationship model`로 바꿔야 한다.
- 단번에 `edge` 값을 제거하면 범위가 크므로 migration 단계는 `edge -> relationship`, `both -> object_relationship` 같은 정규화가 필요하다.

## 데이터 모델 계획

### Phase 1. Relationship 테이블 추가

새 migration:

```sql
relationships (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_object_id TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  target_object_id TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  model_id TEXT REFERENCES models(id) ON DELETE SET NULL,
  description TEXT,
  properties_json TEXT,
  source_kind TEXT NOT NULL DEFAULT 'project',
  source_id TEXT,
  source_ref TEXT,
  source_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

인덱스:

```sql
idx_relationships_project
idx_relationships_source_object
idx_relationships_target_object
idx_relationships_model
```

shared type:

```ts
interface Relationship {
  id: string;
  project_id: string;
  source_object_id: string;
  target_object_id: string;
  model_id: string | null;
  description: string | null;
  properties_json: string | null;
  source_kind: OntologySourceKind;
  source_id: string | null;
  source_ref: string | null;
  source_version: string | null;
  created_at: string;
  updated_at: string;
}
```

### Phase 2. Edge가 relationship을 표현하게 만들기

`edges`에 추가:

```sql
edges.relationship_id TEXT REFERENCES relationships(id) ON DELETE SET NULL
```

초기 전환:

- 기존 edge는 migration에서 relationship row를 생성하고 `edges.relationship_id`를 채운다.
- 기존 `edges.model_id`와 `edges.description`은 생성된 relationship으로 이동한다.
- 전환 중에는 `edges.model_id`를 읽기 호환으로 남기되 새 write path는 relationship을 우선한다.
- 최종 cleanup 단계에서 `edges.model_id`와 edge description 의미 필드는 제거한다.

주의:

- hierarchy/contains/entry portal처럼 network 구조 유지용 edge는 domain relationship으로 올릴지 정책이 필요하다.
- 1차 구현에서는 구조 edge도 relationship을 만들되 `source_kind='system'` 또는 `properties_json.kind='network_structure'`로 구분한다.

## Core/Service 구현 계획

### Core repository

새 파일:

```text
packages/netior-core/src/repositories/relationship.ts
```

함수:

```ts
listRelationships(projectId, filters)
getRelationship(id)
createRelationship(data)
updateRelationship(id, data)
deleteRelationship(id)
listRelationshipOccurrences(relationshipId)
```

Edge repository 변경:

```ts
createEdge({
  network_id,
  source_node_id,
  target_node_id,
  relationship_id,
  edge_type_id,
  source_port_key,
  target_port_key,
  route_json
})
```

편의 함수:

```ts
createRelationshipWithNetworkEdge({
  project_id,
  source_node_id,
  target_node_id,
  model_id,
  description,
  network_id,
  edge_type_id
})
```

### Service route

새 HTTP:

```text
GET    /relationships?projectId=&sourceObjectId=&targetObjectId=&modelId=
POST   /relationships
GET    /relationships/:id
PATCH  /relationships/:id
DELETE /relationships/:id
GET    /relationships/:id/occurrences
POST   /relationship-occurrences
```

기존 `/edges`:

- `relationship_id`를 받게 한다.
- `model_id`/`description` 직접 write는 deprecated path로 격리한다.

## Desktop UI Flow 계획

### Flow A. Network gesture에서 관계 만들기

현재:

```text
right-click node -> add connection -> click target -> create_edge
```

변경:

```text
right-click node -> add relationship
click target node
RelationshipCreateDialog
  - source object
  - target object
  - relationship model
  - description
  - also show on this network: checked
  - edge type
save
  - create_relationship
  - create_edge with relationship_id
```

단축 flow:

- 사용자가 model 선택 없이 빠르게 연결하면 relationship model은 null로 만들 수 있다.
- 이후 `RelationshipEditor`에서 의미를 채운다.

### Flow B. Relationship editor

새 editor:

```text
packages/desktop-app/src/renderer/components/editor/RelationshipEditor.tsx
```

구성은 `EdgeEditor` 패턴을 따른다.

필드:

- source object label
- target object label
- relationship model select
- description
- properties JSON 또는 추후 structured properties
- occurrence list
  - 어느 network에 edge로 표현되어 있는지
  - 현재 network에 표현 추가
  - occurrence 삭제

### Flow C. Edge editor

`EdgeEditor`는 network occurrence editor로 축소한다.

필드:

- represented relationship summary
- edge type select
- source/target port select
- route strategy or route JSON
- visual override
- button: open relationship

EdgeEditor에서 relationship model을 직접 수정하지 않는다.

## MCP Tool 계획

새 도구:

```text
list_relationships
get_relationship
create_relationship
update_relationship
delete_relationship
list_relationship_occurrences
create_relationship_occurrence
delete_relationship_occurrence
```

`create_relationship`:

```json
{
  "project_id": "...",
  "source_object_id": "...",
  "target_object_id": "...",
  "model_id": "...",
  "description": "...",
  "properties_json": "{}"
}
```

`create_relationship_occurrence`:

```json
{
  "relationship_id": "...",
  "network_id": "...",
  "source_node_id": "...",
  "target_node_id": "...",
  "edge_type_id": "...",
  "source_port_key": null,
  "target_port_key": null
}
```

기존 도구 변경:

- `create_edge`는 `relationship_id`를 받는다.
- `create_edge`에서 `model_id`를 직접 받는 경로는 제거 대상이다.
- `get_network_full`은 edge마다 `relationship`과 `relationship.model`을 포함한다.
- `get_project_summary`는 relationship model과 relationship count를 포함한다.

## Narre Prompt 계획

용어 변경:

- `Edge Models` -> `Relationship Models`
- `edge meaning` -> `relationship meaning`
- `network edge` -> `relationship occurrence on a network`

정책:

- 사용자가 객체 사이의 실제 관계를 말하면 `create_relationship`을 사용한다.
- 사용자가 화면 위 연결, 라우팅, 포트, 선 모양을 말하면 `edge_type` 또는 edge occurrence를 수정한다.
- Relationship 생성 전에는 source/target object를 resolve한다.
- Relationship을 현재 network에 보여줘야 할 때만 occurrence를 만든다.

Network Builder:

- starter graph를 만들 때 relationship을 먼저 만들고, network edge는 표현으로 만든다.
- Calendar/Algorithm 같은 network type에서는 relationship model과 edge type을 동시에 구분한다.

## Model Target Kind 정리 계획

단계적 변경:

1. 새 타입 이름 도입:

```ts
type ModelTargetKind = 'schema' | 'field' | 'relationship';
```

2. migration:

```text
object -> schema
edge -> relationship
both -> schema_relationship
```

단 `both`는 새 enum에 바로 넣기보다 실제 사용처를 보고 분해한다.

3. UI:

- ModelEditor target kind label을 `Schema`, `Field`, `Relationship`으로 변경한다.
- relationship model일 때만 line style/directed 같은 legacy edge visual default를 숨긴다.
- visual default는 edge type으로 이동한다.

4. MCP:

- `create_model.target_kind`를 `schema | field | relationship`으로 변경한다.
- 기존 `edge` 입력은 받지 않는다.

## 구현 순서

1. Relationship shared type과 migration 추가
2. relationship repository 추가
3. service HTTP route 추가
4. desktop main IPC/preload/renderer service 추가
5. MCP relationship tools 추가
6. existing edge write path에 `relationship_id` 추가
7. `get_network_full`이 relationship 포함하도록 확장
8. RelationshipCreateDialog와 RelationshipEditor 추가
9. NetworkWorkspace connection flow를 `relationship + edge occurrence`로 변경
10. EdgeEditor를 occurrence editor로 정리
11. Narre prompt와 project summary를 relationship 기준으로 수정
12. model target kind를 relationship 용어로 migration
13. legacy cleanup: edge model, relation type, edge description 의미 write path 제거

## 테스트 계획

Core:

- relationship CRUD
- object delete cascade
- model delete set null
- edge occurrence delete가 relationship을 삭제하지 않는지
- relationship delete가 edge relationship_id를 null로 만들거나 occurrence를 삭제하는 정책 검증

Service/MCP:

- create_relationship
- create_relationship_occurrence
- get_network_full relationship hydration
- create_edge가 relationship_id를 보존

Desktop:

- node connection gesture가 relationship과 edge occurrence를 만든다.
- RelationshipEditor에서 model/description 수정 후 network edge가 같은 relationship을 참조한다.
- EdgeEditor에서 edge type/visual만 바뀌고 relationship 의미는 바뀌지 않는다.

Narre:

- "A가 B의 원인이다"는 relationship을 만든다.
- "이 네트워크에서는 원인 관계를 점선으로 보여줘"는 edge type/occurrence를 수정한다.
- "A와 B를 이 화면에서 연결해줘"는 existing relationship reuse 또는 새 relationship 생성 후 occurrence 생성으로 처리한다.

## Open Questions

- relationship delete 시 edge occurrence를 같이 삭제할지, `relationship_id=null`로 남길지 결정해야 한다.
- schema field reference와 relationship을 자동 동기화할지 여부를 정해야 한다.
- hierarchy/contains 같은 network-structural edge를 domain relationship으로 승격할지, system relationship으로만 둘지 결정해야 한다.
- `both` model target을 어떻게 분해할지 실제 모델 데이터를 보고 결정해야 한다.
