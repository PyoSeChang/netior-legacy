# Netior Roadmap Draft

이 문서는 새 Netior 도메인 모델로 전환하기 위한 제품 roadmap 초안이다.

Roadmap은 당장의 작업 목록이 아니다. Netior가 어떤 제품 경험으로 성장해야 하는지, 어떤 순서로 성숙해져야 하는지 정리하는 큰 방향 문서다. 실제 구현 단위와 완료 조건은 `04-plan` 문서에서 다룬다.

## 큰 흐름

새 Netior의 제품 흐름은 다음처럼 단순화한다.

1. 세계 정의
2. View
3. 세계 변화 / 동작
4. 세계 측정
5. 세계 업데이트

이 순서는 제품 경험의 자연스러운 의존성을 따른다.

- 정의가 있어야 볼 수 있다.
- 볼 수 있어야 사용자가 동작을 이해할 수 있다.
- 동작이 있어야 변화가 생긴다.
- 변화가 측정되어야 AI와 Netior가 해석할 근거를 가진다.
- 해석과 결정이 있어야 World가 업데이트된다.

## 1. 세계 정의

첫 단계는 Netior가 World를 기술할 수 있는 언어를 다시 세우는 것이다.

목표는 사용자가 AI 없이도 World 안의 종류와 관계를 정의할 수 있게 만드는 것이다. AI는 이 단계에서 translator로 개입할 수 있지만, World 안의 진실 자체는 사용자의 권위에 속한다.

주요 작업:

- World와 Model의 의미를 정리한다.
- World/Model과 directory path의 관계를 확정한다.
- Kind를 정의할 수 있게 한다.
- Property를 정의할 수 있게 한다.
- Property는 value를 가지지 않는다는 원칙을 반영한다.
- RelationKind를 정의할 수 있게 한다.
- RelationKind의 각 자리에 올 수 있는 Kind 제한을 둔다.
- Instance와 Resource를 분리한다.
- Resource가 어떤 Instance의 근거인지, 어떤 Kind/Relation에 할당되는지 기록할 수 있게 한다.
- 기존 schema, meaning, field 모델 중 새 definition 계층으로 옮길 수 있는 부분을 선별한다.
- 기존 `schema_field_bindings`식 범용 behavior 계층을 그대로 재현하지 않는다.

이 단계의 산출물:

- 새 World/Model 정의 모델
- Kind/Property/RelationKind editor의 기준
- Instance/Resource/Assignment/Evidence 기준
- 기존 ontology 모델의 최소 마이그레이션 경로
- 새 도메인 모델을 읽고 쓰는 기본 API

## 2. View

두 번째 단계는 정의된 World를 사용자가 볼 수 있게 만드는 것이다.

View는 단순 화면 상태가 아니라 World를 어떤 방식으로 projection할지에 대한 도메인 일부다. 다만 View는 제품의 핵심을 가리는 중심이 되어서는 안 된다. 새 Netior의 중심은 canvas engine이 아니라 World, Resource, Instance, Kind, Relation의 해석이다.

MVP ViewType:

- `explorer`
- `canvas`

Explorer는 파일 탐색기와 비슷하지만 충분하지 않은 부분을 보완한다. 파일과 폴더만 보여주는 것이 아니라 Resource, Instance, Kind assignment, Relation, change signal을 함께 보여주어야 한다.

Canvas는 Netior의 network 철학을 유지하는 projection이다. 사용자는 Kind, RelationKind, Instance, Resource를 canvas 위에 배치하고 관계를 볼 수 있다. 하지만 canvas가 모든 저장과 탐색의 중심 엔진이 되어서는 안 된다.

주요 작업:

- View 저장 모델을 정의한다.
- Explorer와 Canvas를 MVP ViewType으로 둔다.
- 같은 Canvas 안에서 같은 subject의 중복 배치는 MVP에서 금지한다.
- Canvas node/edge type은 DB 구조상 확장 가능하게 열어둔다.
- MVP UI는 built-in node/edge type만 제공한다.
- Canvas에서 다른 Model의 Kind/RelationKind/Instance/Resource를 같은 World 안이면 참조 배치할 수 있게 한다.
- Canvas context menu에서 hide from canvas, copy/paste, area select 같은 기본 조작을 제공한다.
- Inspector는 별도 고정 패널이 아니라 editor tab/details/interactive mode로 위임한다.

## 3. 세계 변화 / 동작

세 번째 단계는 World가 실제로 동작하고 변화하게 만드는 것이다.

세계가 동작한다는 것은 세계가 변화한다는 뜻이다. 이 변화는 Netior가 직접 할당한 Instance에만 국한되지 않는다. 외부 resource가 추가되거나 변경되는 것도 World 변화의 후보다.

주요 작업:

- Domain operation contract를 정의한다.
- JSON-RPC는 domain operation을 담당한다.
- REST는 resource content/binary를 담당한다.
- SSE는 event stream을 담당한다.
- Resource discovery와 change detection을 정의한다.
- Kind/Relation assignment 변경을 기록한다.
- Property value source가 resource인지 manual assertion인지 구분한다.
- AI 제안은 바로 truth가 아니라 accepted/rejected/superseded 흐름을 가진다.
- Desktop, MCP, interactive view가 같은 service contract를 공유하게 한다.

예상 operation 범주:

- World/Model 조회와 트리 탐색
- Kind/Property/RelationKind 생성, 수정, 삭제
- Instance 생성, 수정, 삭제
- Resource 등록, 조회, 변경 감지
- Instance-Resource mapping
- Kind assignment
- Relation assertion
- Evidence 기록
- View subject 조회
- Change event 조회

## 4. 세계 측정

네 번째 단계는 Netior가 변화와 동작을 측정하는 것이다.

Netior는 세계 변화를 결정적으로 해석할 수 없다. 그래서 Netior와 AI가 협업해야 한다. Netior는 변화를 측정하고 축적하며, 언제 AI를 호출할지 판단하고, AI가 어떤 기준으로 판단해야 하는지 정의하고, AI의 판단 결과를 다시 World 변화 기록으로 남겨야 한다.

주요 작업:

- Change log와 event model을 정의한다.
- Resource change와 assignment change를 구분한다.
- 사용자의 view/edit/action 흐름을 측정한다.
- AI 호출이 필요한 변화와 필요 없는 변화를 구분한다.
- Validator가 볼 수 있는 evidence bundle을 정의한다.
- 측정 데이터로 Kind/Relation assignment의 적합성을 평가한다.
- Validator는 빈 공간에서 검증하지 않고, actor의 실행 결과와 측정 데이터를 근거로 검증한다.

이 단계에서 AI 역할은 격리되어야 한다.

- Translator: 사용자의 세계관을 Netior 언어로 번역한다.
- Actor: 사용자가 설정한 World 위에서 동작한다.
- Validator: 동작 결과와 측정 데이터를 근거로 정의를 검증한다.

세 역할은 같은 데이터를 보더라도 같은 agent가 되어서는 안 된다.

## 5. 세계 업데이트

다섯 번째 단계는 측정과 검증 결과를 바탕으로 World를 업데이트하는 것이다.

World 업데이트는 AI가 마음대로 truth를 쓰는 과정이 아니다. 사용자가 World의 최종 권위자이며, Netior와 AI는 변화의 후보, 근거, 판단을 정리해 사용자가 받아들일 수 있게 해야 한다.

주요 작업:

- AI suggestion model을 정의한다.
- Suggestion의 상태를 accepted/rejected/superseded로 관리한다.
- Kind/Relation/Property 변경 제안을 생성한다.
- Instance/Resource assignment 변경 제안을 생성한다.
- 기존 정의가 현실의 변화와 맞지 않을 때 warning을 만든다.
- 사용자가 받아들인 제안만 World definition 또는 assignment에 반영한다.
- 업데이트 결과를 다시 measurement/evidence로 남긴다.

## 기존 기능 마이그레이션 후보

기존 Netior에서 가져올 기능:

- 통합 에디터
- 확장자 기반 editor routing
- Markdown, image, PDF, text editor
- terminal editor
- browser editor
- domain model editor
- canvas 기반 view
- interactive view
- sidebar
- Narre/AI interaction surface

단, 그대로 가져오지 않는다.

- Canvas를 앱 전체의 중심 엔진으로 복원하지 않는다.
- Instance content를 Netior DB로 강하게 소유하지 않는다.
- Meaning/field binding 복잡도를 새 모델에 그대로 이식하지 않는다.
- UI 결정은 domain/product 결정을 대체하지 않는다.

## 제품 기준

Netior는 일반 사용자에게 ontology 구축을 요구하는 앱이 아니다.

사용자는 이미 파일, 폴더, 문서, 코드, 데이터, 서비스 안에 자기 세계를 가지고 있다. Netior는 그 세계를 자기 안에 복사하는 대신, 그 위에 종류와 관계를 얹고, 변화와 근거를 기록하고, AI와 함께 해석할 수 있게 만든다.

따라서 제품의 첫 경험은 다음에 가까워야 한다.

```text
사용자가 폴더를 연다.
Netior가 resource를 보여준다.
사용자는 몇 개의 종류와 관계를 정의한다.
AI는 사용자의 말을 Netior 언어로 번역한다.
사용자는 제안을 고친다.
Netior는 이후 파일 탐색기보다 더 의미 있는 방식으로 세계를 보여준다.
```

## 미결정

- World/Model과 directory path의 정확한 관계
- 하위 directory가 자동으로 Model이 되는지 여부
- Instance와 Resource mapping의 최소 단위
- sub-resource/sub-instance 지원 시점
- capability/SDK의 첫 public contract
- interactive HTML runtime의 sandbox 수준
- AI translator/actor/validator의 저장 모델
- ViewType 확장 방식
