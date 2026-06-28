# Netior DSL MVP 구현 계획

작성일: 2026-05-13  
상태: Implementation Research Note  
인코딩: UTF-8

## 1. 위치

이 문서는 [`ontology-network-db-dsl-ko.md`](ontology-network-db-dsl-ko.md)의 장기 방향을 구현 레벨로 내린 MVP 계획이다.

핵심 전제는 다음과 같다.

- Netior DSL은 DB적 성격과 온톨로지적 성격을 모두 가져야 한다.
- DSL은 SQLite query builder, interactive view helper, LLM prompt format 중 하나로 축소되면 안 된다.
- DSL은 schema, field, edge, instance에 연결된 model 의미를 해석하고 조합하는 언어여야 한다.
- 모델은 도메인 개념이 아니라 도메인 독립적인 의미다.
- Rule 객체 설계는 보류한다. MVP는 Rule이 아니라 DSL query/expression/evaluator를 먼저 만든다.

## 2. MVP 범위

MVP DSL은 read-only query/expression으로 시작한다.

포함한다.

- 대상 집합 선택
- field value 읽기
- model/meaning 기반 discovery
- exact selector 기반 실행
- filter
- sort
- count/sum 집계
- next/previous 같은 relative selection
- conditional field behavior 평가
- computed field behavior 평가
- derived collection field behavior 평가
- interactive view SDK에서 DSL query 실행

제외한다.

- instance/field/edge mutation
- file content 전문 읽기
- LLM operator 직접 실행
- 자유로운 custom model 확장 설계
- 사람이 직접 쓰는 surface syntax
- native DB engine

MVP의 목적은 DSL이 field behavior와 interactive view의 공통 기반이 될 수 있음을 검증하는 것이다. network layout plugin은 같은 DSL evaluator를 공유하되, plugin 체계 자체는 후속 phase로 분리한다.

## 3. Canonical Format

MVP canonical format은 JSON AST로 둔다.

이유는 다음과 같다.

- Narre가 구조화 출력으로 생성하기 쉽다.
- Zod/JSON schema로 validation하기 쉽다.
- DB에 저장하기 쉽다.
- 특정 node만 patch하거나 재생성하기 쉽다.
- query planner/evaluator가 분석하기 쉽다.
- 나중에 SQLite compiler, headless orchestration, native engine으로 확장하기 쉽다.

사람이 읽고 쓰는 별도 surface syntax는 MVP에서 만들지 않는다. 사용자가 DSL을 직접 작성하지 않는다는 전제를 둔다. Narre가 사용자 의도를 JSON AST로 번역한다.

## 4. Core Value Model

MVP DSL evaluator의 반환값은 작게 시작한다.

```ts
type NetiorDslValue =
  | null
  | boolean
  | number
  | string
  | NetiorObjectRef
  | NetiorObjectRef[];

interface NetiorObjectRef {
  objectType: 'instance' | 'schema' | 'model' | 'edge' | 'file' | 'network';
  refId: string;
  objectId?: string;
}
```

`date`, `datetime`, `duration`은 MVP public value type으로 분리하지 않는다. 필요한 경우 evaluator 내부에서 비교 가능한 number/string으로 normalize한다.

소비처별 기대값은 다음과 같다.

- conditional field는 boolean 값을 기대한다.
- computed field는 scalar 값을 기대한다.
- derived collection은 object ref list를 기대한다.
- interactive view는 scalar, object ref, object ref list를 모두 사용할 수 있다.
- layout은 scalar/list 값을 배치 기준으로 사용할 수 있다.

DSL core는 `predicate`, `derived value` 같은 소비처 개념을 별도 kind로 고정하지 않는다. 같은 expression 결과를 소비처가 자기 계약에 맞게 해석한다.

## 5. Context Model

DSL은 항상 어떤 context 안에서 평가된다.

MVP context는 다음 정도로 시작한다.

```ts
interface NetiorDslContext {
  projectId: string;
  currentObject?: NetiorObjectRef;
  currentInstanceId?: string;
  currentSchemaId?: string;
  currentNetworkId?: string;
  viewState?: Record<string, unknown>;
  overrides?: {
    properties?: Record<string, unknown>;
  };
}
```

`overrides.properties`는 field behavior에서 중요하다. instance editor는 아직 저장하지 않은 draft field value를 가지고 있으므로, conditional/computed/derived 평가가 DB 저장값만 보면 안 된다.

## 6. Selector 전략

DSL은 두 종류의 selector를 모두 허용한다.

### 6.1 Exact Selector

이미 무엇을 찾을지 알고 있을 때 사용한다.

예시는 다음과 같다.

- schemaId
- fieldId
- instanceId
- objectId
- networkId

특징:

- 빠르다.
- 결정적이다.
- 반복 실행에 적합하다.
- interactive view의 저장된 config에 적합하다.

예:

```json
{
  "op": "field.value",
  "of": { "op": "context.object" },
  "fieldId": "field-problem-order"
}
```

### 6.2 Semantic Selector

무엇이 있는지 모르는 상태에서 의미로 찾을 때 사용한다.

예시는 다음과 같다.

- `structure.order` 의미를 가진 field
- `workflow.status` 의미를 가진 field
- `time.start` 의미를 가진 field
- 포함 관계를 의미하는 edge model

특징:

- discovery에 적합하다.
- 자동 설정, layout 후보 찾기, Narre 조사에 적합하다.
- ambiguity가 생길 수 있다.
- 한 번 후보가 정해지면 exact selector로 고정하는 것이 좋다.

예:

```json
{
  "op": "field.value",
  "of": { "op": "context.object" },
  "meaning": "structure.order"
}
```

현재 코드베이스에는 model row와 field meaning binding이 분리되어 있다. DSL 개념상 둘 다 의미 selector지만, 구현에서는 storage 차이를 감춘다.

- field는 우선 `field_meaning_bindings.meaning_key`를 통해 찾는다.
- edge/relation은 `edges.model_id -> models.key/source_ref`를 통해 찾는다.
- model 객체 자체를 찾을 때는 `models.key`, `models.source_ref`, `models.meaning_keys`를 사용한다.

## 7. Scope

collection을 반환하거나 collection 위에서 계산하는 query는 scope를 명시해야 한다.

Scope는 SQL의 `FROM`에 가깝다.

예시는 다음과 같다.

- 현재 schema의 instances
- 특정 schema의 instances
- 현재 object와 특정 model 관계로 연결된 objects
- 현재 network에 포함된 objects

나쁜 방향:

```text
structure.order 기준 다음 객체
```

좋은 방향:

```text
현재 schema의 instances 안에서 structure.order 기준 다음 객체
```

또는:

```text
현재 object와 포함 관계인 objects 안에서 structure.order 기준 다음 객체
```

MVP에서 collection query는 scope가 없으면 invalid query로 본다.

## 8. Known-target Query와 Discovery Query

DSL query는 목적에 따라 두 모드로 나뉜다.

### 8.1 Known-target Query

이미 schema/field/object를 알고 있는 상태에서 실행한다.

예:

```text
현재 문제 instance의 문제 번호 fieldId를 알고 있다.
같은 문제 schema의 instances 중에서 다음 번호를 찾는다.
```

이 경우 fieldId/schemaId를 직접 쓰는 것이 맞다.

```json
{
  "op": "relative",
  "direction": "next",
  "scope": {
    "op": "instances",
    "schemaId": "schema-problem"
  },
  "current": { "op": "context.object" },
  "orderBy": {
    "fieldId": "field-problem-number"
  }
}
```

### 8.2 Discovery Query

프로젝트 안에 무엇이 있는지 모르는 상태에서 의미로 후보를 찾는다.

예:

```text
이 프로젝트에서 calendar layout으로 볼 수 있는 schema가 무엇인가?
time.start 의미를 가진 field가 있는 schema를 찾아라.
```

```json
{
  "op": "discover.schemas",
  "requires": [
    { "fieldMeaning": "time.start" }
  ],
  "optional": [
    { "fieldMeaning": "time.end" }
  ]
}
```

Discovery query는 후보를 반환할 수 있다. 저장된 반복 실행 경로는 가능하면 discovery 결과를 exact selector로 고정해야 한다.

## 9. Ambiguity

Ambiguity 처리는 MVP DSL core가 강하게 고정하지 않는다.

이유는 소비처별 시나리오가 다르기 때문이다. interactive view, layout, field behavior, Narre/headless query가 ambiguity를 처리하는 방식은 서로 다를 수 있다.

MVP core의 최소 책임은 다음과 같다.

- 후보가 0개인지 여러 개인지 감지한다.
- 가능하면 어떤 path에서 ambiguity가 생겼는지 알려준다.
- 가능하면 candidates를 구조화해서 반환한다.
- 후보 중 무엇을 고를지는 core evaluator가 결정하지 않는다.

```ts
type NetiorDslEvalResult =
  | { ok: true; value: NetiorDslValue }
  | {
      ok: false;
      error: {
        code: 'not_found' | 'ambiguous' | 'invalid_query' | 'type_mismatch';
        path?: string;
        candidates?: unknown[];
      };
    };
```

소비처 책임 예시는 다음과 같다.

- interactive view: 저장된 view 실행 중 ambiguity가 나오면 view error로 표시한다.
- Narre: candidates를 보고 fieldId/schemaId를 보강한 뒤 다시 생성한다.
- layout auto-detect: 후보 schema/field를 config 선택지로 보여준다.
- field behavior editor: invalid config로 표시하고 사용자가 대상 field를 선택하게 한다.

## 10. MVP Operator 후보

아래 operator set은 확정 문법이 아니라 첫 구현 후보이다.

- `literal`
- `context.object`
- `context.schema`
- `item`
- `instances`
- `field.value`
- `related`
- `filter`
- `equals`
- `gt`
- `gte`
- `lt`
- `lte`
- `and`
- `or`
- `not`
- `sort`
- `aggregate`
- `relative`
- `discover.schemas`

## 11. Field Behavior Config

`schema_field_bindings.config` 컬럼은 이미 string이다. 컬럼을 바꾸지 않고, 내부 내용을 JSON DSL config로 저장한다.

### 11.1 Conditional Field

필드 표시 여부나 필수 여부를 계산한다.

```json
{
  "version": 1,
  "kind": "conditional_field",
  "effect": "visible",
  "expression": {
    "op": "equals",
    "left": {
      "op": "field.value",
      "of": { "op": "context.object" },
      "fieldId": "field-status"
    },
    "right": { "op": "literal", "value": "active" }
  }
}
```

MVP 통과 기준:

- expression 결과가 boolean이면 field visible/hidden에 반영된다.
- 저장 전 draft property 변경도 즉시 반영된다.
- expression이 invalid면 editor에 오류가 보이고, 필드는 안전하게 표시된다.

### 11.2 Computed Field

저장된 값을 직접 수정하지 않고 계산 결과를 readonly로 표시한다.

```json
{
  "version": 1,
  "kind": "computed_field",
  "expression": {
    "op": "aggregate",
    "fn": "sum",
    "scope": {
      "op": "instances",
      "schemaId": "schema-problem"
    },
    "value": {
      "op": "field.value",
      "of": { "op": "item" },
      "fieldId": "field-score"
    }
  }
}
```

MVP 통과 기준:

- scalar 결과가 readonly field value로 표시된다.
- 계산값은 instance property로 자동 저장하지 않는다.
- invalid/type mismatch는 표시 오류로 처리한다.

### 11.3 Derived Collection

query 결과 object list를 readonly collection으로 표시한다.

```json
{
  "version": 1,
  "kind": "derived_collection",
  "expression": {
    "op": "filter",
    "scope": {
      "op": "instances",
      "schemaId": "schema-problem"
    },
    "where": {
      "op": "equals",
      "left": {
        "op": "field.value",
        "of": { "op": "item" },
        "fieldId": "field-status"
      },
      "right": { "op": "literal", "value": "active" }
    }
  }
}
```

MVP 통과 기준:

- object ref list가 readonly list로 표시된다.
- list item은 instance editor로 열 수 있다.
- 결과가 object list가 아니면 type mismatch로 표시한다.

## 12. Interactive View SDK

field behavior와 interactive view는 둘 다 첫 소비처다. 공통 evaluator를 먼저 만들고, 두 소비처가 같은 API를 사용한다.

초기 API 후보:

```ts
useDslValue(expression)
useDslObject(expression)
useDslObjects(expression)
```

예: 다음 문제 찾기

```json
{
  "op": "relative",
  "direction": "next",
  "scope": {
    "op": "instances",
    "schemaId": "schema-problem"
  },
  "current": { "op": "context.object" },
  "orderBy": {
    "fieldId": "field-problem-number"
  }
}
```

MVP 통과 기준:

- interactive view runtime에서 DSL hook을 호출할 수 있다.
- renderer가 DB를 직접 읽지 않고 service/IPC를 통해 평가한다.
- loading/success/error 상태가 view code에서 다뤄진다.
- 기존 `updateField` 권한과 DSL read 권한은 분리된다.

## 13. Model 생성 자유도 낮추기

현재 MCP의 `create_model`, desktop의 `ModelEditor`는 custom model/recipe/meaning/rule 비슷한 구조를 지나치게 자유롭게 만들 수 있다.

MVP 정책은 다음과 같다.

- 기본 경로는 built-in/curated model 재사용이다.
- Narre는 임의 custom model을 만들지 않는다.
- custom model 생성은 advanced/dev 경로로 낮춘다.
- field/edge/instance가 의미를 필요로 할 때는 기존 model 또는 field meaning binding을 먼저 찾는다.
- 없는 경우에도 즉시 custom model을 만들지 않고, 사용자 확인이나 catalog 확장을 거친다.

구현 후보:

- MCP에 `list_semantic_models` 또는 `list_model_catalog` 도구를 추가한다.
- MCP에 `evaluate_dsl`, `validate_dsl`, `discover_dsl_targets` 도구를 추가한다.
- 기존 `create_model`은 유지하되 Narre prompt에서는 기본 사용 금지로 둔다.
- desktop `ModelEditor`에서는 built-in model 편집을 제한하고 custom 생성 UI를 advanced로 보낸다.

통과 기준:

- Narre prompt가 custom model 생성을 기본 전략으로 사용하지 않는다.
- MCP에서 built-in/curated model 목록을 조회할 수 있다.
- DSL authoring 시 fieldId/schemaId를 알면 exact selector를 쓰도록 유도된다.
- discovery가 필요한 경우에만 semantic selector를 쓴다.

## 14. Narre Prompting

Narre에는 DSL 작성 원칙을 명시해야 한다.

주입할 원칙:

- 모델은 도메인 개념이 아니라 의미다.
- 가능한 한 built-in/curated model과 기존 field meaning binding을 재사용한다.
- schemaId/fieldId/instanceId를 알면 exact selector를 사용한다.
- 무엇이 있는지 모를 때만 semantic discovery를 사용한다.
- field behavior config는 자연어가 아니라 DSL JSON AST로 작성한다.
- ambiguity가 있으면 임의 선택하지 말고 candidates를 보고 보강한다.
- interactive view에서 navigation/aggregation이 필요하면 DSL hook을 사용한다.

통과 기준:

- Narre가 conditional/computed/derived field config를 JSON AST로 생성할 수 있다.
- Narre가 interactive view code에서 `useDslValue/useDslObject/useDslObjects`를 사용할 수 있다.
- Narre가 custom model 생성보다 기존 model/meaning 조회를 먼저 수행한다.

## 15. MCP Tool 계획

추가 또는 확장할 MCP tool 후보는 다음과 같다.

- `evaluate_dsl`: project/context/expression을 받아 결과를 반환한다.
- `validate_dsl`: DSL JSON AST의 구조와 selector 유효성을 검사한다.
- `discover_dsl_targets`: semantic selector로 schema/field/relation 후보를 반환한다.
- `list_model_catalog`: built-in/curated model과 의미 key를 반환한다.
- schema field tools 확장: `behavior_config` 또는 `dsl_config`를 구조화 입력으로 받는다.

통과 기준:

- Narre가 MCP만으로 DSL config를 생성, 검증, 저장할 수 있다.
- MCP tool 설명이 i18n/display resolver 경로를 따른다.
- 기존 문자열 config도 읽을 수 있지만 invalid/unconfigured로 안전 처리된다.

## 16. Phase Plan

### Phase 0. 문서와 정책 고정

목표:

- DSL MVP 범위, selector 전략, ambiguity 정책, field behavior 계약을 문서화한다.
- 모델 생성 자유도 축소 정책을 명확히 한다.

주요 파일:

- `docs/research/ontology-network-db-dsl-ko.md`
- `docs/research/netior-dsl-mvp-implementation-ko.md`
- `docs/architecture/domain-model.md`

통과 기준:

- 구현자가 DSL이 Rule 객체가 아니라 query/expression/evaluator라는 점을 이해할 수 있다.
- field behavior와 interactive view를 둘 다 1차 소비처로 둔다는 점이 명시되어 있다.
- custom model 자유도를 낮추는 정책이 문서에 남아 있다.

### Phase 1. Shared DSL Types와 Validator

목표:

- JSON AST 타입과 validation을 shared 계층에 둔다.
- renderer, core, MCP, Narre가 같은 타입을 사용한다.

주요 파일 후보:

- `packages/shared/src/types/index.ts`
- `packages/shared/src/dsl/index.ts`
- `packages/shared/src/constants/index.ts`

통과 기준:

- DSL AST 타입이 `@netior/shared`에서 import 가능하다.
- invalid op, 잘못된 selector, 잘못된 config kind를 validation error로 반환한다.
- field behavior config wrapper가 타입으로 표현된다.

### Phase 2. Core Evaluator

목표:

- `@netior/core`에 read-only evaluator를 구현한다.
- exact selector와 semantic selector를 모두 지원한다.

주요 파일 후보:

- `packages/netior-core/src/services/netior-dsl-evaluator.ts`
- `packages/netior-core/src/repositories/schema.ts`
- `packages/netior-core/src/repositories/instance.ts`
- `packages/netior-core/src/repositories/network.ts`

통과 기준:

- current instance의 exact field value를 읽을 수 있다.
- schema scope의 instances를 조회할 수 있다.
- fieldId 기준 relative next/previous를 계산할 수 있다.
- field meaning 기반 discovery가 후보를 반환한다.
- aggregate sum/count가 동작한다.
- `overrides.properties`가 DB 저장값보다 우선 적용된다.
- ambiguity/not_found/type_mismatch/invalid_query가 구조화 error로 반환된다.

### Phase 3. Service, IPC, Renderer Client

목표:

- renderer와 MCP가 같은 service route를 통해 DSL을 평가한다.
- renderer는 DB를 직접 읽지 않는다.

주요 파일 후보:

- `packages/netior-service/src/index.ts`
- `packages/desktop-app/src/main/netior-service/netior-service-client.ts`
- `packages/desktop-app/src/main/ipc/dsl-ipc.ts`
- `packages/desktop-app/src/preload/index.ts`
- `packages/desktop-app/src/renderer/services/dsl-service.ts`

통과 기준:

- `POST /dsl/evaluate` 또는 동등 route가 있다.
- desktop IPC가 `IpcResult<T>` 패턴을 따른다.
- renderer service에서 DSL evaluate를 호출할 수 있다.
- projectId/context/expression/overrides가 end-to-end로 전달된다.

### Phase 4. Field Behavior Engine

목표:

- 조건부, 계산, derived collection field behavior를 실제로 동작시킨다.

주요 파일 후보:

- `packages/desktop-app/src/renderer/components/editor/SchemaFieldRow.tsx`
- `packages/desktop-app/src/renderer/components/editor/InstancePropertiesPanel.tsx`
- `packages/desktop-app/src/renderer/services/dsl-service.ts`
- `packages/netior-mcp/src/tools/schema-field-tools.ts`

통과 기준:

- conditional field가 DSL boolean 결과에 따라 표시/숨김 처리된다.
- computed field가 readonly 계산값으로 표시된다.
- derived collection field가 readonly object list로 표시된다.
- draft property 변경이 behavior 재평가에 반영된다.
- invalid config는 필드를 망가뜨리지 않고 오류 상태로 보인다.
- config 입력은 단순 문자열이 아니라 DSL JSON config로 검증된다.

### Phase 5. Interactive View DSL SDK

목표:

- interactive view가 field retrieval/update를 넘어 DSL query를 사용할 수 있게 한다.

주요 파일 후보:

- `packages/desktop-app/src/renderer/components/editor/interactive/InteractiveViewRuntime.tsx`
- `packages/desktop-app/src/renderer/components/editor/interactive/InteractiveViewPanel.tsx`
- `packages/desktop-app/src/renderer/components/editor/interactive/interactive-view-types.ts`
- `packages/desktop-app/src/renderer/components/editor/interactive/interactive-view-validator.ts`

통과 기준:

- `useDslValue`, `useDslObject`, `useDslObjects`가 runtime SDK에 있다.
- view manifest 또는 validator에서 DSL read 권한이 표현된다.
- 다음 문제 찾기 같은 known-target query가 동작한다.
- status별 배점 합산 같은 aggregate query가 동작한다.
- loading/error 상태가 view에 전달된다.

### Phase 6. MCP와 Narre Prompting

목표:

- Narre가 DSL을 작성, 검증, 저장, 실행 preview할 수 있게 한다.
- custom model 생성을 기본 전략에서 제거한다.

주요 파일 후보:

- `packages/netior-mcp/src/tools/model-tools.ts`
- `packages/netior-mcp/src/tools/schema-field-tools.ts`
- `packages/netior-mcp/src/tools/*dsl*`
- `packages/narre-server/src/**`
- `packages/shared/src/i18n/locales/en.json`
- `packages/shared/src/i18n/locales/ko.json`

통과 기준:

- MCP에서 DSL validate/evaluate/discover가 가능하다.
- MCP tool display name/description이 shared resolver/i18n 규칙을 따른다.
- Narre prompt가 exact selector와 semantic discovery를 구분하도록 지시한다.
- Narre가 field behavior config를 DSL JSON AST로 만들 수 있다.
- Narre가 기존 model/meaning catalog 조회를 custom model 생성보다 먼저 한다.

### Phase 7. Network Layout Plugin 기반

목표:

- layout plugin이 DSL discovery/evaluate를 통해 대상 schema/field/relation을 찾을 수 있게 한다.

주의:

- plugin 체계 전체를 이 phase에서 완성하지 않는다.
- DSL evaluator를 layout 후보 탐색에 연결하는 최소 기반만 만든다.

통과 기준:

- calendar/gantt 후보 schema를 semantic discovery로 찾을 수 있다.
- 선택된 후보는 exact selector 기반 layout config로 저장된다.
- edge model 기반 relation traversal은 최소 한 종류 이상 검증된다.

## 17. 테스트 계획

필수 테스트:

- shared DSL validator 테스트
- core evaluator in-memory SQLite 테스트
- exact selector field value 테스트
- semantic discovery 테스트
- relative next/previous 테스트
- aggregate sum/count 테스트
- `overrides.properties` 우선순위 테스트
- InstancePropertiesPanel conditional/computed/derived rendering 테스트
- InteractiveViewRuntime DSL hook 테스트
- MCP schema/tool validation 테스트

통과 기준:

- `pnpm --filter @netior/shared test`
- `pnpm --filter @netior/core test`
- `pnpm --filter @netior/desktop-app test`
- 관련 MCP/Narre package build 또는 test

## 18. 보류 사항

아래는 MVP에서 고정하지 않는다.

- 사람이 직접 쓰는 DSL surface syntax
- LLM operator
- native DB engine
- mutation expression
- 자유로운 custom model meta-model
- 모든 소비처에 공통인 ambiguity resolution policy
- field reference relation과 edge relation의 완전 통합
- Rule 객체 설계

이 항목들은 실제 소비처 시나리오가 더 쌓인 뒤 다시 결정한다.
