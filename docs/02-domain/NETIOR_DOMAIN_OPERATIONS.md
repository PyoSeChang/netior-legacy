# Netior Domain Operations

이 문서는 Netior의 domain operation 초안을 정리한다.

목적은 View를 만들기 전에, Netior의 world가 어떤 방식으로 정의되고 동작하고 변화하는지 service API의 언어를 먼저 잡는 것이다. Desktop UI, MCP, Narre, interactive HTML view는 모두 이 operation 위에 올라가야 한다.

이 문서의 operation 이름은 JSON-RPC method 후보로 볼 수 있다. 이름과 parameter는 구현 중 조정될 수 있지만, 각 operation의 책임은 domain model과 일관되어야 한다.

## 기본 원칙

- View는 domain state의 source of truth가 아니다.
- View보다 먼저 world operation API가 정의되어야 한다.
- CRUD도 단순 DB 조작이 아니라 world의 동작이다.
- Domain logic은 `netior-service`에만 있어야 한다.
- Desktop, MCP, Narre, interactive view는 service operation을 호출하는 client 또는 adapter여야 한다.
- 실시간 변화 구독은 JSON-RPC보다는 SSE event stream으로 제공한다.

## World / Model Tree

World와 Model은 단일 tree로 표현된다. Root node는 World이고, child node는 Model이다.

| Operation | Description |
|---|---|
| `world.create` | 새 World를 만들고 root directory를 연결한다. |
| `world.get` | 특정 World의 기본 정보와 root 설정을 조회한다. |
| `world.list` | 등록된 World 목록을 조회한다. |
| `world.rename` | World의 표시 이름을 변경한다. |
| `world.updateSettings` | World 단위 설정을 수정한다. |
| `world.archive` | World를 삭제하지 않고 보관 상태로 전환한다. |
| `model.create` | World 또는 Model 아래에 새 Model을 만든다. |
| `model.get` | 특정 Model의 정보와 tree 위치를 조회한다. |
| `model.list` | 특정 World 안의 Model 목록을 조회한다. |
| `model.rename` | Model의 표시 이름을 변경한다. |
| `model.move` | Model을 다른 parent 아래로 이동한다. |
| `model.archive` | Model을 삭제하지 않고 보관 상태로 전환한다. |
| `worldNode.getChildren` | 특정 World/Model node의 직접 child Model 목록을 조회한다. |
| `worldNode.getParent` | 특정 World/Model node의 parent를 조회한다. |
| `worldNode.getAncestors` | 특정 World/Model node의 ancestor chain을 조회한다. |
| `worldNode.getDescendants` | 특정 World/Model node 아래의 모든 descendant Model을 조회한다. |
| `worldNode.getTree` | 특정 World 전체 또는 특정 node 아래의 tree를 조회한다. |
| `worldNode.move` | World/Model tree 안에서 Model의 parent를 변경한다. |
| `worldNode.reorderChildren` | 같은 parent 아래 child Model의 표시 순서를 변경한다. |
| `worldNode.resolvePath` | directory path 또는 model path로 대응되는 World/Model node를 찾는다. |
| `worldNode.getVisibleDefinitions` | 특정 node에서 보이는 Kind, Property, RelationKind를 ancestor 포함 기준으로 조회한다. |

`archive`는 hard delete가 아니다. 삭제하지 않고 기본 화면에서 숨기거나 비활성화하는 soft delete에 가깝다. 과거 evidence, decision, event, relation과의 연결을 보존하기 위해 필요하다.

## Directory / Model Binding

Directory는 물리적 구조이고, Model은 의미적 구조다. Directory가 자동으로 Model이 되지는 않는다.

| Operation | Description |
|---|---|
| `model.bindDirectory` | Model을 world root 기준 directory subtree에 연결한다. |
| `model.unbindDirectory` | Model과 directory subtree의 연결을 제거한다. |
| `model.listDirectoryBindings` | Model에 연결된 directory binding 목록을 조회한다. |
| `model.promoteDirectory` | 관찰된 directory를 Model로 승격하고 binding을 만든다. |
| `model.validateDirectoryBindings` | Model directory binding이 중복이나 overlap 제약을 위반하지 않는지 검사한다. |
| `directory.observe` | World root 아래 특정 directory/file을 관찰 대상 Resource로 등록한다. |
| `directory.listObserved` | 특정 path 아래 관찰된 directory/file resource를 조회한다. |
| `directory.getModelBinding` | 특정 directory path가 어떤 Model에 binding되어 있는지 조회한다. |
| `directory.suggestModelPromotion` | directory를 Model로 승격할 후보로 제안한다. |
| `directory.promoteToModel` | 관찰된 directory를 Model로 승격하고 binding을 만든다. |
| `directory.ignore` | 특정 directory/file을 관찰 또는 해석 대상에서 제외한다. |

초기 제약:

- World는 하나의 root directory를 가진다.
- Model은 0개 이상의 directory binding을 가진다.
- 한 directory subtree는 최대 하나의 Model에만 binding된다.
- Directory binding overlap은 service에서 검증한다.

## Kind

Kind는 World/Model 안에 존재할 수 있는 대상의 종류다.

| Operation | Description |
|---|---|
| `kind.create` | 특정 World/Model에 새 Kind를 정의한다. |
| `kind.get` | 특정 Kind 정의를 조회한다. |
| `kind.list` | 특정 World/Model에 직접 정의된 Kind 목록을 조회한다. |
| `kind.listVisible` | 특정 Model에서 사용할 수 있는 Kind 목록을 ancestor 포함 기준으로 조회한다. |
| `kind.rename` | Kind의 표시 이름을 변경한다. |
| `kind.updateDescription` | Kind 설명을 수정한다. |
| `kind.archive` | Kind를 삭제하지 않고 보관 상태로 전환한다. |

초기 제약:

- Kind는 특정 World/Model에 정의된다.
- 하위 Model은 상위 Model/World의 Kind를 볼 수 있다.
- Sibling Model의 Kind는 초기에는 보이지 않는다.
- Override와 shadowing은 초기에는 금지한다.

## Property

Property는 Kind가 가질 수 있는 속성의 정의다. Property는 값을 가지지 않는다.

| Operation | Description |
|---|---|
| `property.create` | 특정 Kind에 새 Property를 정의한다. |
| `property.get` | 특정 Property 정의를 조회한다. |
| `property.list` | 특정 Kind의 Property 목록을 조회한다. |
| `property.rename` | Property의 표시 이름을 변경한다. |
| `property.updateDescription` | Property 설명을 수정한다. |
| `property.updateValueType` | Property의 값 타입을 변경한다. |
| `property.updateCardinality` | Property의 cardinality 정책을 변경한다. |
| `property.updateRequiredPolicy` | Property의 필수 여부 정책을 변경한다. |
| `property.reorder` | Kind 안에서 Property 표시 순서를 변경한다. |
| `property.archive` | Property를 삭제하지 않고 보관 상태로 전환한다. |

초기 제약:

- Property definition에는 value를 저장하지 않는다.
- Property value는 Instance에 속한다.
- Computed, conditional, derived property는 초기에는 capability/rule 계층으로 보류한다.

## RelationKind

RelationKind는 Instance와 Instance 사이에 가능한 관계의 종류다. 양쪽 endpoint에 올 수 있는 Kind를 제한할 수 있어야 한다.

| Operation | Description |
|---|---|
| `relationKind.create` | 특정 World/Model에 새 RelationKind를 정의한다. |
| `relationKind.get` | 특정 RelationKind 정의를 조회한다. |
| `relationKind.list` | 특정 World/Model에 직접 정의된 RelationKind 목록을 조회한다. |
| `relationKind.listVisible` | 특정 Model에서 사용할 수 있는 RelationKind 목록을 ancestor 포함 기준으로 조회한다. |
| `relationKind.rename` | RelationKind의 표시 이름을 변경한다. |
| `relationKind.updateDescription` | RelationKind 설명을 수정한다. |
| `relationKind.updateDirected` | RelationKind의 방향성 설정을 변경한다. |
| `relationKind.updateEndpointPolicy` | RelationKind 양쪽 endpoint에 허용되는 Kind 제약을 수정한다. |
| `relationKind.updateCardinalityPolicy` | RelationKind의 cardinality 정책을 수정한다. |
| `relationKind.archive` | RelationKind를 삭제하지 않고 보관 상태로 전환한다. |

초기 제약:

- RelationKind는 binary relation으로 시작한다.
- Directed relation은 subject/object endpoint를 가진다.
- Undirected relation도 endpoint Kind constraint를 가진다.
- Accepted relation은 endpoint Kind constraint를 만족해야 한다.

## Instance

Instance는 World 안에서 의미적으로 식별되는 대상이다.

| Operation | Description |
|---|---|
| `instance.create` | 특정 home Model에 새 Instance를 만든다. |
| `instance.get` | 특정 Instance의 기본 정보와 할당 상태를 조회한다. |
| `instance.list` | 특정 Model의 Instance 목록을 조회한다. |
| `instance.rename` | Instance의 표시 이름을 변경한다. |
| `instance.updateDisplayName` | Instance의 표시 이름을 수정한다. |
| `instance.moveHomeModel` | Instance의 home Model을 변경하고 Kind 가시성 제약을 검증한다. |
| `instance.archive` | Instance를 삭제하지 않고 보관 상태로 전환한다. |
| `instance.restore` | 보관된 Instance를 복원한다. |

초기 제약:

- Instance는 하나의 home Model을 가진다.
- Instance는 home Model에서 visible한 여러 Kind를 가질 수 있다.
- Instance를 이동하면 기존 Kind assignment가 새 home Model에서 visible한지 검증해야 한다.

## Resource

Resource는 Instance의 원본, 위치, 근거, 내용의 출처다. Resource는 ontology relation의 endpoint가 아니다.

| Operation | Description |
|---|---|
| `resource.register` | 파일, 폴더, URL, service object, sub-resource 등을 Resource로 등록한다. |
| `resource.get` | 특정 Resource의 source 정보와 관찰 상태를 조회한다. |
| `resource.list` | 특정 World/Model 기준 Resource 목록을 조회한다. |
| `resource.createSubResource` | 기존 Resource 내부의 JSON path, text span, page 등 sub-resource를 등록한다. |
| `resource.updateObservedStatus` | Resource의 observed, changed, missing, ignored 상태를 갱신한다. |
| `resource.updateFingerprint` | Resource의 관찰 fingerprint를 갱신한다. |
| `resource.archive` | Resource를 삭제하지 않고 보관 상태로 전환한다. |

초기 제약:

- Local file/folder Resource는 World 안에서 stable path identity를 가진다.
- Sub-resource는 parent Resource와 locator로 식별한다.
- ChangeEvent는 Resource에서 측정된다.

## Instance / Resource Mapping

Instance와 Resource는 분리된다. 둘의 연결은 Evidence 자체가 아니라 source mapping이다.

| Operation | Description |
|---|---|
| `instance.linkResource` | Instance와 Resource를 source mapping으로 연결한다. |
| `instance.unlinkResource` | Instance와 Resource의 연결을 제거한다. |
| `instance.setPrimaryResource` | Instance의 대표 Resource를 지정한다. |
| `instance.listResources` | Instance에 연결된 Resource 목록을 조회한다. |

초기 제약:

- Instance와 Resource는 N:M 관계를 가질 수 있다.
- 하나의 Instance는 primary Resource를 최대 하나만 가지는 것으로 시작한다.
- `role`, `derived_from` 같은 이름은 RelationKind와 혼동될 수 있으므로 초기에는 쓰지 않는다.

## Kind Assignment

Kind assignment는 "이 Instance는 이 Kind다"라는 판단 기록이다.

| Operation | Description |
|---|---|
| `instance.assignKind` | Instance에 Kind를 candidate 또는 accepted 상태로 할당한다. |
| `instance.unassignKind` | Instance의 Kind 할당을 제거하거나 supersede한다. |
| `instance.listKindAssignments` | Instance의 Kind 할당 목록을 조회한다. |
| `kindAssignment.accept` | candidate Kind assignment를 accepted로 전환한다. |
| `kindAssignment.reject` | candidate Kind assignment를 rejected로 전환한다. |
| `kindAssignment.supersede` | 기존 Kind assignment를 새 판단으로 대체한다. |

초기 제약:

- 같은 Instance/Kind 조합의 accepted assignment는 중복될 수 없다.
- Kind는 Instance의 home Model에서 visible해야 한다.
- AI가 만든 assignment는 기본적으로 candidate로 들어온다.

## Property Value

Property value는 Instance가 특정 Property 값을 가진다는 기록이다.

| Operation | Description |
|---|---|
| `propertyValue.create` | Instance에 특정 Property 값을 candidate 또는 accepted 상태로 기록한다. |
| `propertyValue.get` | 특정 Property value 기록을 조회한다. |
| `propertyValue.list` | Instance의 Property value 목록을 조회한다. |
| `propertyValue.update` | Property value의 값을 수정한다. |
| `propertyValue.accept` | candidate Property value를 accepted로 전환한다. |
| `propertyValue.reject` | candidate Property value를 rejected로 전환한다. |
| `propertyValue.supersede` | 기존 Property value를 새 값으로 대체한다. |
| `propertyValue.archive` | Property value를 삭제하지 않고 보관 상태로 전환한다. |

초기 제약:

- Property의 Kind는 Instance의 accepted Kind 중 하나와 호환되어야 한다.
- Property cardinality가 single이면 accepted value는 하나만 허용한다.
- Value는 Resource에서 오지 않아도 된다.

## Relation

Relation은 Instance와 Instance 사이에 생긴다.

| Operation | Description |
|---|---|
| `relation.create` | 두 Instance 사이에 RelationKind에 해당하는 관계를 candidate 또는 accepted 상태로 기록한다. |
| `relation.get` | 특정 Relation 기록을 조회한다. |
| `relation.list` | Model 또는 Instance 기준 Relation 목록을 조회한다. |
| `relation.accept` | candidate Relation을 accepted로 전환한다. |
| `relation.reject` | candidate Relation을 rejected로 전환한다. |
| `relation.supersede` | 기존 Relation 판단을 새 판단으로 대체한다. |
| `relation.archive` | Relation을 삭제하지 않고 보관 상태로 전환한다. |

초기 제약:

- Accepted relation은 RelationKind의 endpoint Kind constraint를 만족해야 한다.
- Undirected relation은 service에서 endpoint 순서를 normalize할 수 있다.
- Resource는 Relation endpoint가 아니다.

## Evidence

Evidence는 특정 판단, 값, 관계가 어디서 왔는지 또는 왜 그렇게 판단되었는지에 대한 근거다.

| Operation | Description |
|---|---|
| `evidence.create` | Resource locator, 사용자 입력, AI reasoning, 계산 결과 등의 Evidence를 만든다. |
| `evidence.get` | 특정 Evidence를 조회한다. |
| `evidence.listForTarget` | 특정 assignment, value, relation에 연결된 Evidence 목록을 조회한다. |
| `evidence.linkToTarget` | Evidence를 Kind assignment, Property value, Relation 등에 연결한다. |
| `evidence.unlinkFromTarget` | Evidence와 target의 연결을 제거한다. |
| `evidence.archive` | Evidence를 삭제하지 않고 보관 상태로 전환한다. |
| `evidence.listChanged` | 특정 시점 이후 생성, 수정, 보관된 Evidence를 조회한다. |
| `evidence.getHistory` | 특정 Evidence의 변경 이력을 조회한다. |

초기 제약:

- Evidence는 Resource를 가리킬 수도 있고, 가리키지 않을 수도 있다.
- Instance-Resource mapping은 Evidence 자체가 아니다.
- Resource 없는 user input, user decision, AI reasoning, calculation evidence가 가능해야 한다.

## Decision

Decision은 후보 판단에 대한 승인, 거절, 수정 결정 기록이다.

| Operation | Description |
|---|---|
| `decision.record` | 후보 판단에 대한 승인, 거절, 수정 결정을 기록한다. |
| `decision.get` | 특정 Decision을 조회한다. |
| `decision.listForTarget` | 특정 target에 대한 Decision 이력을 조회한다. |
| `decision.listChanged` | 특정 시점 이후 기록된 Decision을 조회한다. |

초기 제약:

- Candidate를 accepted로 전환하려면 decision 또는 명시된 policy가 있어야 한다.
- Decision은 validator가 분석할 수 있는 기록으로 남아야 한다.

## Validation

Validation operation은 domain invariant를 검사한다. 일부는 public API가 아니라 service 내부에서 호출될 수 있다.

| Operation | Description |
|---|---|
| `definition.validateVisibility` | 특정 Model에서 Kind, Property, RelationKind 가시성 규칙이 유효한지 검사한다. |
| `instance.validateKindAssignments` | Instance의 Kind assignment가 home Model의 가시성 규칙을 만족하는지 검사한다. |
| `propertyValue.validate` | Property value가 Property type/cardinality와 Instance Kind 조건을 만족하는지 검사한다. |
| `relation.validateEndpointKinds` | Relation의 subject/object Instance가 RelationKind endpoint 제약을 만족하는지 검사한다. |
| `model.validateDirectoryBindings` | Model directory binding이 중복이나 overlap 제약을 위반하지 않는지 검사한다. |

## Query

Query operation은 View, Sidebar, MCP, Narre가 공통으로 사용할 기본 조회 API다.

| Operation | Description |
|---|---|
| `model.summary` | Model의 Kind, RelationKind, Instance, Resource, Relation 요약을 반환한다. |
| `model.listDefinitions` | Model에서 보이는 Kind, Property, RelationKind를 한 번에 조회한다. |
| `model.listInstances` | Model에 속한 Instance 목록을 조회한다. |
| `model.listResources` | Model에 속하거나 연결된 Resource 목록을 조회한다. |
| `model.listRelations` | Model 안의 Relation 목록을 조회한다. |
| `model.listUnassignedResources` | 아직 Instance에 연결되지 않았거나 Kind가 할당되지 않은 Resource를 조회한다. |
| `instance.neighborhood` | 특정 Instance 주변의 관련 Instance, Relation, Resource를 조회한다. |

## Domain Event / History / Diff

세계가 동작한다는 것은 세계가 변화한다는 뜻이다. 따라서 CRUD operation과 별도로 domain event, history, diff를 다룰 수 있어야 한다.

| Operation | Description |
|---|---|
| `assignment.listChanged` | 특정 시점 이후 변경된 Kind assignment, Property value, Relation을 조회한다. |
| `assignment.getHistory` | 특정 assignment, value, relation의 변경 이력을 조회한다. |
| `domainEvent.record` | service 내부 또는 trusted client가 domain event를 기록한다. 보통 public 호출은 제한된다. |
| `domainEvent.list` | 특정 World/Model의 domain event 목록을 조회한다. |
| `domainEvent.get` | 특정 domain event를 조회한다. |
| `domainEvent.listByTarget` | 특정 Instance, assignment, evidence 등에 관련된 event를 조회한다. |
| `worldState.diff` | 두 시점 또는 두 snapshot 사이의 world state 차이를 계산한다. |
| `worldState.getRevision` | 특정 시점의 world state revision 정보를 조회한다. |
| `worldState.listEvents` | World/Model에 기록된 domain event 목록을 조회한다. |

Domain event 예:

- `kindAssignment.created`
- `kindAssignment.accepted`
- `propertyValue.updated`
- `relation.rejected`
- `evidence.linked`
- `decision.recorded`

실시간 변화 감지는 JSON-RPC operation이 아니라 SSE event stream으로 제공하는 것이 적합하다.

SSE event 예:

- `assignment.changed`
- `evidence.changed`
- `decision.recorded`
- `relation.accepted`
- `propertyValue.superseded`

## Future Operations

다음 operation은 이름과 방향은 잡을 수 있지만, 구현은 후속 단계로 미룬다.

| Operation | Description |
|---|---|
| `change.record` | Resource에서 측정된 created, modified, deleted, moved, observed 변화 이벤트를 기록한다. |
| `change.list` | 특정 World/Model 또는 Resource의 change event 목록을 조회한다. |
| `change.get` | 특정 change event를 조회한다. |
| `interpretation.createJob` | Change event, user request, scheduled validation 등을 AI/capability 해석 작업으로 연결한다. |
| `interpretation.submitResult` | AI/capability의 해석 결과를 candidate, evidence, validation report 등으로 제출한다. |
| `interpretation.cancelJob` | 진행 중인 interpretation job을 취소한다. |
| `candidate.accept` | 여러 종류의 candidate 판단을 공통 방식으로 승인한다. |
| `candidate.reject` | 여러 종류의 candidate 판단을 공통 방식으로 거절한다. |
| `view.create` | World/Model에 새 View를 만든다. |
| `view.project` | View의 query/projection 정책에 따라 표시할 데이터를 계산한다. |
| `view.saveLayout` | View의 layout 상태를 저장한다. |

## Phase 1 우선순위

Phase 1에서 우선 정의해야 하는 operation 묶음은 다음이다.

- World/Model tree navigation
- Directory/Model binding
- Kind CRUD
- Property CRUD
- RelationKind CRUD
- Instance CRUD
- Resource register/list
- Instance/Resource mapping
- Kind assignment
- Property value
- Relation
- Evidence
- Decision
- Visibility and endpoint validation
- Domain event/history 조회의 최소형

이 묶음이 있어야 Sidebar, Editor, View, MCP, Narre, interactive HTML이 같은 world operation 언어를 공유할 수 있다.
