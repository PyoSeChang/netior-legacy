# Network Concern과 Layout DSL 적용 전략

작성일: 2026-05-15  
상태: Implementation Draft

## 1. 핵심 정의

Netior의 작업 세계는 프로젝트 안의 전체 오브젝트와 관계다. 네트워크는 그 전체 세계를 그대로 복제한 캔버스가 아니라, 특정 목표와 관심사에 따라 잘라낸 부분 집합이다.

따라서 네트워크 레이아웃 플러그인은 단순 좌표 계산기가 아니다. 레이아웃 플러그인은 네트워크의 관심사에 해당하는 오브젝트와 관계를 선별하고, 그 의미를 해석한 뒤, 시각화 전략으로 바꾸는 소비처다.

Netior에서 모델은 의미이고, 모델도 네트워크 객체다. 그러므로 의미를 해석하는 경로는 소비처별 임시 규칙이 아니라 Netior DSL을 통해야 한다.

## 2. 책임 경계

DSL의 책임:

- 네트워크의 관심사에 해당하는 오브젝트 집합을 찾는다.
- 모델/의미를 통해 필드와 값을 해석한다.
- 모델/의미를 통해 edge 관계를 해석한다.
- 비교, 정렬, 집계, 상대 탐색 같은 값 연산을 표현한다.
- 후보가 없거나 여러 개인 경우 ambiguity를 숨기지 않고 반환한다.

레이아웃 플러그인의 책임:

- DSL 평가 결과를 시각화 가능한 그래프로 소비한다.
- calendar, gantt, hierarchy, freeform 같은 family별 배치 알고리즘을 실행한다.
- viewport, drag, resize, overlay, background, controls 같은 화면 상호작용을 처리한다.

금지해야 할 방향:

- 각 layout plugin이 직접 `field.meaning_bindings`를 뒤져 의미를 해석하는 구조
- edge model 해석이 plugin별 상수 비교로만 흩어지는 구조
- scope에 걸린 오브젝트를 layout plugin이 임의로 network node로 저장하는 구조

## 3. 오브젝트 상태 용어

`virtual node`라는 이름은 사용하지 않는다. 아직 네트워크 노드로 배치되지 않은 오브젝트를 node라고 부르면 렌더링과 저장 상태가 섞인다.

대신 다음 용어를 사용한다.

- `ScopedObject`: DSL scope 평가 결과에 포함된 오브젝트
- `Placement`: 실제 `network_nodes`에 저장된 배치
- `PlacedObject`: scoped object 중 현재 네트워크에 placement가 있는 오브젝트
- `UnplacedScopedObject`: scoped object 중 현재 네트워크에 placement가 없는 오브젝트
- `CandidateObject`: unplaced scoped object 중 사용자에게 추가 후보로 보여주기로 한 오브젝트

기본 흐름:

```text
DSL scope
  -> scoped objects

network_nodes
  -> placements

scoped objects - placements
  -> unplaced scoped objects

visibility policy
  -> render placed nodes
  -> suggest candidate objects
  -> optionally create placements
```

## 4. 표시 정책

scope에 포함된 오브젝트를 모두 화면에 그리면 안 된다. 표시 정책은 plugin default와 network/layout override를 함께 고려해 runtime이 결정한다.

초기 정책 후보:

- `materialized-only`: 실제 placement가 있는 오브젝트만 표시한다.
- `suggest-missing`: scope에는 있지만 placement가 없는 오브젝트를 후보로만 제공한다.
- `show-scoped`: scope 결과를 placement 여부와 상관없이 표시한다.
- `auto-materialize`: scope 결과를 자동으로 `network_nodes`에 저장한다.

MVP 기본값은 `materialized-only`다. `auto-materialize`는 사용자의 네트워크를 원하지 않는 오브젝트로 오염시킬 수 있으므로 MVP에서 금지한다.

## 5. MVP 개발 순서

### Phase 1. 현재 입력 경계 분리

목표:

- 기존 calendar/gantt/timeline/freeform 동작을 유지한다.
- `NetworkWorkspace` 내부에 흩어진 layout input 생성을 별도 builder로 분리한다.
- 현재 네트워크에 배치된 오브젝트를 기본 scoped object로 해석하는 경로를 명시한다.

통과 기준:

- 기존 레이아웃 동작이 바뀌지 않는다.
- layout plugin이 받는 노드 목록이 `ResolvedLayoutGraph` builder를 통과한다.
- scoped/placed/candidate 용어가 코드 타입에 반영된다.

### Phase 2. Network Concern Scope DSL 도입

목표:

- `objects.inNetwork`를 기본 scope DSL로 사용한다.
- 향후 `instances`, `instances.byFieldModel`, relation-based scope로 확장할 수 있게 한다.

통과 기준:

- 현재 네트워크의 배치 오브젝트를 DSL로 평가할 수 있다.
- scope 결과와 placement 결과를 비교할 수 있다.
- unplaced scoped object를 diagnostics로 표현할 수 있다.

### Phase 3. Field Semantic Resolution DSL화

목표:

- fieldId 직접 selector와 model/meaning 기반 selector를 모두 DSL에서 지원한다.
- 기존 semantic projection은 성능용 read model로 유지하되, 의미 해석의 source of truth는 DSL evaluator/resolver로 이동한다.

통과 기준:

- `time.start`, `time.end`, `time.all_day`, `structure.order` 같은 의미가 DSL resolution을 통해 projection된다.
- 필드 누락과 모호성이 diagnostics에 남는다.

### Phase 4. Relation Resolution DSL화

목표:

- edge model을 통해 contains, parent-child, dependency 같은 관계를 해석한다.
- freeform/group/hierarchy layout이 공통 relation resolution 결과를 소비한다.

통과 기준:

- 기존 contains/group 동작이 유지된다.
- relation 해석이 plugin 내부 ad hoc 비교에만 의존하지 않는다.

### Phase 5. Candidate 표시와 채택 UX

목표:

- `suggest-missing` 정책을 UI로 연결한다.
- unplaced scoped object를 사용자가 명시적으로 placement로 채택할 수 있게 한다.

통과 기준:

- 후보가 자동 저장되지 않는다.
- 사용자는 네트워크의 관심사에 들어오지만 아직 배치되지 않은 오브젝트를 확인할 수 있다.

