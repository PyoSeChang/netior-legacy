# Netior Domain Model Draft

이 문서는 Netior의 새로운 도메인 모델을 내용 중심으로 정리한 초안이다.

여기에 등장하는 이름들은 구현 이름, 테이블명, 필드명, 제약 조건으로 확정된 것이 아니다. 목적은 Netior가 어떤 개념을 구분해야 하는지, 각 개념이 어떤 책임을 가지는지, 그리고 기존 모델에서 무엇을 내려놓고 무엇을 강화해야 하는지를 정리하는 데 있다.

## 출발점

Netior는 사용자가 정의한 world의 종류와 관계를 기준으로, 실제 instance와 world의 변화를 해석하고 보여주는 앱이다.

핵심 문장은 다음과 같다.

Netior는 World 안에 어떤 종류가 존재하고, 그들이 어떤 관계를 맺는지 정의한다. 그 정의를 실제 instance와 world의 변화에 할당한다. Netior는 그 할당과 변화를 측정하고, 기록하고, 보여준다.

이 문장은 세 가지 전환을 포함한다.

- Netior는 instance의 원본 내용과 생명주기를 강하게 소유하지 않는다.
- Netior는 network canvas를 instance 저장 엔진으로 사용하지 않는다.
- Netior는 directory 기반 world 위에 의미 구조와 변화 기록을 얹는다.

## World와 Root World

instance 소유권을 내려놓고 network engine을 단순화하면, world는 더 이상 추상적인 DB 공간만으로 존재할 수 없다. world는 사용자의 실제 작업 공간, 특히 directory path와 더 직접적으로 연결되어야 한다.

Root world는 사용자가 Netior에 맡긴 최상위 작업 공간이다. 이것은 관찰, 해석, source identity의 기준이 된다. Root world는 실제 directory, 외부 workspace, 혹은 서비스 기반 source에 대응할 수 있지만, 초기 모델에서는 directory 기반 root world가 가장 중요하다.

World는 root world 아래에서 구성되는 의미적 scope다. world는 tree 구조를 가질 수 있어야 한다. 이 tree는 단순히 파일 시스템을 복제하는 것이 아니라, 파일 시스템의 물리적 구조 위에 Netior의 의미 구조를 올리는 방식이다.

Windows 파일 탐색기에서 directory tree는 거의 전부다. Netior에서 directory tree는 world의 물리적 뼈대다. 그 위에 kind, property, relation, assignment, evidence, change, view가 얹힌다.

따라서 새 모델에서 root world와 world의 구분은 중요하다.

- Root world는 관찰과 source identity의 기준이다.
- World는 ontology와 해석이 적용되는 scope다.
- World는 tree 구조를 가질 수 있다.
- 하위 world는 상위 world의 정의를 상속하거나, 확장하거나, 제한할 수 있어야 한다.

## 세상을 기술하는 개념

Netior는 world 안의 세상을 기술하는 언어를 가져야 한다.

이 언어의 중심에는 kind, property, relation kind가 있다. 이름은 바뀔 수 있지만, 이 세 구분은 유지되어야 한다.

Kind는 world 안에 존재하는 종류다. 사람, 문서, 장소, 사건, 등장인물, 장면, 프로젝트, 작업, interactive view 같은 것들이 kind가 될 수 있다.

Property는 어떤 kind가 가질 수 있는 속성의 정의다. 중요한 점은 property는 값을 가지지 않는다는 것이다. Property는 메타적인 정의이며, 실제 값은 instance에 대한 주장 또는 관찰 결과에 속한다.

예를 들어 Person kind가 phone number property를 가질 수 있다고 정의할 수 있다. 하지만 phone number property 자체가 어떤 전화번호 값을 가지는 것은 아니다. 어떤 resource가 Person으로 해석되었고, 그 resource에 대해 특정 전화번호 값이 주장되었을 때에만 값이 생긴다.

Relation kind는 kind와 kind 사이에 가능한 관계의 정의다. 예를 들어 Person이 Document를 작성한다, Character가 Faction에 속한다, Event가 Place에서 발생한다 같은 관계가 여기에 해당한다.

이 층위의 책임은 실제 데이터를 저장하는 것이 아니라, world 안에서 무엇이 의미 있는 종류이고 어떤 관계가 가능한지를 정의하는 것이다.

## Definition과 Assertion의 분리

새 도메인 모델에서 가장 중요한 원칙 중 하나는 definition과 assertion의 분리다.

Definition은 world를 기술하는 메타 언어다. Kind, property, relation kind는 definition에 속한다. 이들은 world 안에서 어떤 종류와 관계가 가능한지를 말한다.

Assertion은 실제 resource나 변화에 대해 Netior가 기록하는 의미 있는 주장이다.

예를 들어 다음은 definition이다.

- Person이라는 kind가 있다.
- Person은 phone number property를 가질 수 있다.
- Person은 Document를 authored relation으로 연결할 수 있다.

다음은 assertion이다.

- 이 markdown 파일은 Person이다.
- 이 markdown 파일의 phone number는 어떤 값이다.
- 이 Person resource는 저 Document resource를 작성했다.

Netior는 instance 자체를 소유하지 않는다. Netior가 소유하는 것은 instance에 대한 의미 있는 주장, 그 주장의 상태, 근거, 판단 이력이다.

이 분리가 무너지면 schema와 instance가 다시 섞이고, Netior는 외부 world를 해석하는 앱이 아니라 내부 DB 객체를 관리하는 앱으로 돌아가게 된다.

## Resource와 Instance

새 모델에서 instance는 Netior가 강하게 소유하는 DB 객체가 아니다. instance는 외부 또는 내부 source에 존재하는 실제 대상이며, Netior는 그것을 resource로 참조한다.

Resource는 파일, 폴더, URL, 외부 서비스 객체, image, PDF, markdown, service reference, interactive view 등으로 나타날 수 있다. Interactive view도 특별한 최상위 원리가 아니라 Netior가 직접 다룰 수 있는 native resource 종류 중 하나다.

Netior가 resource에 대해 알아야 하는 것은 원본 전체가 아니라 다음에 가깝다.

- 이 resource가 어디에서 왔는가
- 어떤 world scope에서 관찰되었는가
- 어떤 handler로 열거나 읽거나 수정할 수 있는가
- 현재 관찰 상태가 어떠한가
- 이전과 비교해 변화했는가
- 어떤 kind나 relation으로 해석되었는가

즉 Netior의 관심은 resource의 소유가 아니라 resource에 대한 해석과 연결이다.

## 도메인 독립성과 외부화된 계산

Netior의 핵심 중 하나는 도메인 독립성이다.

Netior는 세상을 기술하고 동작시키는 앱이지만, 가능한 모든 세상의 규칙을 사전에 정의할 수 없다. 심지어 결정적으로 보이는 규칙도 도메인에 속한다.

예를 들어 어떤 kind의 property 중 a라는 값은 b라는 값보다 항상 1 작아야 한다는 규칙이 있을 수 있다. 이 규칙은 단순한 산술처럼 보이지만, Netior core가 그 의미를 사전에 알아야 하는 규칙은 아니다. 특정 world 안에서만 의미를 가지는 도메인 규칙이다.

따라서 Netior는 규칙과 계산을 내장 기능으로 계속 늘리는 방향으로 가면 안 된다. Netior가 가져야 하는 것은 도메인 규칙을 직접 아는 능력이 아니라, 도메인 규칙을 연결하고 실행하고 기록하는 능력이다.

Netior core가 알아야 하는 것은 다음이다.

- 어떤 계산 또는 검증 능력이 world에 연결되어 있는가
- 그 능력은 어떤 kind, property, relation, resource, change에 적용되는가
- 언제 실행되어야 하는가
- 어떤 입력을 받아 어떤 형식의 결과를 내는가
- 실행 결과를 어떻게 기록하고 검증 데이터로 남길 것인가

Netior core가 알 필요 없는 것은 다음이다.

- 그 계산이 도메인적으로 왜 맞는가
- 모든 가능한 constraint의 종류
- 모든 가능한 action의 의미
- 모든 world에 공통으로 적용되는 규칙 목록

이 관점에서 plugin, script, MCP tool, external service, AI agent는 모두 world에 연결될 수 있는 capability가 된다. Netior는 capability의 실행과 기록을 관리하고, capability의 도메인적 의미는 world 또는 외부 실행 주체가 담당한다.

## 세계의 변화

세계가 동작한다는 것은 세계가 변화한다는 뜻이다.

이 변화는 이미 할당된 instance에만 국한되지 않는다. 새 파일이 생기는 것, 기존 resource가 바뀌는 것, 외부 서비스 객체가 업데이트되는 것, 어떤 resource가 사라지는 것, 아직 어떤 kind에도 할당되지 않은 후보가 나타나는 것 모두 world 변화의 일부다.

Netior는 먼저 변화를 측정해야 한다. 측정은 가능한 한 결정적인 영역이다. 어떤 resource가 생겼다, 내용이 바뀌었다, 위치가 바뀌었다, 사라졌다 같은 사실은 관찰하고 기록할 수 있다.

하지만 변화의 의미는 결정적으로 해석할 수 없다.

새 markdown 파일이 생겼다는 사실은 측정 가능하다. 그러나 그것이 새로운 등장인물인지, 장면 초안인지, 임시 메모인지, 무시해야 할 파일인지는 world의 정의와 사용자의 의도와 AI의 해석이 필요하다.

따라서 변화는 두 층으로 나뉘어야 한다.

- 측정된 변화
- 해석된 변화

측정된 변화는 Netior가 관찰한 사실이다. 해석된 변화는 그 변화가 world 안에서 어떤 의미를 가지는지에 대한 판단이다. AI는 이 해석을 도울 수 있지만, AI의 판단은 곧바로 world의 진실이 아니다. 해석은 후보로 기록되고, 근거와 함께 남으며, 사용자 결정 또는 명시된 정책을 통해 확정된다.

## AI 판단과 사용자 권위

사용자는 world의 권위자다.

AI는 사용자의 world를 원래부터 알 수 없다. 특히 소설 세계관, 연구 맥락, 개인 지식 체계, 조직 내부 업무처럼 사용자만이 가진 정보가 있는 경우 AI와 사용자의 정보는 비대칭적이다.

따라서 AI의 판단은 보조적이고 기록 가능한 형태여야 한다. AI가 어떤 kind를 제안하거나, 어떤 relation을 발견하거나, 어떤 변화의 의미를 해석하더라도, 그것은 world 변화 후보로 남아야 한다.

Netior는 AI 호출 자체도 world runtime의 일부로 다루어야 한다.

- 어떤 변화 때문에 AI가 호출되었는가
- AI에게 어떤 world 정의와 맥락이 주어졌는가
- AI는 어떤 역할로 판단했는가
- AI는 어떤 후보 assertion을 만들었는가
- 그 판단의 근거는 무엇인가
- 사용자는 그것을 승인, 수정, 거절했는가

이 기록이 쌓여야 validator가 world 정의를 검증할 수 있다.

## 세 종류의 Agent

AI agent의 책임은 세 가지로 분리되어야 한다.

Translator는 사용자의 세계관을 Netior의 언어로 번역한다. Translator는 kind, property, relation, rule 후보를 만들고, 모호성을 드러내고, 사용자에게 질문할 수 있다. 하지만 Translator는 world 안에서 행동하지 않는다.

Actor는 사용자가 설정한 world 위에서 수행한다. Actor는 확정된 definition과 capability를 바탕으로 resource를 찾고, 읽고, 수정하고, 관계를 적용하고, 새 변화를 관찰하거나 처리한다. 하지만 Actor는 ontology를 임의로 바꾸지 않는다.

Validator는 world 정의를 검증한다. Validator는 Actor의 실행 로그, 변화 기록, AI 판단, 사용자 승인과 거절, 반복 패턴을 분석한다. 하지만 Validator는 직접 행동하거나 world 정의를 확정하지 않는다.

이 세 역할은 완벽하게 격리되어야 한다.

격리의 목적은 AI를 제한하기 위해서만이 아니다. 사용자의 world 권위를 보존하고, AI 판단의 책임 경계를 명확히 하며, 나중에 무엇이 잘못되었는지 추적할 수 있게 하기 위해서다.

## View와 Network

Netior는 새로운 유형의 파일 탐색기 GUI를 설계해야 한다.

Windows 파일 탐색기는 어떤 위치에 어떤 파일과 폴더가 있는지를 보여준다. Netior는 어떤 world 안에 어떤 kind와 relation이 있고, 그것들이 어떤 resource와 변화에 할당되어 있는지를 보여준다.

따라서 view는 위치가 아니라 의미를 보여준다. 폴더만이 아니라 kind를 보여주고, 파일명만이 아니라 assignment를 보여주며, 수정일만이 아니라 world evolution을 보여준다.

View는 크게 두 축을 가져야 한다.

정적인 세계를 보여주는 view는 현재 world가 무엇으로 이루어져 있다고 정의되어 있는지, 어떤 resource가 어떤 kind로 해석되어 있는지, 어떤 relation이 확정되어 있는지, 어떤 근거가 있는지, 아직 해석되지 않은 대상이 무엇인지 보여준다.

세계의 evolution을 보여주는 view는 무엇이 새로 생겼는지, 무엇이 바뀌었는지, 그 변화가 어떻게 해석되었는지, AI가 어떤 근거로 판단했는지, 사용자가 무엇을 승인하거나 거절했는지, 현재 world 정의가 실제 변화와 잘 맞고 있는지 보여준다.

Network의 철학은 유지된다. 그러나 network는 더 이상 모든 instance를 소유하는 engine이 아니다. Network는 world의 특정 관점을 보여주는 projection이다.

Network가 저장해야 하는 것은 최소화되어야 한다. 어떤 범위를 볼 것인지, 어떤 kind와 relation을 포함할 것인지, 어떤 변화 상태를 보여줄 것인지, 사용자가 어떤 노드를 배치하거나 접거나 강조했는지 정도가 핵심이다.

즉 network는 world의 데이터 자체가 아니라 world를 보는 방식이다.

## 새 모델의 중심 원칙

새 도메인 모델은 다음 원칙을 따라야 한다.

첫째, world는 directory tree와 직접 연결된다. Netior는 directory tree를 버리지 않는다. 대신 directory tree를 world의 물리적 기반으로 삼고, 그 위에 의미 구조와 변화 기록을 올린다.

둘째, definition은 value를 가지지 않는다. Kind, property, relation kind는 world를 기술하는 메타 개념이다. 실제 값과 관계는 resource에 대한 assertion으로 기록된다.

셋째, instance는 Netior가 강하게 소유하지 않는다. Netior는 resource를 참조하고, 그 resource에 대한 해석, 근거, 결정, 변화 기록을 소유한다.

넷째, 도메인 규칙과 계산은 외부화 가능해야 한다. Netior core는 모든 규칙을 알 수 없다. Netior core는 규칙과 계산을 연결하고 실행하고 기록하는 구조를 제공한다.

다섯째, 변화는 측정과 해석으로 나뉜다. Netior는 변화를 측정하고, AI와 협업해 의미를 해석하며, 그 판단을 기록 가능한 후보로 남긴다.

여섯째, AI agent의 역할은 격리되어야 한다. Translator, Actor, Validator는 서로 다른 책임을 가지며, world 권위를 침범하지 않아야 한다.

일곱째, network는 engine이 아니라 projection이다. Netior의 view는 world의 현재 구조와 evolution을 탐색 가능한 형태로 보여주는 의미 기반 탐색기다.

## 부록: 예시 테이블, 필드, 제약

이 부록은 구현 확정안이 아니다. 이름, 필드, 제약은 도메인 모델을 더 구체적으로 검토하기 위한 예시다.

중요한 전제는 다음과 같다.

- Definition 계층은 값을 가지지 않는다.
- 값은 resource에 대한 assertion 또는 observation에만 존재한다.
- World는 directory 기반 tree 구조와 연결된다.
- Network는 source of truth가 아니라 view projection이다.
- 도메인 규칙과 계산은 Netior core 안에 고정하지 않고 capability로 외부화할 수 있어야 한다.

### Scope 계층

#### `root_worlds`

Root world는 관찰과 source identity의 최상위 기준이다.

| 필드 예시 | 의미 |
|---|---|
| `id` | root world 식별자 |
| `name` | 사용자 표시 이름 |
| `source_kind` | `local_directory`, `remote_workspace`, `service` 등 |
| `root_uri` | root directory path 또는 외부 workspace URI |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

제약 예시:

- `root_uri`는 동일 source 안에서 중복되지 않아야 한다.
- 초기 구현에서는 `source_kind = local_directory`를 우선한다.

#### `worlds`

World는 root world 아래의 의미적 scope이며 tree 구조를 가진다.

| 필드 예시 | 의미 |
|---|---|
| `id` | world 식별자 |
| `root_world_id` | 속한 root world |
| `parent_world_id` | 상위 world |
| `name` | 표시 이름 |
| `relative_path` | root world 기준 상대 path |
| `ontology_scope_policy` | 상위 world 정의를 상속, 확장, 제한하는 방식 |
| `observation_policy` | 어떤 resource 변화를 관찰할지에 대한 정책 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

제약 예시:

- 같은 root world 안에서 `relative_path`는 유일해야 한다.
- `parent_world_id`가 있다면 같은 `root_world_id` 안에 있어야 한다.
- world tree는 cycle을 만들 수 없어야 한다.

### Definition 계층

#### `kind_definitions`

Kind는 world 안에 존재하는 종류의 정의다.

| 필드 예시 | 의미 |
|---|---|
| `id` | kind definition 식별자 |
| `world_id` | 정의가 속한 world |
| `key` | world 안에서 안정적인 key |
| `display_name` | 사용자 표시 이름 |
| `description` | 설명 |
| `source_kind` | user, builtin, package 등 정의 출처 |
| `source_ref` | 출처 안에서의 안정적인 참조 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

제약 예시:

- 같은 world 안에서 `key`는 유일해야 한다.
- built-in 또는 package 제공 kind는 `source_ref`로 안정적으로 식별되어야 한다.

#### `property_definitions`

Property는 kind가 가질 수 있는 속성의 정의다. Property는 값을 가지지 않는다.

| 필드 예시 | 의미 |
|---|---|
| `id` | property definition 식별자 |
| `world_id` | 정의가 속한 world |
| `kind_id` | 이 property가 붙는 kind |
| `key` | kind 안에서 안정적인 property key |
| `display_name` | 사용자 표시 이름 |
| `description` | 설명 |
| `value_type` | string, number, boolean, date, resource_ref 등 값의 형식 |
| `cardinality_policy` | 단일 값, 복수 값, 선택적 값 등 |
| `required_policy` | 필수 여부 또는 조건부 필수 정책 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

제약 예시:

- 같은 kind 안에서 `key`는 유일해야 한다.
- `property_definitions`에는 실제 값 필드를 두지 않는다.
- 실제 값은 `property_assertions` 또는 observation 계층에만 둔다.

#### `relation_kind_definitions`

Relation kind는 kind와 kind 사이에 가능한 관계의 정의다.

| 필드 예시 | 의미 |
|---|---|
| `id` | relation kind definition 식별자 |
| `world_id` | 정의가 속한 world |
| `key` | world 안에서 안정적인 relation key |
| `display_name` | 사용자 표시 이름 |
| `description` | 설명 |
| `subject_kind_policy` | subject가 어떤 kind일 수 있는지에 대한 정책 |
| `object_kind_policy` | object가 어떤 kind일 수 있는지에 대한 정책 |
| `directed` | 방향성이 있는 관계인지 |
| `cardinality_policy` | 관계 개수 정책 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

제약 예시:

- 같은 world 안에서 `key`는 유일해야 한다.
- subject/object kind 정책은 특정 kind 하나일 수도 있고, kind 집합, 상속 범위, any 같은 느슨한 정책일 수도 있다.
- relation kind는 실제 relation이 아니라 가능한 관계의 정의다.

### Capability 계층

#### `capabilities`

Capability는 Netior 외부 또는 내부에서 실행 가능한 계산, 검증, 행동 능력이다.

| 필드 예시 | 의미 |
|---|---|
| `id` | capability 식별자 |
| `provider_kind` | builtin, plugin, script, mcp_tool, external_service, ai_agent 등 |
| `provider_ref` | provider 안에서의 capability 참조 |
| `version` | capability version |
| `input_schema` | 입력 계약 |
| `output_schema` | 출력 계약 |
| `trust_boundary` | 실행 신뢰 경계 |
| `created_at` | 생성 시각 |

제약 예시:

- `provider_kind`, `provider_ref`, `version` 조합은 유일해야 한다.
- Netior core는 capability의 도메인 의미를 내장하지 않는다.

#### `world_capability_bindings`

World capability binding은 특정 world 정의나 resource 변화에 capability를 연결한다.

| 필드 예시 | 의미 |
|---|---|
| `id` | binding 식별자 |
| `world_id` | binding이 적용되는 world |
| `target_type` | world, kind, property, relation_kind, resource, change 등 |
| `target_id` | target 식별자 |
| `trigger_policy` | 언제 실행할지 |
| `capability_id` | 연결된 capability |
| `execution_policy` | 자동 실행, 사용자 확인 후 실행, 수동 실행 등 |
| `enabled` | 활성 여부 |

제약 예시:

- target은 해당 world의 scope 안에 있어야 한다.
- capability output은 assertion, evidence, change, validation result 등 Netior가 기록 가능한 형태로 변환되어야 한다.

### Resource 계층

#### `resource_refs`

Resource ref는 Netior가 강하게 소유하지 않는 실제 instance 또는 native resource에 대한 참조다.

| 필드 예시 | 의미 |
|---|---|
| `id` | resource ref 식별자 |
| `root_world_id` | source identity 기준 root world |
| `world_id` | 관찰 또는 해석 scope |
| `source_kind` | file, folder, url, service, netior_native 등 |
| `source_uri` | 원본 위치 또는 외부 참조 |
| `relative_path` | root world 기준 상대 path |
| `resource_type_hint` | markdown, pdf, image, service_object, interactive_view 등 |
| `handler_key` | 열기, 읽기, 수정, 추출을 담당할 handler |
| `fingerprint` | 현재 관찰 상태를 식별하는 hash 또는 signature |
| `observed_status` | observed, changed, missing, ignored 등 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

제약 예시:

- 같은 root world 안에서 source identity는 중복되지 않아야 한다.
- `world_id`는 같은 `root_world_id` 안에 있어야 한다.
- resource ref는 원본 내용을 복제해 소유하는 객체가 아니다.

#### `resource_snapshots`

Resource snapshot은 특정 시점에 관찰된 resource 상태다.

| 필드 예시 | 의미 |
|---|---|
| `id` | snapshot 식별자 |
| `resource_ref_id` | 대상 resource |
| `observed_at` | 관찰 시각 |
| `fingerprint` | 관찰된 상태의 fingerprint |
| `metadata` | 크기, mtime, content type 등 관찰 가능한 메타데이터 |
| `summary` | 필요할 경우 추출 요약 |

제약 예시:

- snapshot은 관찰 기록이며 canonical assertion이 아니다.
- 동일 fingerprint의 snapshot은 정책에 따라 중복을 줄일 수 있다.

### Assertion 계층

#### `kind_assignments`

Kind assignment는 어떤 resource가 어떤 kind로 해석된다는 주장이다.

| 필드 예시 | 의미 |
|---|---|
| `id` | assignment 식별자 |
| `resource_ref_id` | 대상 resource |
| `kind_id` | 할당된 kind |
| `status` | candidate, accepted, rejected, superseded 등 |
| `evidence_id` | 판단 근거 |
| `created_by` | user, translator, actor, validator, policy 등 |
| `created_at` | 생성 시각 |
| `decided_at` | 확정 또는 거절 시각 |

제약 예시:

- 같은 resource와 kind 조합의 accepted assignment는 중복되지 않아야 한다.
- candidate는 여러 개 존재할 수 있다.
- AI가 만든 assignment는 기본적으로 candidate여야 한다.

#### `property_assertions`

Property assertion은 resource가 특정 property 값 또는 값 후보를 가진다는 주장이다.

| 필드 예시 | 의미 |
|---|---|
| `id` | assertion 식별자 |
| `resource_ref_id` | 대상 resource |
| `property_id` | 대상 property definition |
| `value` | 주장된 값 |
| `value_format` | 저장된 값의 형식 |
| `status` | candidate, accepted, rejected, superseded 등 |
| `evidence_id` | 판단 근거 |
| `created_by` | 생성 주체 |
| `created_at` | 생성 시각 |
| `decided_at` | 확정 또는 거절 시각 |

제약 예시:

- `property_id`는 definition이고, 값은 여기 assertion에만 둔다.
- accepted 값의 개수는 property의 cardinality policy를 따라야 한다.
- 값의 형식은 property의 value type과 호환되어야 한다.

#### `relation_assertions`

Relation assertion은 두 resource 사이에 특정 관계가 있다는 주장이다.

| 필드 예시 | 의미 |
|---|---|
| `id` | assertion 식별자 |
| `subject_resource_ref_id` | subject resource |
| `relation_kind_id` | 관계 정의 |
| `object_resource_ref_id` | object resource |
| `status` | candidate, accepted, rejected, superseded 등 |
| `evidence_id` | 판단 근거 |
| `created_by` | 생성 주체 |
| `created_at` | 생성 시각 |
| `decided_at` | 확정 또는 거절 시각 |

제약 예시:

- accepted relation은 relation kind의 subject/object kind policy와 호환되어야 한다.
- directed relation이면 subject와 object의 방향을 보존해야 한다.
- AI가 만든 relation은 기본적으로 candidate여야 한다.

### Evidence와 Decision 계층

#### `evidence_records`

Evidence는 assertion, interpretation, validation의 근거다.

| 필드 예시 | 의미 |
|---|---|
| `id` | evidence 식별자 |
| `world_id` | 근거가 속한 world |
| `source_resource_ref_id` | 근거가 나온 resource |
| `locator` | file range, page, text span, image region, event id 등 |
| `excerpt` | 짧은 근거 발췌 |
| `summary` | 근거 요약 |
| `created_by` | user, ai_agent, capability 등 |
| `created_at` | 생성 시각 |

제약 예시:

- evidence는 가능한 한 원본 resource로 역추적 가능해야 한다.
- 긴 원문을 무조건 복제하지 않고 locator와 요약을 우선할 수 있다.

#### `decisions`

Decision은 후보 판단에 대한 사용자 또는 정책의 결정 기록이다.

| 필드 예시 | 의미 |
|---|---|
| `id` | decision 식별자 |
| `target_type` | kind_assignment, property_assertion, relation_assertion, world_delta 등 |
| `target_id` | 결정 대상 |
| `decision` | accept, reject, modify 등 |
| `decided_by` | 결정 주체 |
| `reason` | 결정 이유 |
| `decided_at` | 결정 시각 |

제약 예시:

- AI 판단을 accepted 상태로 바꾸려면 decision 또는 명시된 policy가 있어야 한다.
- decision은 삭제보다 supersede 방식으로 이력을 남기는 것이 바람직하다.

### Evolution 계층

#### `change_events`

Change event는 world에서 측정된 변화다.

| 필드 예시 | 의미 |
|---|---|
| `id` | change event 식별자 |
| `world_id` | 변화가 관찰된 world |
| `resource_ref_id` | 변화 대상 resource |
| `event_type` | created, modified, deleted, moved, observed 등 |
| `measured_at` | 측정 시각 |
| `before_fingerprint` | 이전 상태 |
| `after_fingerprint` | 이후 상태 |
| `raw_metadata` | watcher 또는 connector가 제공한 원본 메타데이터 |

제약 예시:

- change event는 해석이 아니라 측정 기록이다.
- 같은 변화가 여러 번 감지될 수 있으므로 deduplication 정책이 필요하다.

#### `interpretation_jobs`

Interpretation job은 어떤 변화나 요청을 AI 또는 capability가 해석하도록 만든 실행 단위다.

| 필드 예시 | 의미 |
|---|---|
| `id` | job 식별자 |
| `world_id` | 실행 world |
| `trigger_type` | change_event, user_request, scheduled_validation 등 |
| `trigger_id` | trigger 대상 |
| `agent_role` | translator, actor, validator |
| `input_context_ref` | AI 또는 capability에 제공한 context 참조 |
| `output_contract` | 기대 출력 형식 |
| `status` | queued, running, completed, failed, canceled 등 |
| `created_at` | 생성 시각 |
| `completed_at` | 완료 시각 |

제약 예시:

- `agent_role`에 따라 허용되는 output 종류가 달라야 한다.
- Translator, Actor, Validator의 출력은 서로 섞이지 않아야 한다.

#### `interpretation_results`

Interpretation result는 AI 또는 capability의 해석 결과다.

| 필드 예시 | 의미 |
|---|---|
| `id` | result 식별자 |
| `job_id` | 연결된 interpretation job |
| `result_type` | proposed_assignment, proposed_relation, validation_report 등 |
| `payload` | 결과 본문 |
| `confidence` | 판단 신뢰도 |
| `evidence_id` | 판단 근거 |
| `created_at` | 생성 시각 |

제약 예시:

- result는 곧바로 canonical world 변경이 아니다.
- result가 world에 반영되려면 assertion 후보 또는 decision으로 변환되어야 한다.

### View 계층

#### `views`

View는 world를 보는 방식이다.

| 필드 예시 | 의미 |
|---|---|
| `id` | view 식별자 |
| `world_id` | view가 속한 world |
| `view_type` | network, table, timeline, inbox, validation 등 |
| `name` | 표시 이름 |
| `query_policy` | 어떤 resource, assertion, change를 포함할지 |
| `projection_policy` | 어떻게 보여줄지 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

제약 예시:

- view는 source of truth가 아니다.
- view는 world 데이터를 선택하고 투영하는 projection이다.

#### `view_layout_items`

View layout item은 특정 view 안에서 대상이 어떻게 배치되는지를 저장한다.

| 필드 예시 | 의미 |
|---|---|
| `id` | layout item 식별자 |
| `view_id` | 속한 view |
| `target_type` | resource_ref, kind_assignment, relation_assertion, change_event 등 |
| `target_id` | 배치 대상 |
| `position` | network 좌표 또는 view별 위치 정보 |
| `collapsed` | 접힘 상태 |
| `emphasis` | 강조 상태 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

제약 예시:

- layout item은 대상 데이터를 소유하지 않는다.
- target이 사라지거나 supersede되었을 때 view는 missing 또는 stale 상태를 표현할 수 있어야 한다.

### 주요 불변 조건 예시

이 모델이 지켜야 할 핵심 불변 조건은 다음과 같다.

- `property_definitions`에는 실제 값을 저장하지 않는다.
- accepted `property_assertions`만 canonical property value로 취급한다.
- AI가 만든 assertion은 기본적으로 candidate 상태로 들어온다.
- accepted assertion은 evidence 또는 decision 이력을 추적할 수 있어야 한다.
- resource identity는 root world 기준으로 안정적이어야 한다.
- world tree는 cycle을 만들 수 없다.
- capability execution은 입력, 출력, 실행 주체, 결과를 기록해야 한다.
- interpretation result는 world를 직접 바꾸지 않고 assertion 후보나 validation report로 전환된다.
- network layout은 view 상태이며 world 데이터의 source of truth가 아니다.
