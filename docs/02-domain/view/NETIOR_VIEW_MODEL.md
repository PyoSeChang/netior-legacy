# Netior View Model

이 문서는 Netior의 View가 무엇을 보여주고, 어떻게 조작되고, 무엇을 저장해야 하는지 정리한다.

View는 World/Model의 원본이 아니다. View는 World 안의 정의, instance, resource, relation, 변화 신호를 사용자가 이해하고 조작할 수 있게 만드는 projection이다.

MVP에서 View는 두 종류만 만든다.

```ts
type ViewType = 'explorer' | 'canvas'
```

## 기본 원칙

- View는 하나의 Model에 속한다.
- MVP에서 `Model : View = 1:N`이다.
- View는 subject를 소유하지 않고 참조한다.
- View에 배치하거나 표시한다고 해서 subject의 home Model, directory binding, ontology visibility가 바뀌지 않는다.
- 같은 World 안의 다른 Model에 있는 Kind, RelationKind, Instance, Resource도 View에서 참조할 수 있다.
- View에서 보는 것과 domain operation으로 세계를 바꾸는 것은 분리한다.
- ViewType은 향후 사용자나 package에 의해 확장될 수 있으므로, 저장 모델은 특정 ViewType마다 별도 테이블로 분리하지 않는다.

```text
Canvas에 배치한다
!= 해당 Model로 이동한다
!= 해당 Model의 ontology visibility에 포함한다
!= 해당 Resource directory binding을 바꾼다
```

## Explorer

Explorer는 "무엇이 있고 어디에 있는가"를 보여주는 View다.

Explorer가 보여주는 것:

- World / Model tree
- Model에 연결된 directory binding
- Resource file/folder
- Resource와 연결된 Instance
- Instance에 할당된 Kind
- Kind, Property, RelationKind 같은 정의 요소
- 아직 할당되지 않은 Resource
- 감지된 변경, 검토가 필요한 항목

Explorer는 자유 배치 View가 아니다. Tree, list, filter, detail editor 진입이 중심이다.

Explorer의 핵심 질문:

```text
이 World/Model 안에 무엇이 존재하는가?
어떤 Resource가 어떤 Instance로 해석되었는가?
아직 해석되지 않은 것은 무엇인가?
무엇이 변경되었고 검토가 필요한가?
```

## Canvas

Canvas는 "그것들이 어떻게 연결되고 배치되는가"를 보여주는 View다.

Canvas는 세계 자체가 아니라 특정 질문에 대한 projection이다. 모든 객체를 자동으로 펼치는 공간이 아니라, 사용자가 의미 있다고 판단한 subject를 배치하고 Netior가 관계와 조작을 보조하는 공간이다.

Canvas가 보여줄 수 있는 것:

- Kind와 RelationKind의 구조
- Instance와 RelationAssertion의 구조
- Resource와 Instance의 mapping
- Model 간 참조 구조
- 다른 Model에서 가져온 subject

MVP Canvas에서는 같은 View 안에 같은 subject를 중복 배치하지 않는다.

```text
하나의 Canvas View 안에서 같은 subject는 하나의 CanvasNode만 가진다.
```

나중에 같은 subject를 여러 방식으로 보여줄 필요가 확인되면 alias node 또는 portal node를 별도 개념으로 추가한다.

## Subject, Node Type, Renderer

Canvas에서 가장 중요한 분리는 다음과 같다.

```text
subject
= 이 노드가 무엇을 가리키는가
= instance:yuna, resource:yuna.md, kind:Character

CanvasNodeType
= 그 subject를 캔버스에서 어떤 표현 단위로 다루는가
= instance_card, resource_tile, model_group

rendererKey
= 그 표현 단위를 어떤 UI 컴포넌트로 그리는가
= netior.card, netior.compact, netior.image
```

`Kind`와 `CanvasNodeType`은 다르다.

```text
Kind: Character
CanvasNodeType: portrait_card, compact_name_tag, relation_circle
```

`RelationKind`와 `CanvasEdgeType`도 다르다.

```text
RelationKind: appearsIn
CanvasEdgeType: relation_edge, relation_kind_edge
```

`rendererKey`는 action을 결정하지 않는다. Renderer는 가능한 action을 버튼, toolbar, menu, overlay 등으로 배치할 뿐이다. 어떤 action이 가능한지는 CanvasNodeType, subject, mode, 권한, 현재 상태가 결정한다.

## Canvas Node Type

CanvasNodeType은 노드의 표현 스키마다.

MVP에서는 DB 구조만 확장 가능하게 열어두고, UI에서는 built-in node type만 제공한다.

초기 built-in node type:

- `instance_card`
- `resource_tile`
- `kind_card`
- `relation_kind_card`
- `model_group`
- `note`

개념 스키마:

```ts
interface CanvasNodeType {
  id: string
  modelId: string | null
  key: string
  name: string
  description?: string

  allowedSubjects: CanvasSubjectType[]
  rendererKey: string

  fields: CanvasNodeFieldSlot[]
  actions: CanvasNodeAction[]
  interactions: CanvasInteractionBinding[]

  defaultSize: {
    width: number
    height: number
  }

  defaultStyle?: Record<string, unknown>

  sourceKind: 'system' | 'user' | 'package'
  sourceRef?: string
}
```

## Canvas Node

CanvasNode는 subject 자체가 아니다. 특정 Canvas View 위에 어떤 subject를 어떤 node type으로 배치했는지에 대한 기록이다.

개념 스키마:

```ts
interface CanvasNode {
  id: string
  viewId: string

  subjectType: CanvasSubjectType
  subjectId: string
  subjectModelId: string

  nodeTypeId: string

  x: number
  y: number
  width: number
  height: number
  zIndex: number

  parentNodeId?: string | null

  locked: boolean
  hidden: boolean
  collapsed: boolean

  titleOverride?: string
  iconOverride?: {
    iconType: 'lucide' | 'image' | 'none'
    iconKey?: string
    iconResourceId?: string
  }

  styleOverride?: Record<string, unknown>
}
```

`hidden`은 현재 Canvas View에서만 숨기는 상태다. subject 자체를 archive하는 것이 아니다.

## Canvas Edge

MVP에서 visual-only edge는 만들지 않는다.

Canvas edge는 실제 세계 관계나 명시적인 view 구조를 표현해야 한다. 단순한 장식 선, 임시 연결, 주석용 선은 초기에는 넣지 않는다.

초기 edge subject:

```ts
type CanvasEdgeSubjectType =
  | 'relation_assertion'
  | 'relation_kind'
  | 'kind_assignment'
  | 'resource_mapping'
  | 'model_parent'
```

Group membership이나 layout containment는 edge가 아니라 `parentNodeId` 같은 node hierarchy/layout으로 저장한다.

## Action과 Interaction

Canvas action은 "이 노드에서 사용자가 할 수 있는 명령"이다.

Action은 ontology relation이 아니다.

```text
Yuna --appearsIn--> Scene 1
= Relation

Open, Assign Kind, Create Relation, Run Validator
= Action
```

Action과 interaction binding은 분리한다.

```ts
type CanvasMode = 'browse' | 'edit'

type CanvasNodeEvent =
  | 'click'
  | 'double_click'
  | 'hover'
  | 'context_menu'
  | 'drag_start'
  | 'drag'
  | 'drop'
  | 'resize'
```

```ts
interface CanvasNodeAction {
  key: string
  label: string
  icon?: string

  handler:
    | 'view_command'
    | 'open_editor'
    | 'domain_operation'
    | 'run_capability'

  operationKey?: string
  params?: CanvasActionParamBinding[]
  confirmation?: {
    required: boolean
    title?: string
    message?: string
  }
}
```

```ts
interface CanvasInteractionBinding {
  event: CanvasNodeEvent
  mode: CanvasMode
  actionKey: string

  behavior:
    | 'execute'
    | 'select'
    | 'open_menu'
    | 'show_preview'
    | 'show_toolbar'

  preventDefault?: boolean
}
```

## Browse Mode와 Edit Mode

Canvas에는 두 모드가 있다.

```text
browse mode
= 세계를 읽고 조작하는 모드

edit mode
= 캔버스 배치를 조정하는 모드
```

Browse mode에서 가능한 것:

- click: node 선택
- double click: primary editor 열기
- hover: preview, quick toolbar, warning tooltip
- context menu: 가능한 action 표시
- open editor
- domain operation 호출
- capability 호출
- Hide from Canvas

Edit mode에서 가능한 것:

- click: 선택
- area select
- drag/drop: 배치 이동
- resize
- group/ungroup
- lock/unlock
- copy/paste layout
- remove from canvas

Edit mode에서는 domain operation과 capability action을 실행하지 않는다. 배치를 정리하다가 실수로 세계를 바꾸는 일을 막기 위해서다.

## Editor와 Details

Canvas에는 별도의 고정 Inspector panel을 전제로 두지 않는다.

Netior의 상세 보기와 편집은 editor system에 속한다. Canvas에서 subject를 더 자세히 보고 싶으면 해당 subject에 맞는 editor tab을 연다.

예:

```ts
{
  key: 'instance.openDetails',
  label: 'Details',
  handler: 'open_editor',
  editorType: 'instance',
  target: { from: 'subject.id' },
  objectViewMode: 'details'
}
```

```ts
{
  key: 'instance.openInteractive',
  label: 'Interactive',
  handler: 'open_editor',
  editorType: 'instance',
  target: { from: 'subject.id' },
  objectViewMode: 'interactive'
}
```

따라서 Canvas의 `Show Inspector` 같은 action 이름은 쓰지 않는다. 대신 `Open`, `Open Details`, `Open Interactive`, `Open in Editor`를 사용한다.

## Hide, Remove, Archive

Canvas context menu에서는 다음 개념을 구분한다.

```text
Hide from Canvas
= 현재 Canvas View에서만 숨김
= 다시 표시 가능
= CanvasNode.hidden 변경

Remove from Canvas
= 현재 Canvas View에서 배치 제거
= subject는 그대로 존재
= 다시 가져오면 새 CanvasNode가 생김

Archive Subject
= 세계 객체 자체를 archive
= domain operation
= MVP에서는 Canvas 기본 action으로 두지 않는다
```

사용자가 말한 "캔버스에서 아카이빙"은 MVP에서는 `Hide from Canvas`로 정의한다.

## Copy와 Paste

MVP의 copy/paste는 subject 복제가 아니라 layout 복사다.

```text
copy layout
= 같은 subject를 참조하는 CanvasNode 배치 복사
= subject는 새로 생성하지 않음

duplicate subject
= Instance/Resource/Kind 같은 세계 객체 복제
= MVP에서는 제외
```

붙여넣기는 같은 subject를 참조하는 node를 새로 만드는 것이지만, MVP에서는 같은 View 안의 subject 중복 배치를 금지한다. 따라서 붙여넣기 시 이미 같은 subject가 있으면 새로 만들지 않고 기존 node를 focus하거나 사용자에게 알려준다.

## View Remote

View마다 별도의 toolbar 문법을 만들지 않고, 공통 View Remote를 둔다.

View Remote는 View Shell에 붙는 공통 조작 표면이다.

공통 control:

- View 이름
- ViewType 전환
- View 생성
- View 설정
- refresh
- search
- filter
- selected count
- command menu

Explorer type control:

- tree/list toggle
- unassigned filter
- changed filter
- group by
- sort
- detect changes

Canvas type control:

- browse/edit mode 전환
- zoom in/out
- zoom to fit
- reset view
- grid toggle
- auto layout
- group/ungroup
- lock/unlock

View Remote는 세계를 직접 바꾸는 UI가 아니다. View command, domain operation, capability 호출을 사용자에게 노출하는 command surface다.

## Persisted State

MVP에서 영속화할 것:

- View name
- View type
- owner Model
- Canvas nodes
- Canvas edges
- node position
- node size
- node type
- edge type
- hidden/locked/collapsed/group 상태
- View type별 config JSON

MVP에서 영속화하지 않을 것:

- search term
- temporary filter
- selected node
- hover state
- context menu state
- zoom
- pan
- current mode

줌, 팬, 모드는 편의상 나중에 저장할 수 있지만 MVP에서는 제외한다.

## 예시 저장 모델

테이블명과 필드는 확정이 아니라 구현 논의를 위한 예시다.

### `views`

View의 공통 identity를 저장한다.

핵심 필드:

- `id`
- `owner_model_id`
- `type`
- `name`
- `description`
- `config_json`
- `source_kind`
- `source_ref`
- `created_at`
- `updated_at`

제약:

- `owner_model_id`는 World/Model node를 가리킨다.
- `type`은 built-in 또는 등록된 ViewType key다.
- ViewType별 설정은 `config_json`에 저장한다.
- type별 별도 View 테이블을 만들지 않는다.

### `canvas_node_types`

Canvas node type 정의를 저장한다.

핵심 필드:

- `id`
- `owner_model_id`
- `key`
- `name`
- `description`
- `allowed_subjects_json`
- `renderer_key`
- `fields_json`
- `actions_json`
- `interactions_json`
- `default_size_json`
- `default_style_json`
- `source_kind`
- `source_ref`
- `created_at`
- `updated_at`

제약:

- MVP UI에서는 built-in node type만 편집 가능하게 노출한다.
- DB 구조는 user/package node type을 수용할 수 있게 둔다.
- 같은 visible scope에서 `key` 충돌은 금지한다.

### `canvas_edge_types`

Canvas edge type 정의를 저장한다.

핵심 필드:

- `id`
- `owner_model_id`
- `key`
- `name`
- `description`
- `allowed_subjects_json`
- `renderer_key`
- `label_fields_json`
- `actions_json`
- `interactions_json`
- `default_style_json`
- `source_kind`
- `source_ref`
- `created_at`
- `updated_at`

제약:

- MVP UI에서는 built-in edge type만 편집 가능하게 노출한다.
- visual-only edge type은 MVP에서 제공하지 않는다.

### `view_items`

View에 배치되거나 표시되는 item을 저장한다.

Canvas node와 edge를 모두 담을 수 있는 generic item 모델을 우선 검토한다.

핵심 필드:

- `id`
- `view_id`
- `item_kind`
- `subject_type`
- `subject_id`
- `subject_model_id`
- `type_id`
- `parent_item_id`
- `layout_json`
- `state_json`
- `overrides_json`
- `created_at`
- `updated_at`

제약:

- `item_kind`는 `node`, `edge` 등으로 시작한다.
- 같은 View 안에서 같은 `subject_type + subject_id` node는 하나만 허용한다.
- subject는 같은 World 안의 다른 Model에 속할 수 있다.
- subject 참조는 소유권 이전이 아니다.
- edge item은 MVP에서 `relation_assertion`, `relation_kind`, `kind_assignment`, `resource_mapping`, `model_parent`만 참조한다.

## MVP 결정

- ViewType은 `explorer`, `canvas`만 만든다.
- View 저장 모델은 generic하게 유지한다.
- type별 별도 저장 모델은 만들지 않는다.
- CanvasNodeType/CanvasEdgeType은 DB 구조만 확장 가능하게 열고 UI는 built-in만 제공한다.
- 같은 Canvas 안에서 같은 subject 중복 배치는 금지한다.
- visual-only edge는 MVP에서 금지한다.
- 다른 Model의 subject는 같은 World 안이면 참조 배치할 수 있다.
- domain operation 가능 여부는 배치 가능 여부와 분리하고 service에서 검증한다.
- `archive`라는 이름은 Canvas-local 숨김에 쓰지 않는다. MVP에서는 `Hide from Canvas`라고 부른다.
