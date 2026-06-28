# Netior Definition Model

이 문서는 Netior의 세계 정의 단계에서 사용할 모델을 정리한다.

목적은 새 Netior가 어떤 언어로 world를 정의하고, 그 정의를 instance와 resource에 연결할지 확정하는 것이다. 이 문서는 전체 도메인 모델이 아니라, 개발 로드맵의 첫 단계인 "세계 정의"에 필요한 모델과 초기 제약에 집중한다.

## 이름과 철학

앱 이름은 Netior를 유지한다.

Netior는 원래 Network Editor의 의미에서 출발했지만, 새 모델에서 network는 더 이상 canvas engine만 뜻하지 않는다. Network는 world 안에서 종류, 인스턴스, 관계, 리소스, 변화, AI 판단이 함께 움직이는 살아 있는 의미망을 뜻한다.

Ontology라는 표현은 너무 정적이다. Netior가 더 중심에 두는 것은 ontology를 정의하는 것 자체가 아니라, 정의된 세계를 실제 instance와 변화에 적용하고, 측정하고, 해석하고, 진화시키는 동적인 과정이다.

따라서 Netior의 핵심 언어는 다음을 유지한다.

- World
- Model
- Kind
- Property
- RelationKind
- Instance
- Resource

## World와 Model

World는 사용자가 Netior에 맡긴 하나의 큰 세계다.

World는 하나의 root directory와 연결된다. 초기 구현에서는 하나의 World가 하나의 root directory를 가진다고 본다. 나중에 여러 source mount가 필요해질 수 있지만, 초기에는 단순성을 우선한다.

Model은 World를 Netior가 다룰 수 있도록 압축한 하위 표현이다.

Model은 단순한 folder가 아니다. Directory tree 위에 얹히는 의미적 모델이다. 어떤 folder는 Model이 될 수 있지만, 모든 folder가 Model이 될 필요는 없다.

UI에서는 `Model`을 그대로 사용한다. 여기서 Model은 AI model이 아니라, World의 일부를 이해하고 다루기 위해 압축한 Netior의 세계 모델을 뜻한다.

초기 원칙:

- World와 Model은 저장 모델에서 단일 tree로 표현한다.
- Root node는 World다.
- Child node는 Model이다.
- World는 root directory와 연결된다.
- Model은 directory binding을 0개 이상 가질 수 있다.
- World directory의 하위 folder가 반드시 Model에 포함될 필요는 없다.
- 하나의 folder subtree는 여러 Model에 동시에 포함될 수 없다.
- 초기에는 directory-backed Model을 중심으로 구현한다.
- Cross-cutting 관심사는 Model보다 View나 Collection 후보로 다룬다.

## Directory와 Model의 관계

Directory는 물리적 구조이고, Model은 의미적 구조다.

초기 구현에서 World는 root directory와 1:1로 대응한다. Model은 directory subtree와 연결될 수 있지만 필수는 아니다.

한 Model이 여러 directory binding을 가질 수 있다. 예를 들어 하나의 Model이 `/a/b`와 `/a/c`를 함께 가질 수 있다. 다만 완전히 다른 branch의 directory들을 묶는 cross-cutting Model은 초기에는 신중하게 다룬다. 그런 요구는 먼저 View 또는 Collection으로 표현할 수 있는지 확인한다.

추천 초기 제약:

- World는 하나의 root directory를 가진다.
- Model은 0개 이상의 directory binding을 가진다.
- 한 directory subtree는 최대 하나의 Model에만 binding된다.
- Directory binding 간 overlap은 service layer에서 검사한다.
- Directory가 Model로 자동 승격되지는 않는다.
- Directory는 먼저 관찰 대상이 되고, 사용자 또는 AI 제안을 통해 Model로 승격될 수 있다.

## Kind

Kind는 World/Model 안에 존재할 수 있는 대상의 종류다.

예:

- Character
- Scene
- Document
- Package
- Dependency
- ExamQuestion
- InteractiveView

Kind는 Model에 정의된다. 하위 Model은 상위 Model의 Kind를 볼 수 있다.

초기 가시성 정책:

- Kind는 특정 Model 또는 World에 정의된다.
- Instance는 자신의 home Model에서 보이는 Kind만 할당받을 수 있다.
- 보이는 Kind는 home Model에 정의된 Kind와 ancestor Model/World에 정의된 Kind다.
- Sibling Model의 Kind는 초기에는 보이지 않는다.
- Override와 shadowing은 초기에는 금지한다.
- Sibling ontology import는 실제 필요가 확인될 때까지 보류한다.

하나의 Instance는 여러 Kind를 가질 수 있다. 다만 모든 Kind는 Instance의 home Model에서 visible해야 한다.

## Property

Property는 어떤 Kind가 가질 수 있는 속성의 정의다.

Property 자체는 값을 가지지 않는다. 값은 Instance에 속한다.

예:

- Character.name
- Character.age
- Package.version
- Scene.time

Property는 값의 형태를 정의한다.

초기 value type 후보:

- text
- number
- boolean
- date
- datetime
- resource-ref
- option

복잡한 computed field, conditional field, derived collection은 Property 자체에 넣지 않는다. 그런 계산, 검증, 파생은 나중에 capability 또는 rule 계층으로 외부화한다.

중요한 원칙:

- Property는 value를 저장하지 않는다.
- Property value는 Instance의 property value 또는 property assertion으로 기록된다.
- Property value가 반드시 Resource에서 추출될 필요는 없다.
- 사용자가 직접 입력한 값, AI가 추론한 값, capability가 계산한 값, 외부 service에서 온 값 모두 가능해야 한다.
- Resource locator는 값의 근거가 될 수 있지만 필수는 아니다.

## RelationKind

RelationKind는 Instance와 Instance 사이에 가능한 관계의 종류다.

예:

- Character appearsIn Scene
- Package dependsOn Package
- Person authored Document
- Character belongsTo Faction

RelationKind는 단순 label이 아니다. 관계 양쪽 자리에 어떤 Kind의 Instance가 올 수 있는지 제한할 수 있어야 한다.

초기 원칙:

- RelationKind는 두 endpoint를 가진다.
- Directed relation이면 subject와 object endpoint가 있다.
- Undirected relation이어도 endpoint kind constraint는 필요하다.
- 초기에는 undirected relation의 양쪽 endpoint constraint가 같은 것을 권장한다.
- RelationAssertion이 accepted 되려면 endpoint의 Instance가 RelationKind의 Kind constraint를 만족해야 한다.

예:

```text
RelationKind: appearsIn
subject endpoint: Character
object endpoint: Scene
directed: true
```

이 경우 다음은 가능하다.

```text
Yuna --appearsIn--> Scene 1
```

다음은 불가능하다.

```text
Scene 1 --appearsIn--> Yuna
```

Scene과 Character가 연결되어 있다는 사실을 UI에서 반대로 보여줄 수는 있지만, canonical relation은 endpoint constraint를 지켜야 한다.

초기 RelationKind는 binary relation으로 시작한다. N-ary relation이 필요하면 처음부터 RelationKind를 복잡하게 만들지 않고, Event나 Relationship Object를 Instance/Kind로 승격해 표현한다.

## Instance

Instance는 World 안에서 의미적으로 식별되는 대상이다.

Netior가 instance의 원본 content와 lifecycle을 강하게 소유하지 않는다는 말은, Instance 자체를 버린다는 뜻이 아니다. Netior는 Instance의 의미 identity와 Kind/Property/Relation 적용을 관리한다. 원본 content와 관찰 가능한 변화는 Resource에 있다.

예:

- 유나
- 첫 만남 장면
- package
- react dependency
- 시험 문제 1번

Instance는 하나의 home Model을 가진다.

초기 원칙:

- Instance는 하나의 home Model을 가진다.
- Instance는 home Model에서 보이는 여러 Kind를 가질 수 있다.
- Relation은 Instance와 Instance 사이에 생긴다.
- Property value는 Instance에 속한다.
- Instance는 하나 이상의 Resource와 연결될 수 있다.
- 초기 구현에서는 대부분 하나의 Instance가 하나의 primary Resource와 연결되는 형태로 시작할 수 있다.

## Display Icon

Kind, RelationKind, Instance는 표시 아이콘을 가질 수 있다.

아이콘은 identity나 ontology rule이 아니라 presentation metadata다. 따라서 아이콘이 바뀐다고 Kind의 의미, RelationKind의 endpoint constraint, Instance의 식별성이 바뀌지는 않는다.

초기 icon source:

- `lucide`: Lucide icon key를 저장한다.
- `image`: 사용자가 지정한 image Resource를 저장한다.
- `none`: 별도 아이콘이 없다.

직접 설정한 이미지 파일은 가능한 한 Resource로 등록한 뒤 참조한다. 이렇게 해야 Explorer, Canvas, Inspector, Interactive View가 같은 표시 자산을 공유할 수 있고, 파일 이동이나 변경 감지도 Resource 관찰 체계 안에서 다룰 수 있다.

아이콘 우선순위는 Instance가 직접 가진 아이콘, View/Canvas가 선택한 Kind의 기본 아이콘, generic fallback 순서로 해석할 수 있다. 하나의 Instance가 여러 Kind를 가질 때 어떤 Kind의 아이콘을 대표로 쓸지는 View/Canvas의 표현 규칙이 결정한다. RelationKind 아이콘은 relation edge label이나 relation action에서 사용된다.

예시 필드 제약:

- `icon_type`은 `lucide`, `image`, `none` 중 하나다.
- `icon_type = lucide`이면 `icon_key`에 Lucide icon key를 저장한다.
- `icon_type = image`이면 `icon_resource_id`에 image Resource를 참조한다.
- `icon_type = none`이면 `icon_key`와 `icon_resource_id`는 비워둔다.

## Resource

Resource는 Instance의 원본, 위치, 근거, 내용의 출처다.

Resource는 온톨로지적 대상 자체가 아니다. Resource는 파일, folder, URL, service object, interactive HTML, JSON 내부 위치, PDF page, image region 같은 source를 표현한다.

예:

- `/characters/yuna.md`
- `/scenes/scene-01.md`
- `package.json`
- `package.json#$.version`
- `package.json#$.dependencies.react`
- `exam.html`

Instance와 Resource는 분리한다.

이유:

- 하나의 Resource 안에서 여러 Instance가 나올 수 있다.
- 하나의 Instance가 여러 Resource로 뒷받침될 수 있다.
- Property value는 Resource 없이도 존재할 수 있다.
- ChangeEvent는 Resource에서 측정된다.
- Relation은 Resource가 아니라 Instance 사이에 생긴다.

예:

```text
Instance: package
Kind: Package
Resource: package.json

Property value:
package.version = "1.2.3"

Value source:
package.json#$.version
```

또 다른 예:

```text
Instance: react dependency
Kind: Dependency
Resource: package.json#$.dependencies.react
```

초기 구현에서는 file/folder resource를 기본 단위로 삼되, 모델은 sub-resource를 수용할 수 있어야 한다.

## Assignment와 Evidence

Assignment는 Netior의 세계 언어를 Instance에 적용한 기록이다.

예:

- 유나는 Character다.
- package는 Package다.
- package.version은 "1.2.3"이다.
- 유나는 Scene 1에 등장한다.

Evidence는 어떤 assignment나 value가 왜 생겼는지, 어디에서 왔는지에 대한 근거다.

Instance와 Resource의 연결은 Evidence 자체가 아니다. 그것은 source mapping 또는 source link다.

구분:

```text
Instance-Resource 연결
  이 Instance가 어떤 Resource와 연결되어 있는가

Evidence
  특정 판단이나 값이 왜 맞다고 보는가
```

예:

```text
Instance-Resource 연결:
Yuna -> /characters/yuna.md

Evidence:
Yuna is Character -> /characters/yuna.md 첫 문단
Yuna.age = 17 -> /characters/yuna.md의 "나이: 17" 줄
Yuna appearsIn Scene 1 -> /scenes/scene-01.md 특정 문장
```

Evidence는 Resource를 가리킬 수도 있고, 가리키지 않을 수도 있다.

Resource 없는 Evidence 예:

- 사용자가 직접 입력함
- 사용자가 승인함
- AI가 여러 문서의 전체 맥락을 보고 추론함
- capability가 계산함
- 외부 service sync 결과임

## 초기 구현 모델

이 섹션은 물리 DB 설계의 출발점이다. 이름과 필드는 구현 중 조정될 수 있지만, 역할과 제약은 이 문서의 모델을 따른다.

### `world_nodes`

World와 Model을 단일 tree로 저장한다.

역할:

- World/Model identity
- tree 구조
- root directory 연결

핵심 필드:

- `id`
- `parent_id`
- `root_id`
- `node_type`: `world` 또는 `model`
- `key`
- `name`
- `root_uri`
- `created_at`
- `updated_at`

제약:

- root World는 `parent_id`가 없다.
- Model은 parent를 가진다.
- root World는 `root_id`가 자기 자신이다.
- Model의 `root_id`는 최상위 World를 가리킨다.
- tree cycle은 금지한다.
- 같은 parent 아래 `key`는 중복될 수 없다.
- `root_uri`는 World에만 필요하다.

### `model_directory_bindings`

Model과 directory subtree의 연결을 저장한다.

역할:

- Model이 어떤 directory 범위를 의미적으로 포함하는지 표현
- 하나의 Model이 여러 directory binding을 가질 수 있게 함

핵심 필드:

- `id`
- `model_id`
- `relative_path`
- `created_at`

제약:

- `model_id`는 `world_nodes`의 Model 또는 World를 가리킨다.
- 같은 World 안에서 동일 directory subtree는 여러 Model에 동시에 binding될 수 없다.
- Directory overlap은 service에서 검사한다.
- Directory가 자동으로 Model이 되지는 않는다.

### `kinds`

Kind 정의를 저장한다.

역할:

- World/Model 안의 대상 종류 정의

핵심 필드:

- `id`
- `model_id`
- `key`
- `name`
- `description`
- `icon_type`
- `icon_key`
- `icon_resource_id`
- `source_kind`
- `source_ref`
- `created_at`
- `updated_at`

제약:

- 같은 visible ontology 안에서 `key` 충돌은 금지한다.
- 초기에는 override와 shadowing을 허용하지 않는다.
- built-in/package 제공 Kind는 안정적인 `source_ref`를 가져야 한다.

### `properties`

Property 정의를 저장한다.

역할:

- Kind가 가질 수 있는 속성의 형태 정의

핵심 필드:

- `id`
- `kind_id`
- `key`
- `name`
- `description`
- `value_type`
- `cardinality`
- `required_policy`
- `created_at`
- `updated_at`

제약:

- 같은 Kind 안에서 `key`는 중복될 수 없다.
- Property는 value를 저장하지 않는다.
- 실제 값은 Instance의 property value/assertion 쪽에 둔다.

### `relation_kinds`

RelationKind 정의를 저장한다.

역할:

- Instance 사이에 가능한 관계 종류 정의
- 관계 endpoint의 Kind constraint 정의

핵심 필드:

- `id`
- `model_id`
- `key`
- `name`
- `description`
- `icon_type`
- `icon_key`
- `icon_resource_id`
- `directed`
- `subject_kind_policy`
- `object_kind_policy`
- `cardinality_policy`
- `created_at`
- `updated_at`

제약:

- 같은 visible ontology 안에서 `key` 충돌은 금지한다.
- accepted relation은 endpoint kind policy를 만족해야 한다.
- 초기에는 undirected relation의 subject/object kind policy가 같은 것을 권장한다.

### `instances`

Instance를 저장한다.

역할:

- World 안의 의미적 대상 identity
- Kind assignment, property value, relation의 대상

핵심 필드:

- `id`
- `home_model_id`
- `key`
- `display_name`
- `icon_type`
- `icon_key`
- `icon_resource_id`
- `status`
- `created_at`
- `updated_at`

제약:

- Instance는 하나의 home Model을 가진다.
- 같은 home Model 안에서 `key`는 중복될 수 없다.
- Instance는 여러 Kind를 가질 수 있다.

### `resources`

Resource를 저장한다.

역할:

- 파일, folder, URL, service object, sub-resource 등 source identity
- 관찰과 변화 측정의 대상

핵심 필드:

- `id`
- `root_id`
- `source_kind`
- `source_uri`
- `relative_path`
- `parent_resource_id`
- `locator`
- `handler_key`
- `fingerprint`
- `observed_status`
- `created_at`
- `updated_at`

제약:

- local file/folder resource는 같은 World 안에서 `relative_path`가 중복될 수 없다.
- sub-resource는 `parent_resource_id`와 `locator`로 식별된다.
- Resource는 ontology relation의 endpoint가 아니다. Relation은 Instance 사이에 생긴다.

### `instance_resource_links`

Instance와 Resource의 source mapping을 저장한다.

역할:

- Instance가 어떤 Resource에 의해 표현되거나 뒷받침되는지 연결

핵심 필드:

- `id`
- `instance_id`
- `resource_id`
- `is_primary`
- `created_at`

제약:

- Instance와 Resource는 N:M 관계를 가질 수 있다.
- 하나의 Instance는 primary Resource를 최대 하나만 가지는 것으로 시작한다.
- `role`, `derived_from` 같은 이름은 RelationKind와 혼동될 수 있으므로 초기에는 쓰지 않는다.

### `kind_assignments`

Instance에 Kind를 할당한 기록이다.

역할:

- "이 Instance는 이 Kind다"라는 판단 기록

핵심 필드:

- `id`
- `instance_id`
- `kind_id`
- `status`
- `created_by`
- `created_at`
- `decided_at`

제약:

- `status`는 candidate, accepted, rejected 등을 가진다.
- 같은 Instance/Kind 조합의 accepted assignment는 중복될 수 없다.
- Kind는 Instance의 home Model에서 visible해야 한다.

### `property_values`

Instance의 실제 property value를 저장한다.

역할:

- 특정 Instance가 특정 Property 값을 가진다는 기록

핵심 필드:

- `id`
- `instance_id`
- `property_id`
- `value_json`
- `status`
- `created_by`
- `created_at`
- `decided_at`

제약:

- Property의 Kind는 Instance의 accepted Kind 중 하나와 호환되어야 한다.
- Property cardinality가 single이면 accepted value는 하나만 허용한다.
- Value는 Resource에서 오지 않아도 된다.

### `relation_assertions`

Instance와 Instance 사이의 실제 관계 판단을 저장한다.

역할:

- 두 Instance 사이에 RelationKind에 해당하는 관계가 있다는 기록

핵심 필드:

- `id`
- `subject_instance_id`
- `relation_kind_id`
- `object_instance_id`
- `status`
- `created_by`
- `created_at`
- `decided_at`

제약:

- accepted relation은 RelationKind의 endpoint Kind constraint를 만족해야 한다.
- undirected relation은 service에서 endpoint 순서를 normalize할 수 있다.
- Relation은 Resource가 아니라 Instance 사이에 생긴다.

### `evidence_records`

Evidence를 저장한다.

역할:

- 특정 판단, 값, 관계가 어디서 왔는지 또는 왜 그렇게 판단되었는지 기록

핵심 필드:

- `id`
- `evidence_type`
- `resource_id`
- `locator`
- `summary`
- `created_by`
- `created_at`

제약:

- `resource_id`는 optional이다.
- Resource 없는 user input, user decision, AI reasoning, calculation evidence가 가능해야 한다.

### `evidence_links`

Evidence가 어떤 판단을 뒷받침하는지 연결한다.

역할:

- Evidence와 Kind assignment, Property value, Relation assertion을 연결

핵심 필드:

- `id`
- `evidence_id`
- `target_type`
- `target_id`
- `support_type`

제약:

- `target_type`은 kind assignment, property value, relation assertion 등을 가리킨다.
- SQLite에서 polymorphic FK를 직접 강제하기 어려우므로 service layer에서 검증한다.

## Phase 1에서 보류하는 것

다음은 모델에 여지를 남기되 초기 구현에서는 보류한다.

- sibling Model ontology import
- Kind inheritance
- virtual Model
- query-backed Model
- cross-cutting Model
- n-ary RelationKind
- computed/conditional/derived Property
- hard cardinality enforcement beyond simple single/multiple
- capability binding UI
- automatic folder-to-Model promotion

## 핵심 불변 조건

- Netior라는 이름은 유지한다.
- World는 root directory와 연결된다.
- Model은 World를 Netior가 다룰 수 있도록 압축한 하위 표현이다.
- Directory는 물리 구조이고 Model은 의미 구조다.
- Kind는 Model에 정의된다.
- 하위 Model은 상위 Model/World의 Kind를 볼 수 있다.
- Sibling Model의 Kind는 초기에는 보이지 않는다.
- Property는 값을 가지지 않는다.
- Instance와 Resource는 분리한다.
- Instance는 하나의 home Model을 가진다.
- Instance는 home Model에서 visible한 여러 Kind를 가질 수 있다.
- RelationKind는 endpoint Kind constraint를 가진다.
- Relation은 Instance와 Instance 사이에 생긴다.
- Resource는 source, evidence, measurement의 대상이다.
- Property value는 Resource 없이도 존재할 수 있다.
- Evidence는 특정 판단의 근거이며 Instance-Resource 연결 자체와 다르다.
