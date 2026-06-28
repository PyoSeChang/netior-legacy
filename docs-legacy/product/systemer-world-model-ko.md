# Systemer와 Agent World Model

## 목적

이 문서는 Netior를 단순한 지식 관리 앱이나 에이전트 채팅 UI가 아니라, 사용자가 world의 규칙을 설정하고 agent가 그 world 안에서 지속적으로 world model을 갱신하는 환경으로 보기 위한 개념 메모다.

아직 도메인 모델 수정 전략은 확정하지 않는다.
현재 목적은 제품 방향의 핵심 전제를 문서화하는 것이다.

## 원본 전제

`자연관.md`의 출발점은 다음 문장이다.

> 우주는 모든 상태를 허용하지 않는다.

그리고 이 전제는 유지 비용의 관점으로 이어진다.

> 모든 상태에는 유지 비용이 존재하며, 그 비용은 상태의 복잡도에 따라 증가한다.

따라서 무한은 유지 가능한 상태가 아니라 도달 불가능한 극한으로 취급된다.

> 무한은 "도달 불가능한 극한(limit)"이다.

이때 세계는 단순히 정적인 안정 상태로 머물지 않는다.
상태는 누적되고, 임계점에 도달하고, 붕괴 또는 리셋을 거쳐 다시 구성된다.

```text
생성 -> 축적 -> 임계 -> 붕괴 -> 재생
```

하지만 이것은 완전 반복이 아니다.

```text
Cycle + Drift
```

## 제약을 설정하는 자

이 전제를 확장하면, 우주는 모든 객체의 모든 운동을 직접 결정하는 자가 아니다.

모든 객체의 운동을 결정적으로 정의하려면 비용이 너무 크다.
대신 우주는 제약을 설정한다.
객체들은 그 제약 안에서 자기 운동을 책임진다.

관성이나 작용/반작용은 이 관점에서 이해할 수 있다.
우주는 매 순간 각 객체가 어떻게 움직여야 하는지를 개별 명령으로 지정하지 않는다.
대신 객체들이 따라야 하는 메타 규칙과 제약 조건을 둔다.

## 법의 비유

인간 사회의 법도 같은 방식으로 작동한다.

법은 일반적으로 특정 객체 쌍의 모든 행위를 개별적으로 열거하지 않는다.
예를 들어 "A 씨는 B 씨를 죽이면 안 된다"와 같은 규칙을 모든 사람 조합마다 만들지 않는다.

대신 법은 더 메타적인 객체와 관계를 정의한다.

- 사람
- 미성년자
- 장애인
- 법인
- 소유권
- 계약
- 권리
- 의무
- 책임

이 방식은 유지 비용 최적화 관점에서 우수하다.
개별 행위를 모두 사전에 정의하지 않아도, 새로운 사건과 객체를 기존 메타 객체와 관계 체계 안에서 해석할 수 있기 때문이다.

## Netior에서의 대응

Netior에서 사용자는 단순 작성자가 아니라 systemer다.

사용자는 project라는 world 안에서 작동할 규칙과 메타 객체를 설정한다.
이때 project는 파일 묶음이 아니라 agent가 활동하는 하위 차원의 world에 가깝다.

```text
User / Systemer
  -> world의 규칙을 설정한다
  -> 메타 객체를 설정한다
  -> 가능한 관계와 제약을 설정한다

Project / World
  -> 객체, 파일, 네트워크, 타입, 컨텍스트를 포함한다
  -> agent가 활동하는 장이다

Agent
  -> world 안에서 행동한다
  -> systemer가 설정한 규칙과 메타 객체를 바탕으로 판단한다
  -> world model을 지속적으로 갱신한다
```

## Agent의 신경과학적 방향

Agent가 신경과학적으로 동작한다는 것은 뇌를 표면적으로 모방한다는 뜻이 아니다.

핵심은 project와 network를 고정된 스냅샷으로 보지 않는 것이다.
project와 network는 agent에게 한 번 제공되는 context package가 아니라, agent가 지속적으로 수정하고 관리하는 world model에 가깝다.

이는 `networkics-ko.md`의 전제와 연결된다.

- 노드는 독립적으로 정의되지 않고 관계 속에서 정의된다.
- 이해는 안정 상태에 가까운 관계 패턴이다.
- 예측 실패는 구조 이동 요구량, 즉 Networkics Delta를 만든다.
- 완전 안정은 불가능하다.
- 지능은 Networkics를 동적으로 구축하는 과정이다.

따라서 agent는 world model을 단순 조회하지 않는다.
agent는 행동하고, 예측하고, 실패하고, 그 실패를 통해 world model을 재구성한다.

```text
World Model
  -> agent action
  -> observation / result
  -> prediction failure or mismatch
  -> Networkics Delta
  -> world model update
```

## Episode와 Action의 승격

이 관점에서는 episode와 action이 단순 로그로 남아서는 부족하다.

Episode, 즉 session은 agent가 특정 context 안에서 수행한 경험 단위다.
Action은 agent가 world 안에서 실제로 수행한 행위다.

이 둘은 world model update의 기준이 되기 때문에 네트워크 객체로 승격될 필요가 있다.

```text
World Model
  <- updated by
Episode
  <- consists of
Action
  <- produces
Observation / Result / Failure / Delta
```

예를 들어 action은 다음과 같은 행위를 포함할 수 있다.

- 파일 읽기
- 파일 수정
- 노드 생성
- 관계 제안
- context 활성화
- tool call
- 추론 결과 제출
- 사용자 확인 요청
- prediction failure 감지
- schema 또는 relation type 수정 제안

## 왜 네트워크 객체여야 하는가

Episode와 action이 네트워크 객체가 되어야 하는 이유는 world model update의 근거를 남기기 위해서다.

네트워크가 바뀌었을 때 다음 질문에 답할 수 있어야 한다.

- 왜 이 관계가 생겼는가?
- 어떤 episode가 이 변화를 만들었는가?
- 어떤 action이 성공하거나 실패했는가?
- 어떤 예측 실패가 Networkics Delta를 만들었는가?
- 사용자는 어떤 업데이트를 승인하거나 거절했는가?

단순 transcript나 로그는 이 질문에 충분히 답하지 못한다.
world model이 갱신되려면, 경험과 행위가 구조화된 객체로 남아야 한다.

## 현재 결론

현재 단계의 결론은 도메인 모델 수정이 아니다.

더 정확한 전략이 필요하다.
다만 방향성은 다음처럼 정리할 수 있다.

> Netior는 systemer가 world의 메타 객체와 제약을 설정하고, agent가 그 world 안에서 episode와 action을 통해 world model을 지속적으로 갱신하는 환경이다.

