# Network Representation Primitives

작성일: 2026-05-19

## 목적

Netior의 네트워크는 단순히 노드와 엣지를 그리는 화면이 아니라, 사용자가 자기 작업 세계를 표현하는 작업 표면이다. 이 문서는 네트워크 표현 책임을 schema에서 분리하고, 사용자가 네트워크 표현 문법을 구성할 수 있게 하기 위한 개념 경계를 정의한다.

핵심 원칙은 다음과 같다.

- Schema는 무엇이 존재하는지와 어떤 데이터를 가지는지만 책임진다.
- Model과 meaning binding은 데이터가 어떤 의미를 가지는지 책임진다.
- Network type은 그 존재들이 특정 작업 표면에서 어떻게 표현되고 연결되는지 책임진다.
- Network representation primitive는 사용자가 network type을 구성할 때 조합할 수 있는 시스템 고정 표현 도구다.

## 세 책임 층

네트워크 표현 시스템은 세 층을 엄격히 구분한다.

### System Fixed

Netior가 제공하는 저수준 표현 primitive와 실행 runtime이다. 사용자는 이 primitive 자체를 새로 만들지 않고, 제공된 primitive를 조합한다.

예:

- node card renderer
- data projection operator
- port와 connection point
- edge route strategy
- edge marker와 line style
- grid cell, span, stacking
- canvas pan/zoom, drag, resize interaction
- DSL evaluation과 semantic projection

### Built-In

Netior가 system fixed primitive를 조합해 미리 제공하는 network type이다.

예:

- Default network type
- Calendar network type
- Calendar 안의 event item node type
- Default 안의 basic node type

Built-in은 특별한 예외 코드가 아니라, Netior가 제공하는 공식 grammar seed다.

### User-Defined

사용자가 자기 작업 표면을 만들기 위해 구성하는 network type, node type, edge type이다.

예:

- Algorithm network type
- Cause node type
- Condition node type
- Requires edge type

사용자 정의는 임의 렌더링 엔진을 만드는 것이 아니다. 사용자는 system fixed primitive를 선택하고 조합한다.

## Network Type

Network type은 작업 표면의 표현 문법이다.

Network type은 다음을 정의한다.

- 어떤 surface runtime 위에서 동작하는가
- 어떤 node type을 사용할 수 있는가
- 어떤 edge type을 사용할 수 있는가
- 어떤 layout/placement 규칙을 따르는가
- 어떤 interaction을 허용하는가
- 어떤 model/meaning capability를 요구하거나 활용하는가

예:

```text
Default  -> surface runtime: canvas
Calendar -> surface runtime: grid
Algorithm(user-defined) -> surface runtime: canvas
```

## Surface Runtime

Surface runtime은 network type이 올라타는 시스템 고정 실행 환경이다.

처음에는 다음 두 runtime을 기준으로 삼는다.

### Canvas Runtime

자유 좌표 기반 네트워크 표면이다.

- x/y 좌표와 width/height 기반 배치
- node, edge, port, route 중심
- pan/zoom
- 사용자 정의 network type의 기본 기반
- freeform, group, list/grid-in-node 같은 canvas-oriented primitive 사용

### Grid Runtime

행, 열, 셀, span, stacking 기반 표면이다.

- cell 또는 slot 기반 배치
- item span
- cell 내부 stacking
- header/body grid shell
- drag가 cell/date/slot 변경으로 해석될 수 있음

Calendar는 surface runtime이 아니다. Calendar는 grid runtime 위에 구성된 built-in network type이다.

## Network Representation Primitive

Network representation primitive는 사용자가 network type을 만들 때 조합할 수 있는 시스템 고정 표현 도구다.

### Node Presentation Primitive

노드가 어떻게 보이는지 정의한다.

예:

- card renderer
- compact card
- icon/title card
- surface style
- size policy
- collapse affordance

### Data Projection Primitive

데이터를 노드 카드나 엣지 라벨에 가져오는 방식이다.

예:

- instance title 표시
- schema field value 표시
- meaning-bound field value 표시
- model slot value 표시
- DSL expression 결과 표시
- related object count 표시
- badge, subtitle, body row, footer slot에 값 배치

스키마 필드를 노드 카드에 가져오는 것도 data projection primitive다. 다만 기본 방향은 field id 직접 참조보다 model/meaning/DSL 기반 projection을 우선한다.

### Node Interface Primitive

노드가 네트워크 안에서 외부와 어떻게 연결될 수 있는지 정의한다.

예:

- ports 있음/없음
- input/output/bidirectional port
- port side와 placement
- 특정 edge type만 허용
- source-only, target-only 규칙

`interface`는 연결점 하나보다 넓은 개념이다. ports와 connection rule을 함께 포함한다.

### Edge Presentation Primitive

엣지가 어떻게 보이는지 정의한다.

예:

- color
- line style
- directed marker
- marker start/end
- label placement
- hover/selection style

### Edge Routing Primitive

엣지 경로를 어떻게 계산하는지 정의한다.

예:

- shortest
- straight
- orthogonal
- bezier
- manual waypoint

### Layout Placement Primitive

노드가 표면 위에서 어떤 배치 의미를 갖는지 정의한다.

예:

- canvas free position
- grid cell placement
- grid span placement
- lane placement
- time range placement

### Interaction Primitive

노드와 엣지가 어떤 상호작용을 허용하는지 정의한다.

예:

- drag
- resize
- collapse/expand
- connect from port
- edit card projection
- drag writeback

## Node Type

Node type은 특정 network type 안에서 어떤 대상이 어떤 종류의 표현 단위로 등장하는지를 정의한다.

Node type은 schema type이 아니다.

예:

- `default.basic_node`
- `calendar.event_item`
- `calendar.all_day_item`
- `algorithm.cause`
- `algorithm.condition`

Node type은 다음 구성 요소를 가진다.

```text
presentation
projection
interface
placement
interaction
```

### Presentation

노드가 어떤 renderer와 시각 스타일로 표시되는지 정의한다.

### Projection

노드 카드가 어떤 데이터를 읽어 어느 slot에 표시하는지 정의한다.

Projection은 model/meaning/DSL 기반이어야 한다.

예:

```json
{
  "title": { "source": "instance.title" },
  "subtitle": {
    "source": "dsl",
    "expression": {
      "op": "field.value",
      "of": { "op": "context.object" },
      "meaning": "location.place"
    }
  }
}
```

### Interface

노드의 연결 가능성을 정의한다.

예:

```json
{
  "ports": [
    { "key": "input", "side": "left", "role": "input" },
    { "key": "output", "side": "right", "role": "output" }
  ],
  "connectionRules": [
    { "accepts": ["requires"], "on": "input" },
    { "emits": ["produces"], "on": "output" }
  ]
}
```

### Placement

노드가 runtime 안에서 어떻게 배치되는지 정의한다.

Canvas runtime에서는 x/y placement가 중심이고, grid runtime에서는 cell/span placement가 중심이다.

### Interaction

드래그, 리사이즈, collapse, writeback 같은 노드 행동을 정의한다.

## Edge Type

Edge type은 특정 network type 안에서 연결이 어떤 의미와 표현을 가지는지 정의한다.

Edge type은 다음을 가진다.

- presentation
- routing
- interface
- interaction

Edge type은 model과 별개다. Model은 의미 층이고, edge type은 표현 층이다. 둘은 연결될 수 있지만 같은 개념이 아니다.

## Model과 DSL 읽기

Node type과 edge type은 schema 이름이나 번역된 label에 의존하면 안 된다.

데이터 읽기는 기존 패턴을 따른다.

- network type plugin의 semantic discovery
- instance semantic projection
- Netior DSL expression
- field behavior DSL
- interactive view DSL permission/validation 패턴

Network representation primitive의 data projection은 이 패턴 위에 올라간다.

예:

```json
{
  "source": "dsl",
  "expression": {
    "op": "field.value",
    "of": { "op": "context.object" },
    "meaning": "time.start"
  }
}
```

## Calendar의 위치

Calendar는 built-in network type이다.

Calendar는 grid runtime을 사용한다. Calendar 자체를 runtime으로 만들지 않는다.

Calendar에서 시스템 또는 built-in으로 고정되는 것:

- date grid 계산
- day/week/month shell
- event stacking
- all-day row
- time range placement
- recurrence expansion
- drag가 date/time field writeback으로 해석되는 규칙

Calendar에서 공통 primitive로 재사용하는 것:

- data projection
- item card presentation
- color/badge rule
- meaning-bound temporal fields
- 제한된 edge/dependency 표현

이렇게 해야 Calendar를 캔버스형 primitive 조합으로 억지 환원하면서 primitive 복잡도가 폭발하는 일을 피할 수 있다.

## 비목표

- 사용자가 임의 renderer runtime을 작성하게 하지 않는다.
- 모든 built-in network type을 완전히 동일한 primitive 조합으로 재현 가능하게 만들지 않는다.
- Calendar를 canvas network의 특수 case로 만들지 않는다.
- Schema에 node shape, card layout, connection point, edge routing 책임을 다시 넣지 않는다.

## 요약

Netior는 네트워크 표현을 하드코딩하는 앱이 아니라, 시스템이 제공하는 network representation primitive를 사용자가 조합해 자기 작업 표면의 network grammar를 만들 수 있게 하는 도구다.
