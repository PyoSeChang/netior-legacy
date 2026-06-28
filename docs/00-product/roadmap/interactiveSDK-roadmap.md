# Interactive SDK Roadmap

이 문서는 Netior interactiveViewSDK의 장기 제품 방향을 정리한다.

이 문서는 구현 계획이 아니다. 구체적인 타입, API method, 개발 순서, 완료 조건은 plan 문서에서 다룬다. 여기서는 interactiveViewSDK가 Netior 제품 경험 안에서 어떤 역할로 성장해야 하는지와 어떤 시간 감각으로 성숙해야 하는지를 다룬다.

## 제품 관점

Netior는 사용자의 World를 정의하고, 실제 Resource와 변화에 그 정의를 할당하며, AI와 함께 해석과 기록을 축적하는 workspace다.

하지만 World마다 필요한 화면과 interaction은 다르다. 학습 프로젝트, 다이어리 프로젝트, 가계부, 연구 노트, 소설 집필, 업무 관리, 데이터 검토는 서로 다른 UI를 요구한다.

Netior renderer가 이 모든 domain-specific UI를 built-in 기능으로 구현하는 것은 제품적으로도 기술적으로도 맞지 않다.

interactiveViewSDK는 이 한계를 넘기 위한 제품 방향이다.

```text
Netior는 모든 domain UI를 직접 만들지 않는다.
Netior는 domain UI가 World와 안전하게 연결될 수 있는 runtime과 SDK를 제공한다.
사용자와 AI는 그 위에서 필요한 interactive view를 만든다.
```

## 장기 목표

Interactive SDK의 장기 목표는 HTML/JS 기반 interactive view가 Netior 앱 안에서 자연스럽게 실행되고, World와 연결되어, 사용자의 domain-specific workflow를 지원하게 만드는 것이다.

사용자는 Markdown보다 더 상호작용적인 화면을 얻고, Netior는 core renderer를 비대하게 만들지 않으면서도 domain-specific experience를 확장할 수 있어야 한다.

궁극적으로 interactive view는 다음 두 영역 모두에서 쓰일 수 있어야 한다.

- Instance, Resource, Kind 등을 다루는 editor mode
- Explorer, Canvas를 보완하거나 대체하는 custom ViewType

## 방향 원칙

### 1. Renderer를 비대하게 만들지 않는다

Netior renderer는 모든 domain UI를 품는 곳이 아니다. Renderer는 shell, runtime, permission, context, shared UI surface, service bridge를 제공한다.

Domain-specific interaction은 interactive view 쪽에서 진화한다.

### 2. Interactive view는 Netior World의 일부처럼 느껴져야 한다

Interactive view는 외부 웹페이지처럼 고립되어 보이면 안 된다. 현재 World, subject, selection, theme, command context를 이해하고, Netior의 UI 언어와 자연스럽게 이어져야 한다.

### 3. SDK는 권한이 있는 연결이어야 한다

Interactive view는 service 전체 API를 직접 호출하지 않는다. SDK는 현재 World context 안에서 허용된 app context, UI surface, domain operation만 제공한다.

### 4. 결과는 기록 가능해야 한다

Interactive view에서 일어난 interaction은 Netior의 기록 체계와 연결되어야 한다.

정답 제출, 채점, 사용자 선택, candidate 생성, evidence 제출, view state 변경, relation 제안은 모두 나중에 돌아볼 수 있는 기록으로 남아야 한다.

### 5. AI-generated UI를 제품의 일부로 받아들인다

AI는 interactive view를 생성하고 수정하는 협업자가 될 수 있다. Netior는 AI가 만든 HTML을 신뢰 없이 실행하는 것이 아니라, 제한된 SDK와 permission boundary 안에서 World와 연결한다.

## 시간 감각

### 첫 단계: Interactive view를 Netior 안에서 실행 가능한 화면으로 만든다

초기 interactive view는 HTML/JS가 Netior 앱 안에서 실행되고, 현재 World context를 이해하며, 제한된 방식으로 resource와 domain data를 읽을 수 있는 수준이면 충분하다.

이 단계의 제품 감각은 다음에 가깝다.

```text
사용자가 markdown 학습 노트를 연다.
AI가 간단한 퀴즈 interactive view를 만든다.
사용자는 Netior 안에서 정답을 숨기고, 답을 확인하고, 다음 문제로 넘어간다.
Netior는 그 interaction의 최소 기록을 남긴다.
```

이 단계에서는 interactive view가 완전한 앱 플랫폼이 될 필요는 없다. 중요한 것은 Markdown의 정적 한계를 넘는 첫 경험이다.

### 다음 단계: Interactive view가 World와 의미 있게 연결된다

Interactive view는 단순히 resource를 예쁘게 보여주는 화면을 넘어, World의 Kind, Instance, Resource, Relation, Evidence와 연결된다.

사용자는 interactive view 안에서 다음을 할 수 있어야 한다.

- 현재 subject를 이해한다.
- 관련 resource를 읽는다.
- 관련 instance와 relation을 본다.
- interaction 결과를 event 또는 evidence로 남긴다.
- AI 또는 capability가 만든 candidate를 검토한다.
- view state를 저장하고 이어서 작업한다.

이 단계에서 interactive view는 object-level editor mode로서 제품적 의미를 갖는다.

### 그 다음 단계: Interactive view가 custom ViewType이 된다

Explorer와 Canvas는 범용 ViewType이다. 하지만 많은 World는 고유한 layout과 workflow를 필요로 한다.

이 단계에서 interactive view는 World 또는 Model을 보는 custom projection으로 성장한다.

예시:

- 가계부 World의 월별 dashboard
- 학습 World의 복습 board
- 소설 World의 scene timeline
- 연구 World의 paper matrix
- 프로젝트 World의 kanban

이때 interactive view는 단순 editor가 아니라 World를 탐색하고 조작하는 domain-specific surface가 된다.

### 성숙 단계: AI와 사용자가 view를 함께 만든다

Interactive SDK가 충분히 안정되면, 사용자는 AI에게 World에 맞는 화면을 요청할 수 있다.

```text
이 diary world를 주간 회고 화면으로 만들어줘.
이 research world를 논문 비교 matrix로 보여줘.
이 learning world를 spaced repetition dashboard로 만들어줘.
이 household budget world를 월별 소비 흐름으로 보여줘.
```

AI는 interactive view를 만들고, 사용자는 실행해 보고, 수정 요청을 하고, Netior는 permission과 기록을 관리한다.

이 단계의 핵심은 AI가 renderer 내부 코드를 수정하는 것이 아니라, Netior가 제공하는 interactive SDK 위에서 domain-specific UI를 생성한다는 점이다.

### 장기 단계: Interactive view 생태계가 생긴다

장기적으로 interactive view는 개인 workspace 안에서 재사용되고 공유될 수 있다.

가능한 방향:

- World template과 함께 interactive view 제공
- 특정 Kind에 맞는 editor view bundle
- 특정 domain에 맞는 dashboard bundle
- user-authored interactive view
- AI-generated interactive view
- plugin 또는 capability provider가 제공하는 interactive view

이때 Netior는 interactive view를 무조건 신뢰하는 것이 아니라, manifest, permission, SDK version, execution record를 통해 관리한다.

## 대표 제품 시나리오

### 학습 프로젝트

사용자는 Markdown으로 학습 노트를 작성한다. Interactive view는 노트에서 문제와 답을 추출하거나 사용자가 표시한 부분을 바탕으로 quiz UI를 제공한다.

사용자는 정답을 숨기고, 답을 확인하고, 다음 문제로 넘어가며, 복습 결과를 남긴다. Netior는 이 interaction을 학습 World의 event와 evidence로 축적한다.

### 다이어리 프로젝트

사용자는 일기를 Markdown으로 쓴다. Interactive view는 주간 회고, 감정 태그, 반복 주제, 목표 진행 상황을 다루는 UI를 제공한다.

사용자는 글을 삭제하거나 변형하지 않고도, World 위에 의미와 관계를 얹어 자기 기록을 탐색한다.

### 가계부

사용자는 거래 내역 resource를 등록한다. Interactive view는 월별 소비, 카테고리별 흐름, 반복 지출, 예산 초과를 domain-specific dashboard로 보여준다.

Netior core는 가계부 UI를 built-in으로 알 필요가 없다. Interactive view가 World의 Kind와 Relation을 읽고, 필요한 계산과 표시를 담당한다.

### 소설 집필

사용자는 장면, 등장인물, 장소, 사건을 World로 정의한다. Interactive view는 timeline, character arc, scene order, relation map 같은 집필용 화면을 제공한다.

Canvas가 모든 것을 대신하지 않는다. Interactive view는 특정 domain에서 더 자연스러운 projection을 제공한다.

## 성공 기준

Interactive SDK가 성공하려면 사용자는 다음을 느껴야 한다.

- Markdown보다 더 살아 있는 작업 화면을 얻었다.
- Netior renderer가 지원하지 않는 domain UI도 만들 수 있다.
- AI가 만든 화면이 Netior World와 자연스럽게 연결된다.
- Interactive view가 외부 웹페이지가 아니라 Netior workspace의 일부처럼 느껴진다.
- 결과와 판단이 흩어지지 않고 World의 기록으로 남는다.

개발 관점의 성공보다 중요한 것은 제품 감각이다. 사용자는 Netior가 모든 기능을 미리 갖고 있지 않아도, 자기 World에 맞는 화면을 만들어 쓸 수 있다고 느껴야 한다.

## 미결정

- Interactive view를 제품 언어에서 무엇이라고 부를 것인가
- Object-level interactive view와 ViewType-level interactive view를 같은 이름으로 둘 것인가
- AI-generated interactive view의 기본 신뢰 수준을 어디까지 둘 것인가
- Interactive view를 World template과 어떻게 함께 배포할 것인가
- UI 공유를 어느 수준까지 제품 약속으로 만들 것인가
- Interactive SDK를 capability 전체 모델의 출발점으로 어느 정도까지 일반화할 것인가

