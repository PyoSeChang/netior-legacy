# Ontology / Network DB와 DSL 장기 방향

작성일: 2026-05-12  
상태: Research Note  
인코딩: UTF-8

## 1. 문제의식

Netior가 단순한 데스크톱 앱의 메타데이터 저장소를 넘어 온톨로지 DB이자 네트워크 DB가 되려면, 전통적인 결정적 쿼리만으로는 충분하지 않다.

온톨로지 DB에 담기는 데이터는 항상 완전히 정형화되어 있지 않다. 같은 프로젝트 안에서도 객체의 구조, 의미, 관계, 이름, 파일 내용, 네트워크 배치, 사용자의 설명이 서로 다른 밀도로 존재한다. 어떤 질문은 명확한 필드와 엣지로 답할 수 있지만, 어떤 질문은 의미적으로 비슷한 후보를 찾거나, 불완전한 맥락에서 가장 그럴듯한 대상을 해석해야 한다.

따라서 Netior의 장기 쿼리 모델은 결정적 쿼리와 비결정적 쿼리를 모두 수용해야 한다.

## 2. 비결정적 쿼리의 필요성

비결정적 쿼리는 "아무 데이터나 전부 LLM에게 주고 찾아오게 한다"는 뜻이 아니다. 그것은 Netior가 프로그램적으로 좁힐 수 있는 영역을 먼저 좁히고, 의미 판단이 필요한 구간만 LLM 엔진에 위임할 수 있어야 한다는 뜻이다.

예를 들어 다음과 같은 질문은 순수한 SQLite 쿼리만으로 안정적으로 답하기 어렵다.

- "이 문서와 개념적으로 관련 있는 인스턴스를 찾아줘."
- "이 네트워크에서 다음에 봐야 할 노드는 뭐야?"
- "이 필드가 배점처럼 쓰이는 것 같은데 맞아?"
- "이 프로젝트에서 시험 문제로 볼 수 있는 객체들을 찾아줘."

반대로 다음과 같은 부분은 결정적 엔진이 처리해야 한다.

- 특정 schema의 instance 목록 조회
- 특정 model이 연결된 field 탐색
- 특정 edge model을 따라 network traversal
- 후보군의 field value 읽기
- filter, sort, aggregate
- source_ref, object_type, ref_id, project_id 기반 식별

핵심은 두 엔진의 책임을 섞지 않는 것이다. 프로그램이 결정적으로 줄일 수 있는 후보군은 프로그램이 줄이고, LLM은 그 후보군과 조립된 프롬프트를 바탕으로 의미 판단을 수행한다.

## 3. 엔진 책임 분리

Netior의 쿼리/해석 엔진은 장기적으로 적어도 세 층으로 나뉜다.

### 3.1 결정적 엔진

결정적 엔진은 현재 SQLite와 TypeScript evaluator가 맡을 수 있는 영역이다.

- DB row 조회
- object/schema/field/edge/network traversal
- model/source_ref 기반 resolution
- 정렬, 필터, 집계
- cache 가능한 projection 생성
- 재현 가능한 결과가 필요한 쿼리

이 엔진은 빠르고, 반복 가능하고, 테스트 가능해야 한다.

### 3.2 비결정적 엔진

비결정적 엔진은 LLM 또는 Narre가 맡을 수 있는 영역이다.

- 모호한 사용자 의도 해석
- 불완전한 schema/field 이름 추론
- 후보군 중 의미적으로 가장 적절한 대상 선택
- 파일 내용과 객체 metadata 사이의 의미 연결
- 구조화되지 않은 설명에서 모델/필드/관계 후보 제안

이 엔진은 DB를 대체하지 않는다. 결정적 엔진이 만든 후보군과 맥락을 받아 의미 판단을 수행한다.

### 3.3 Headless Orchestration Layer

두 엔진 사이에는 headless orchestration layer가 필요하다.

이 계층은 사용자에게 보이는 UI가 아니라, 다음 일을 프로그램적으로 수행하는 실행 계획 계층이다.

- 쿼리 의도를 작은 단계로 분해한다.
- 결정적으로 조회할 수 있는 후보군을 먼저 모은다.
- 후보군, 관련 model, field, edge, content excerpt를 압축한다.
- LLM에게 넘길 프롬프트와 판단 기준을 조립한다.
- LLM 응답을 다시 Netior 객체 참조나 쿼리 결과로 정규화한다.

즉 LLM은 "마법 검색창"이 아니라, 쿼리 계획 안에서 선택적으로 호출되는 비결정적 operator로 취급되어야 한다.

## 4. DSL의 위치

Netior DSL은 field behavior나 interactive view만을 위한 보조 표현이 아니다. 장기적으로는 Netior의 온톨로지 DB / 네트워크 DB가 스스로를 질의하고 해석하는 언어가 되어야 한다.

따라서 DSL은 두 성격을 함께 가져야 한다.

### 4.1 DB적 성격

DSL은 저장된 객체를 조회하고 조합할 수 있어야 한다.

- select
- traverse
- filter
- sort
- aggregate
- project
- resolve reference
- read field value
- follow edge

현재 구현에서는 이 부분이 SQLite와 repository/service layer 위에서 해석될 수 있다.

### 4.2 온톨로지적 성격

DSL은 단순 테이블/컬럼이 아니라 Netior의 의미 구조를 참조해야 한다.

- schema
- field
- instance
- object record
- edge
- network node
- model
- source_ref
- field binding
- edge model

중요한 점은 DSL이 사용자 도메인 로직을 내장하지 않는다는 것이다. DSL은 "시험", "문제", "퀴즈", "논문" 같은 도메인 명사를 아는 언어가 아니다. 대신 schema, field, edge, instance에 연결된 model 의미를 해석하고 조합하는 메타 언어다.

## 5. Model과 DSL

Netior에서 model은 의미다. 다만 model은 특정 사용자 도메인의 명사가 아니라, 여러 작업 세계를 가로지르는 도메인 독립 의미 역할이다.

예시는 다음과 같다.

- 시간: 마감, 반복
- 워크플로우: 상태, 진행, 담당, 우선순위, 추정
- 구조: 포함, 정렬, 계층, 부모-자식, 태그, 분류
- 지식: 첨부, 출처

따라서 DSL은 `nextQuestion()`이나 `totalExamScore()` 같은 도메인 함수를 제공하면 안 된다. 대신 다음과 같은 의미 작용을 표현해야 한다.

- 포함 관계를 따라 관련 인스턴스를 찾는다.
- 정렬 의미를 가진 field value로 다음/이전 객체를 찾는다.
- 상태 의미를 가진 field value로 필터링한다.
- 수량 또는 추정 의미를 가진 값을 집계한다.
- 출처나 첨부 의미를 가진 참조를 수집한다.

이 접근은 DSL의 도메인 독립성을 해치지 않는다. Netior는 사용자 도메인을 아는 것이 아니라, 도메인들 사이에서 반복되는 의미 작용을 아는 것이다.

## 6. SQLite 위 추상 DB와 장기 native engine

현재 Netior는 SQLite 위에 Netior의 ontology/network model을 얹고 있다.

```text
Netior ontology/network model
  -> repository/service abstraction
  -> SQLite tables
```

이는 현재 단계에서 현실적인 구조다. 그러나 장기적으로 보면 Netior는 SQLite 위에 또 하나의 추상 DB를 운영하는 구조에 가까워질 수 있다. 이중 구조가 계속 커지면, Netior의 본질적인 질의 언어와 SQLite의 물리적 모델 사이의 간극도 커진다.

따라서 장기적으로는 Netior DSL이 native ontology/network DB engine의 실행 언어가 될 가능성을 열어둔다.

이 말은 단기간에 SQLite를 제거한다는 뜻이 아니다. 현재는 SQLite를 안정적인 저장 계층으로 유지하되, DSL을 SQLite query builder에만 종속시키지 않아야 한다는 뜻이다.

DSL은 다음 대상들 사이에서 공통 언어로 남아야 한다.

- 현재 SQLite 기반 repository/service
- renderer semantic projection
- field behavior evaluator
- network layout interpretation
- interactive view SDK
- Narre/LLM headless orchestration
- 미래 native ontology/network DB engine

## 7. 설계 원칙

1. 결정 가능한 것은 결정적 엔진이 처리한다.
2. 의미적으로 모호한 판단은 후보군을 좁힌 뒤 비결정적 엔진에 위임한다.
3. LLM에게 전체 DB를 던지지 않는다.
4. LLM 호출은 headless query plan 안의 명시적 단계여야 한다.
5. DSL은 SQLite 전용 query builder가 아니어야 한다.
6. DSL은 interactive view 전용 helper도 아니어야 한다.
7. DSL은 도메인 로직을 내장하지 않는다.
8. DSL은 schema/field/edge/instance에 연결된 model 의미를 해석한다.
9. model은 도메인 명사가 아니라 도메인 독립 의미 역할이다.
10. 장기적으로 DSL은 Netior native ontology/network DB engine의 기반이 될 수 있어야 한다.

## 8. 현재 단계의 의미

현재 단계에서 이 문서는 구현 계획이 아니라 방향 고정 문서다.

당장 필요한 것은 다음을 피하는 것이다.

- DSL을 단순 조건식 언어로 축소하는 것
- DSL을 SQLite query builder로만 설계하는 것
- DSL을 LLM prompt format으로만 설계하는 것
- DSL을 interactive view 전용 API로만 설계하는 것
- 모든 의미 판단을 LLM에게 넘기는 것
- custom model 자유도를 과도하게 열어 DSL에 별도 meta-model 계층을 강제하는 것

초기 구현은 작게 시작할 수 있다. 하지만 그 작은 구현도 장기적으로는 Netior가 온톨로지 DB / 네트워크 DB로 확장될 수 있는 방향과 충돌하지 않아야 한다.
