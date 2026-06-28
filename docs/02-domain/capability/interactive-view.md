# Interactive View Capability

이 문서는 Netior의 첫 capability 사용처로서 interactive view와 interactiveViewSDK의 의미를 정리한다.

## 핵심 정의

Interactive view는 Netior renderer에 내장되어 있지 않은 domain-specific UI를 HTML, CSS, JavaScript로 실행하고, scoped SDK를 통해 Netior World와 상호작용하게 하는 runtime이다.

Interactive view는 단순한 HTML preview가 아니다. Markdown, PDF, 이미지, JSON, service object 같은 resource를 더 풍부하게 보여주는 화면일 수 있고, 특정 instance를 다루는 editor mode일 수 있으며, Explorer나 Canvas처럼 World를 보는 custom ViewType이 될 수도 있다.

Netior가 모든 domain-specific UI를 renderer에 직접 구현할 수는 없다. 학습 프로젝트, 다이어리 프로젝트, 가계부, 연구 노트, 소설 집필, 업무 관리처럼 world마다 필요한 interaction은 달라진다. Interactive view는 이런 domain UI를 Netior core 밖에서 만들되, Netior World와 안전하게 연결하기 위한 방식이다.

## 왜 필요한가

Markdown은 지식과 기록을 저장하기에 좋지만 interaction을 표현하기 어렵다.

예를 들어 학습 노트에서 다음과 같은 동작은 Markdown만으로는 수동적이고 정적이다.

- 정답 숨기기
- 채점하기
- 다음 문제로 넘어가기
- 풀이 기록 남기기
- 반복 학습 상태 갱신하기

HTML은 이런 interaction을 자연스럽게 표현할 수 있다. 하지만 Netior renderer에 모든 학습 UI, 다이어리 UI, 가계부 UI, 도메인별 dashboard를 built-in 기능으로 넣을 수는 없다.

Interactive view는 이 문제에 대한 Netior의 확장 지점이다.

```text
World는 의미 구조를 가진다.
Resource는 실제 내용을 가진다.
Interactive view는 특정 world 맥락에서 사용자와 상호작용한다.
interactiveViewSDK는 그 상호작용을 Netior 기록과 domain operation으로 연결한다.
```

## Capability로서의 Interactive View

Capability는 처음부터 완성된 추상 인터페이스로 확정하지 않는다. Netior는 아직 어떤 world 요구가 반복될지, 어떤 실행 provider가 중요해질지 모두 알지 못한다. 따라서 capability는 world의 요구와 실행 가능한 능력이 함께 진화하는 접점으로 다룬다.

그 첫 사용처가 interactiveViewSDK다.

Interactive view capability는 HTML/JS가 특정 World context 안에서 실행될 수 있게 하는 interface다. 이 interface는 다음을 제공해야 한다.

- app context 공유 가능성
- shared UI surface
- scoped domain operation
- 실행 권한과 범위
- 실행 기록과 결과 제출 경로

Interactive view는 service 전체 API를 직접 호출하지 않는다. Host runtime이 SDK call을 받아 권한을 확인하고, 허용된 domain operation 또는 UI bridge로 전달한다.

## 두 가지 사용 위치

Interactive view는 크게 두 위치에서 사용될 수 있다.

### Object-level interactive view

특정 subject를 여는 editor mode로 동작한다.

Subject 예시:

- Instance
- Resource
- Kind
- Relation
- Change event

사용 예시:

- 학습 markdown resource를 quiz UI로 열기
- Character instance를 profile review UI로 열기
- Diary entry를 reflection UI로 열기
- PDF resource를 annotation helper로 열기
- Task instance를 focus session UI로 열기

### ViewType-level interactive view

Explorer, Canvas처럼 World를 보는 projection 자체가 된다.

사용 예시:

- 가계부 dashboard
- 학습 진도판
- 프로젝트 kanban
- 소설 timeline
- 연구 문헌 matrix
- 운동/식단 tracker

이 경우 interactive view는 특정 resource 하나를 미리 보는 화면이 아니라, World 또는 Model의 데이터를 특정 방식으로 query하고 배치하는 custom ViewType이다.

## Renderer와 Interactive View의 책임 경계

Renderer는 범용 shell과 안전한 runtime host를 담당한다.

- tab과 editor frame
- runtime lifecycle
- sandbox
- SDK injection
- permission gate
- theme token 제공
- host UI bridge
- error boundary
- service bridge
- SDK call logging

Interactive view는 domain-specific interaction을 담당한다.

- 정답 숨기기
- 채점하기
- 다음 문제 이동
- 가계부 월별 표
- 소설 timeline
- 프로젝트 board
- 연구 matrix
- domain-specific chart와 form

Netior core는 interactive view의 내부 UI 로직을 소유하지 않는다. 대신 interactive view가 World와 상호작용할 수 있는 범위와 기록 방식을 소유한다.

## SDK 요구사항

interactiveViewSDK의 1차 요구사항은 다음 세 가지다.

### 1. App Context 공유 가능성

Interactive view는 자신이 어떤 Netior 맥락에서 실행되는지 알아야 한다.

공유되어야 할 수 있는 context:

- 현재 World
- 현재 Model
- 현재 subject
- 현재 Resource 또는 Instance
- 현재 View
- 현재 selection
- 현재 theme
- 현재 locale
- 실행 권한 scope
- host가 제공하는 기능

Context는 초기 실행 시 주입될 수 있고, 이후 host event를 통해 변경될 수 있다.

### 2. UI Component 공유

Interactive view가 완전히 고립된 HTML처럼 보이면 Netior의 일부처럼 느껴지기 어렵다. 반대로 renderer 내부 React component를 직접 import하게 하면 sandbox, versioning, style 충돌, 내부 의존성 문제가 커진다.

따라서 초기 방향은 React component 직접 공유가 아니라 shared UI surface를 제공하는 것이다.

초기 shared UI surface 예시:

- theme token
- toast
- confirm dialog
- resource picker
- instance picker
- command bridge

이후 반복되는 패턴은 Netior web component 또는 domain widget으로 승격할 수 있다.

### 3. Domain Operation 공유

Interactive view는 World와 연결되기 위해 domain operation을 호출해야 한다.

하지만 service JSON-RPC 전체를 그대로 노출해서는 안 된다. SDK는 host runtime을 경유하는 scoped wrapper여야 한다.

초기에는 read와 submit 중심으로 시작한다.

- context 조회
- instance/resource/relation 조회
- resource text 또는 JSON 읽기
- view state 저장
- event 기록
- evidence 제출
- candidate 제출
- property value 후보 제출
- relation 후보 제출

확정 mutation은 더 강한 permission, 사용자 decision, 또는 명시된 policy가 필요하다.

## 권한 원칙

Interactive view는 Netior first-party renderer와 같은 권한을 가지면 안 된다.

기본 원칙:

- service full API를 노출하지 않는다.
- shell, file system, network 권한은 기본적으로 주지 않는다.
- resource write는 별도 permission으로 다룬다.
- bulk mutation은 승인 또는 strong policy 없이는 허용하지 않는다.
- AI-generated interactive view의 결과는 기본적으로 candidate 또는 event다.
- accepted world state 변경은 decision 또는 명시된 policy를 거쳐야 한다.

## 실행과 기록

Interactive view 실행은 Netior의 관찰 대상이다.

기록되어야 할 것:

- 어떤 interactive view가 실행되었는가
- 어떤 World와 subject에서 실행되었는가
- 어떤 SDK method를 호출했는가
- 어떤 input context가 제공되었는가
- 어떤 권한으로 실행되었는가
- 어떤 결과가 생성되었는가
- 어떤 candidate, evidence, event, view state가 기록되었는가
- 어떤 호출이 거부되었는가

이 기록은 나중에 capability contract, permission model, Validator, AI agent workflow가 함께 진화할 수 있는 근거가 된다.

## AI와 Interactive View

Interactive view의 중요한 목표 중 하나는 AI가 domain-specific UI를 만들거나 수정할 수 있게 하는 것이다.

사용자는 다음과 같이 요청할 수 있다.

```text
이 학습 노트 폴더에 맞는 퀴즈 뷰를 만들어줘.
가계부 world를 월별 dashboard로 볼 수 있게 해줘.
소설 장면과 등장인물 관계를 timeline으로 보여줘.
```

AI는 HTML/JS/CSS를 생성하고, Netior는 그 결과를 interactive view resource로 저장한다. 실행 시에는 SDK permission과 World binding을 통해 제한된 범위 안에서만 동작하게 한다.

AI가 만든 interactive view도 곧바로 Netior의 권위자가 되지 않는다. Interactive view는 World를 읽고, 사용자 interaction을 받고, candidate/evidence/event를 제출한다. World의 확정은 Netior의 decision 흐름을 따른다.

## Open Questions

- Interactive view를 Resource, ViewType, EditorMode 중 어느 계층에서 어떻게 식별할 것인가
- Interactive view manifest를 어디까지 안정 필드로 둘 것인가
- SDK method를 capability 공통 contract로 언제 승격할 것인가
- UI 공유를 theme token, host bridge, web component 중 어느 단계까지 열 것인가
- AI-generated HTML의 sandbox 수준을 어떻게 정할 것인가
- ViewType-level interactive view의 query scope를 어떻게 제한할 것인가
- Interactive view가 resource write 또는 accepted mutation을 수행할 수 있는 조건은 무엇인가

