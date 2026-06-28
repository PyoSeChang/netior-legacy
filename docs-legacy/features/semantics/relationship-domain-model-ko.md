# Relationship Domain Model

작성일: 2026-05-21

## 핵심 정의

Netior에서 관계는 두 층으로 나뉜다.

- `Relationship`: 프로젝트의 객체와 객체 사이에 실제로 존재하는 의미 관계
- `Edge`: 특정 네트워크 표면에서 그 관계를 보여주는 연결 occurrence

따라서 relation domain model의 핵심은 `Relationship`이 의미를 소유하고, `Edge`는 표현을 소유한다는 점이다.

## 책임 분리

### Relationship

`Relationship`은 네트워크에 종속되지 않는다.

책임:

- 어떤 object와 어떤 object 사이에 관계가 존재하는지 저장한다.
- 그 관계가 어떤 의미인지 `model_id`로 저장한다.
- 관계 설명과 관계 속성(`properties_json`)을 저장한다.
- built-in/package/project provenance를 `source_kind`, `source_id`, `source_ref`, `source_version`으로 저장한다.

`Relationship`은 위치, 라우팅, 선 모양, 포트, 카드 렌더링 같은 네트워크 표현 데이터를 알지 않는다.

### Edge

`Edge`는 네트워크에 종속된다.

책임:

- 특정 `network_id` 안에서 어떤 `source_node_id`와 `target_node_id`가 연결되어 보이는지 저장한다.
- 도메인 관계를 표현할 때 `relationship_id`로 `Relationship`을 참조한다.
- 네트워크 표현 방식인 `edge_type_id`, `source_port_key`, `target_port_key`, `route_json`, visual override를 저장한다.

`Edge`는 관계 의미의 주인이 아니다. 관계 의미는 `Relationship.model_id`에 있다.

## Model의 위치

`Model`은 의미 계층이다.

relation domain에서는 `Model`이 관계의 의미를 정의한다. 예를 들어 원인, 조건, 의존, 포함 같은 의미는 `Relationship.model_id`가 가리키는 model로 표현된다.

장기적으로 model target kind는 더 엄격히 나뉘어야 한다.

- schema meaning
- field meaning
- relationship meaning

현재 코드에 남아 있는 `edge` target 표현은 과도기적 이름이다. 새 문서, 새 UI, MCP/Narre 프롬프트에서는 의미상 `relationship model`로 읽어야 한다.

## Network와의 관계

하나의 `Relationship`은 여러 네트워크에서 다르게 표현될 수 있다.

예:

- Default network에서는 두 노드 사이의 기본 선으로 보인다.
- Algorithm network에서는 원인 포트에서 결과 포트로 나가는 directed edge로 보인다.
- Calendar/grid surface에서는 직접 선으로 보이지 않고 dependency marker나 별도 리스트로 보일 수 있다.

이때 관계 의미는 동일하다. 달라지는 것은 network representation이다.

```text
Object A ── Relationship(model: cause) ──> Object B
             |
             +-- Edge occurrence in Network X
             +-- Edge occurrence in Network Y
```

## 구조 Edge

모든 edge가 domain relationship을 뜻하지는 않는다.

네트워크 내부 동작을 위한 edge가 있다.

- contains edge
- hierarchy parent edge
- entry portal edge

이런 edge는 네트워크 구조와 layout 동작을 위한 표현 장치다. 사용자가 말하는 객체 간 실제 의미 관계로 승격하지 않는다.

즉 시스템 구조 edge와 사용자 domain relationship은 구분해야 한다.

## 생성 흐름

사용자가 네트워크에서 노드 A와 노드 B를 연결하면 기본 흐름은 다음과 같다.

```text
source node 선택
target node 선택
source/target node의 object 확인
Relationship 생성
Edge 생성 with relationship_id
```

의미를 아직 고르지 않아도 relationship은 생성될 수 있다. 이 경우 `model_id = null`인 관계이며, 이후 relationship editor에서 의미를 채운다.

단, source나 target이 object를 갖지 않는 내부 노드라면 domain relationship을 만들 수 없다. 그런 경우는 네트워크 구조 edge로만 다뤄야 한다.

## 편집 흐름

편집 책임도 분리한다.

- Relationship editor: 관계 의미, 설명, 관계 속성 편집
- Edge editor: edge type, 포트, 라우팅, visual override 편집

과도기적으로 EdgeEditor가 relationship 의미를 보여주거나 저장할 수 있지만, 최종 형태에서는 EdgeEditor가 관계 의미를 직접 수정하지 않는 것이 맞다.

## MCP와 Narre 규칙

MCP/Narre가 관계를 다룰 때는 다음 규칙을 따른다.

- 객체 사이의 실제 의미 관계를 만들 때는 `create_relationship`을 사용한다.
- 특정 네트워크에 관계를 보여줘야 할 때만 `create_edge`에 `relationship_id`를 넣어 occurrence를 만든다.
- `create_edge`만으로 새로운 의미 관계가 생겼다고 말하지 않는다.
- edge type, port, route, visual override는 network representation primitive로 설명한다.
- relationship model은 의미이고, edge type은 표현이다.

## 금지할 혼합

다음 혼합은 피한다.

- schema가 노드/edge의 시각적 모양을 결정한다.
- edge의 visual type이 관계 의미를 결정한다.
- relationship의 model을 network layout이나 edge renderer 설정으로 해석한다.
- 네트워크 구조 edge를 사용자 domain relationship처럼 MCP/Narre에 노출한다.
- fallback이라는 이유로 edge의 `model_id`를 관계 의미의 장기 저장 위치로 유지한다.

## 요약

`Relationship`은 "무슨 관계가 존재하는가"를 저장한다.

`Model`은 "그 관계가 무슨 의미인가"를 저장한다.

`Edge`는 "그 관계가 이 네트워크에서 어떻게 보이는가"를 저장한다.

이 세 책임이 섞이지 않아야 네트워크 표현 자유도를 사용자에게 넘기면서도, 의미 모델은 안정적으로 유지할 수 있다.
