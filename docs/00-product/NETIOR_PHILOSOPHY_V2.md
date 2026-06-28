# Netior Philosophy V2

이 문서는 Netior의 철학을 World Model, 진화하는 온톨로지, 사용자/AI/Netior의 층위적 협업 관점에서 다시 정리한 초안이다.

기존 철학 문서가 Netior의 방향 전환을 정리했다면, 이 문서는 그 방향을 더 정확한 개념 구조로 다시 쓴다.

## 핵심 문장

Netior의 World는 실제 세계가 아니라 World Model이다.

Netior는 사용자가 가진 World Model을 정의하고, 그 모델이 resource와 interaction 속에서 기대를 만들고, 행동하고, 관찰하고, 오차를 드러내고, 검증과 결정을 통해 진화하게 하는 workspace다.

Netior의 ontology는 정적인 분류 체계가 아니다. 사용자가 한 번 정의해두는 schema도 아니다. Netior의 ontology는 실제 resource, 사용자 interaction, AI 해석, operation 결과, observation, deviation, validation, decision을 통해 계속 조정되는 evolving ontology다.

짧게 말하면 다음과 같다.

```text
Netior는 온톨로지를 편집하는 도구가 아니라,
World Model이 실제 resource와 interaction을 통해 진화하는 작업 공간이다.
```

## World는 Real World가 아니다

Netior가 다루는 World는 실제 세계 그 자체가 아니다.

World는 사용자가 어떤 세계를 어떻게 이해하고, 분류하고, 관계 짓고, 예측하고, 갱신하는지에 대한 모델이다. 더 정확히는 World Model이다.

따라서 Netior는 현실의 truth를 소유하지 않는다. Netior는 사용자의 World Model이 resource와 interaction을 통해 더 잘 작동하도록 돕는다.

구분은 다음과 같다.

- Real world 또는 external reality는 실제 파일, 사람, 사건, 외부 서비스, 작업 맥락, 물리적/사회적 세계다.
- Resource는 real world나 작업 환경의 일부를 Netior가 참조할 수 있는 형태다. 예를 들어 markdown file, PDF, URL, service object가 될 수 있다.
- World Model은 사용자가 그 세계를 이해하기 위해 만든 definition, rule, relation, state, record의 체계다.
- Observation은 resource, interaction, operation 결과에서 측정된 사실이다.
- Deviation은 World Model의 기대와 observation 사이의 차이다.
- Validation은 그 차이를 줄이기 위해 World Model 또는 실행/관찰 방식을 어떻게 조정할지 평가한다.

이 구분은 중요하다. World를 실제 세계로 착각하면 Netior가 truth의 소유자가 된다. 그러나 Netior에서 최종 권위는 사용자에게 있다. Netior는 사용자의 World Model을 구조화하고, 실행하고, 관찰하고, 검증하고, 갱신 가능하게 만든다.

## 정적 온톨로지를 넘어서는 이유

정적인 ontology editor는 보통 다음을 다룬다.

- Kind를 정의한다.
- Relation을 정의한다.
- Instance를 분류한다.
- 그래프를 본다.

Netior가 가려는 방향은 이것보다 더 동적이다.

```text
Definition과 Rule이 기대를 만든다.
Operation이 World Model에 개입한다.
Observation이 실제 결과를 남긴다.
Deviation이 기대와 실제의 차이를 드러낸다.
Validation이 차이를 줄일 방향을 제안한다.
Decision이 World Model을 조정한다.
조정된 World Model이 다음 기대를 만든다.
```

이 흐름은 닫힌 loop다.

```text
World Model
  -> Expectation
  -> Operation
  -> Observation
  -> Deviation
  -> Validation
  -> Decision
  -> World Model Update
```

Netior의 ontology는 단순히 작성된 구조가 아니라, 계속 검증되고 조정되는 살아 있는 모델이다.

진화한다는 말은 AI가 마음대로 World를 바꾼다는 뜻이 아니다. 진화한다는 말은 기대를 만들고, 관찰하고, 차이를 측정하고, 원인을 평가하고, 수정 후보를 만들고, 사용자가 결정하고, 그 결정이 다음 기대를 바꾼다는 뜻이다.

## Definition과 Rule

World Model은 definition과 rule을 가진다.

Definition은 World Model 안에 무엇이 존재할 수 있는지를 말한다.

예:

- Kind
- Property
- RelationKind
- Resource type
- View type

Rule은 World Model 안에서 무엇이 성립해야 하는지, 어떻게 해석되어야 하는지, 무엇을 기대해야 하는지, 어떤 조건에서 계산/검증/제안이 일어나야 하는지를 말한다.

예:

- Scene은 Location relation을 가져야 한다.
- Markdown scene file의 변경은 Character/Scene relation 후보 검토 대상이다.
- AI가 만든 relation은 바로 accepted state가 아니라 candidate로 들어와야 한다.
- 특정 property value는 resource에서 추출된 값과 manual assertion을 구분해야 한다.

Definition은 가능한 형태의 언어이고, Rule은 그 형태가 어떻게 동작하고 검증되어야 하는지의 언어다.

Definition과 Rule은 모두 World Model의 일부이며, 둘 다 operation의 대상이 될 수 있다.

```text
Definition state
  현재 World Model의 문법

Rule state
  현재 World Model의 원리, 제약, 해석 조건

Definition operation
  definition을 만들거나 바꾸는 공식 행위

Rule operation
  rule을 만들거나 바꾸는 공식 행위
```

## Domain Operation

Domain operation은 World Model의 공식 상태와 기록을 읽거나 변경하는 공식 동사다.

Domain operation은 현재 World Model의 definition과 rule을 따른다. 동시에 definition과 rule 자체를 만들고 수정하는 operation도 포함한다.

따라서 domain operation은 단순 CRUD가 아니다.

CRUD는 row를 넣고, 수정하고, 삭제하는 기술적 행위에 가깝다. Domain operation은 World Model의 문법과 원리에 맞게 무언가를 주장하고, 기록하고, 승인하고, 갱신하는 행위다.

예:

- kind.create
- relationKind.create
- rule.create
- instance.assignKind
- relation.assert
- evidence.record
- candidate.create
- decision.accept

Domain operation은 다음 질문을 동반해야 한다.

- 현재 definition에 맞는가
- 현재 rule을 위반하지 않는가
- evidence가 필요한가
- candidate로 들어와야 하는가
- accepted state로 바로 반영될 수 있는가
- 사용자 decision이 필요한가
- 어떤 observation을 남겨야 하는가

짧게 말하면 다음과 같다.

```text
Definition과 Rule이 World Model의 문법이라면,
Domain Operation은 그 문법에 맞게 말하는 동사다.
```

## Observation

Observation은 World Model 안팎에서 발생한 사건, operation 실행, 실행 결과, 기대와 결과의 차이를 측정해 남긴 기록이다.

Observation은 단순한 외부 변화 감지가 아니다. Operation 자체도 관찰 대상이고, operation의 실패, 부분 성공, 기대와 실제 결과의 오차도 기록 대상이다.

Observation에서 중요한 질문은 다음이다.

```text
무엇을 어떻게 측정하고 남길 것인가?
```

Observation은 의미 해석 이전의 원자료일 수 있고, 이미 수행된 operation의 실행 흔적일 수도 있다.

예:

- file이 생성되었다.
- markdown resource가 수정되었다.
- user가 instance를 열었다.
- interactive view가 answer event를 제출했다.
- capability가 실행되었다.
- domain operation이 실패했다.
- relation.assert가 kind constraint 때문에 거부되었다.
- resource discovery가 permission 문제로 부분 성공했다.
- candidate 80개 중 75개가 사용자에게 거절되었다.

Observation은 나중에 다시 해석할 수 있을 만큼 충분한 맥락과 근거를 가져야 한다.

## Deviation

Deviation은 World Model의 기대와 observation 사이의 계산된 차이다.

Deviation에서 중요한 질문은 다음이다.

```text
무엇을 기대했으며,
실제 observation과 어떻게 다른가?
```

기대가 없으면 차이를 계산할 수 없다. 따라서 deviation을 만들려면 World Model이 무엇을 예측했는지 또는 operation이 무엇을 기대했는지가 필요하다.

기대는 여러 곳에서 올 수 있다.

- Definition constraint
- Rule
- User policy
- Previous pattern
- Capability contract
- Operation precondition
- Operation postcondition
- Validation baseline

예:

```text
Expected:
  Markdown character extractor는 사람 이름 후보를 적당한 수로 제안할 것이다.

Observed:
  후보 80개 생성, 사용자 75개 거절.

Deviation:
  candidate precision이 낮다.
```

또 다른 예:

```text
Expected:
  Scene instance는 Location relation을 하나 가져야 한다.

Observed:
  12개 Scene 중 5개가 Location relation 없음.

Deviation:
  required relation missing.
```

Deviation은 단순 error가 아니다. Deviation은 World Model의 기대와 실제 측정 사이에서 생긴 정보다.

## Validation

Validation은 deviation을 줄이기 위해 무엇을 조정해야 하는지 평가하는 과정이다.

Validation에서 중요한 질문은 다음이다.

```text
이 차이를 어떻게 줄일 것인가?
```

차이를 무조건 World Model state 수정으로 해결하면 안 된다. 차이의 원인은 여러 곳에 있을 수 있다.

- Definition이 틀렸을 수 있다.
- Rule이 너무 강하거나 약할 수 있다.
- Capability가 부정확할 수 있다.
- Observation이 부족하거나 잘못됐을 수 있다.
- Operation이 잘못 설계됐을 수 있다.
- Resource가 실제로 바뀌었을 수 있다.
- 사용자의 의도나 기준이 바뀌었을 수 있다.

따라서 validation은 error attribution에 가깝다. 차이의 책임을 어디에 둘지 평가하고, 어떤 조정 후보가 가능한지 제안한다.

Validation의 결과는 곧바로 truth가 아니다. Validation은 report와 proposal을 만들고, World Model의 확정적 갱신은 decision 흐름을 따른다.

## Capability와 Rule

Rule은 추상적 도메인 관점이다.

Capability는 기능적/실행적 관점이다.

```text
Rule
  이 World Model에서는 무엇이 성립해야 하는가
  무엇을 어떻게 해석해야 하는가
  어떤 조건에서 무엇이 제안, 검증, 계산되어야 하는가

Capability
  그 Rule을 실행하거나 보조할 수 있는 기능
  어떤 provider가 무엇을 할 수 있는가
  어떤 입력을 받고 어떤 결과를 낼 수 있는가
```

예:

```text
Rule:
  Scene은 Location relation을 가져야 한다.

Capability:
  현재 Scene들을 검사해서 Location이 없는 Scene을 찾는다.
```

또 다른 예:

```text
Rule:
  Markdown 학습 노트의 quiz item은 answer/review event를 남겨야 한다.

Capability:
  interactive view가 answer event를 기록하고 review state 후보를 제출하게 한다.
```

모든 capability가 처음부터 명시적 rule에 종속될 필요는 없다. 초기에는 capability가 먼저 생기고, 사용하면서 반복되는 패턴이 나중에 rule로 승격될 수 있다. 이것이 capability와 rule의 공진화다.

## 사용자, AI, Netior

World Model의 구성은 사용자, AI, Netior의 단순 분업으로 설명할 수 없다.

사용자는 정의하고, AI는 행동하고, Netior는 검증하는 식의 평면적 역할 분담은 정확하지 않다.

정의에도 사용자, AI, Netior가 모두 참여한다. 행동에도 사용자, AI, Netior가 모두 참여한다. 학습에도 사용자, AI, Netior가 모두 참여한다.

차이는 누가 어느 층위에서 어떤 권위와 책임과 실행 능력을 가지느냐에 있다.

```text
               User            Netior              AI
Definition     intent/decision  structure/constraint proposal/translation
Action         command/edit     operation/logging    execution/support
Learning       judgment/correction observation/deviation pattern/proposal
```

이 표는 고정된 역할 분담이 아니라 참여 양상의 차이를 나타낸다.

## 의식, 무의식, 신경계의 비유

Netior의 협업 모델은 메타/의식, 무의식, 신경계의 비유로 이해할 수 있다.

- 사용자는 메타/의식에 가깝다.
- AI는 무의식적 생성력에 가깝다.
- Netior는 신경계에 가깝다.

사용자는 목적, 의미, 가치, 방향, 최종 판단을 제공한다. 사용자는 모든 세부를 직접 계산하지 않지만, World Model의 최종 권위와 의식적 결정을 가진다.

AI는 무의식처럼 후보와 해석을 생성한다. AI는 연상하고, 패턴을 발견하고, 대안을 만들고, 암묵적 추론을 수행한다. 그러나 AI의 판단은 곧바로 truth가 아니다.

Netior는 신경계처럼 관찰, 전달, 제약, 기록, operation routing, feedback loop를 담당한다. Netior는 감각 입력을 운반하고, 행동 명령을 전달하고, 오차를 다시 드러내고, 다음 판단을 위한 기록을 축적한다.

이 비유는 역할을 고정하기 위한 것이 아니다. World Model 전체가 의식, 무의식, 신경계의 상호작용처럼 작동한다는 뜻이다.

```text
사용자만 정의한다 X
AI만 행동한다 X
Netior만 검증한다 X

모든 층위에 세 주체가 참여한다.
다만 각 층위에서 권위, 생성력, 기록과 제약의 비중이 다르다.
```

## Evolving Ontology

Netior의 ontology는 다음 흐름을 통해 진화한다.

```text
Definition / Rule
  World Model의 기대 구조

Operation
  World Model에 대한 개입

Observation
  개입과 환경 변화의 측정

Deviation
  기대와 측정 사이의 차이

Validation
  차이의 원인 평가와 조정 후보

Decision
  사용자의 권위에 의한 선택

Update
  World Model의 갱신
```

이 흐름이 구축되면 Netior는 정적인 ontology editor가 아니라 evolving ontology workspace가 된다.

Netior는 관계를 저장하는 데서 멈추지 않는다. 관계가 어떻게 제안되었고, 어떤 근거를 가졌고, 어떤 operation을 거쳤고, 어떤 observation과 deviation을 만들었고, 어떤 validation과 decision을 통해 받아들여졌는지를 함께 축적한다.

결국 Netior의 핵심은 다음이다.

```text
사용자의 World Model이 실제 resource와 interaction 속에서
예측하고, 행동하고, 관찰하고, 오차를 감지하고,
검증과 결정을 통해 진화하게 한다.
```

## 남겨둘 질문

- Product language에서 `World`라고 계속 부를지, `World Model`을 명시할지
- Definition과 Rule을 같은 editor에서 다룰지, 별도 계층으로 둘지
- Observation의 최소 기록 단위는 무엇인지
- Deviation의 기대 모델은 어디에서 어떻게 생성되는지
- Validation report와 proposal의 경계를 어떻게 나눌지
- Capability가 먼저 생기고 Rule로 승격되는 흐름을 어떻게 제품화할지
- 사용자, AI, Netior의 층위별 참여를 UI에서 어떻게 드러낼지

