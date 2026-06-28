# 인터랙티브 뷰 구현 계획

작성일: 2026-05-11  
상태: Draft  
인코딩: UTF-8

## 1. 목적

인터랙티브 뷰는 instance를 단순한 property 목록이나 파일 내용으로만 보여주지 않고, instance의 schema, property, content를 바탕으로 상호작용 가능한 화면으로 렌더링하는 기능이다.

예를 들어 어떤 instance가 "문제" schema의 instance라면, 사용자는 문제 본문, 문제 이미지, 선택지, 정답, 해설을 하나의 풀이 화면으로 볼 수 있다. 다만 인터랙티브 뷰의 목적은 "객관식 문제 풀이" 같은 시나리오를 Netior가 미리 정의해두는 것이 아니다.

핵심 목적은 다음과 같다.

- Netior는 instance data, UI primitive, 저장 API, 실행 경계를 제공한다.
- Narre는 그 재료를 사용해 instance에 맞는 고수준 인터랙션을 생성한다.
- 사용자는 생성된 화면을 preview하고, 필요하면 승인해서 재사용 가능한 view로 저장한다.

즉 Netior는 인터랙션 플랫폼을 제공하고, Narre는 그 위에서 instance별 작은 앱을 만든다.

## 1.1 User Flow

### 기본 사용

1. 사용자가 Netior에서 특정 인스턴스를 연다.
2. 인스턴스 화면 안에 일반 편집 영역과 함께 Interactive View 영역이 보인다.
3. 이미 연결된 인터랙티브 뷰가 있으면 바로 화면이 열린다.
4. 사용자는 그 화면에서 버튼을 누르거나, 선택하거나, 입력하거나, 이미지를 보거나, 단계별 UI를 조작한다.
5. 조작 결과는 화면에 즉시 반영된다.
6. 사용자가 다시 같은 인스턴스를 열면 이전 진행 상태가 그대로 남아 있다.
7. 사용자가 인스턴스의 실제 필드 값을 바꾸는 동작을 하면, 일반 편집기처럼 저장 대상이 된다.
8. 사용자가 단순히 선택/펼침/진행 상태만 바꾼 경우에는 별도 저장 버튼 없이 자동으로 유지된다.

### 새 인터랙티브 뷰를 만드는 경우

1. 사용자가 Narre에게 말한다: "이 인스턴스에 맞는 인터랙티브 뷰 만들어줘."
2. Narre가 현재 인스턴스와 schema/field를 읽는다.
3. Narre가 인터랙티브 뷰 초안을 만든다.
4. 사용자는 초안을 미리 본다.
5. 마음에 안 들면 "이 부분 바꿔줘"라고 말한다.
6. Narre가 수정안을 다시 만든다.
7. 사용자가 승인한다.
8. 승인된 뷰가 해당 인스턴스나 schema에 연결된다.
9. 이후 같은 인스턴스를 열면 그 뷰가 실제로 표시되고 조작 가능하다.

### 기존 뷰를 바꾸는 경우

1. 사용자가 기존 인터랙티브 뷰를 보다가 "이렇게 바꿔줘"라고 Narre에게 말한다.
2. Narre가 현재 뷰를 기준으로 수정안을 만든다.
3. 사용자가 preview에서 확인한다.
4. 승인하면 기존 뷰가 업데이트된다.
5. 다음부터 수정된 뷰가 열린다.

### 완료 기준

이 기능은 저장된 template source가 InstanceEditor 안에서 실제 조작 가능한 UI로 렌더링될 때 완료된 것으로 본다.

- source/manifest를 저장만 하고 preview textarea로 보여주는 것은 완료가 아니다.
- Netior가 제공하는 built-in sample/preset view만 실행되는 것도 완료가 아니다.
- Narre 또는 사용자가 만든 template이 선택되고, 검증되고, SDK를 통해 field/view state와 상호작용해야 한다.

## 2. 핵심 요구사항

### 2.1 시나리오 비의존성

Netior는 가능한 인터랙션 시나리오를 미리 열거하지 않는다.

좋지 않은 방향:

- `quiz.multipleChoice`
- `flashcard`
- `checklist`
- `reviewForm`

위와 같은 preset은 제품 기능으로 제공하지 않는다. 제품의 중심은 특정 시나리오가 아니라 composable runtime과 SDK여야 한다.

좋은 방향:

- field 읽기
- field 수정
- view state 저장
- object, file, network, edge 참조
- layout primitive
- input primitive
- action primitive
- 권한 manifest
- preview와 실행 경계

Narre는 위 primitive를 조합해서 정답 처리, 해설 공개, 단계별 학습, 이미지 annotation, 비교표, 실험 UI 같은 구체 로직을 만든다.

### 2.2 Netior 데이터 접근

인터랙티브 뷰는 instance의 property와 content를 읽을 수 있어야 한다. 허용된 경우 일부 property를 수정할 수도 있어야 한다.

단, 다음 두 저장 영역은 구분한다.

- instance property: instance의 원본 데이터
- view state: 사용자의 상호작용 상태

예시:

- `question`, `choices`, `answer`, `explanation`: instance property
- `selectedChoice`, `revealed`, `result`, `attempts`: view state

정답 처리 결과처럼 "사용자가 이 view에서 어떻게 행동했는가"에 해당하는 값은 기본적으로 view state에 저장한다. 문제 자체를 수정해야 하는 경우에만 명시적 권한을 통해 instance property를 수정한다.

### 2.3 Netior UI 정합성

가능하면 인터랙티브 뷰는 Netior 내부 기능처럼 보여야 한다.

- semantic token을 사용한다.
- 기존 UI component의 spacing, focus, hover, disabled 상태를 따른다.
- modal, tooltip, toast, keyboard focus가 앱과 어색하지 않아야 한다.
- 별도 웹페이지처럼 보이는 화면은 기본값이 아니라 고급 실행 경로로 취급한다.

### 2.4 Narre 생성 가능성

Narre가 만들기 쉬운 authoring model이 필요하다.

너무 엄격한 JSON DSL은 안정적이지만, Narre가 예상하지 못한 인터랙션을 만들기 어렵다. 반대로 자유 HTML/JS는 표현력은 높지만, UI 정합성과 안전성 문제가 커진다.

따라서 기본 authoring model은 `Restricted TSX + Netior Interactive SDK`로 둔다.

## 3. 기능 이름과 용어

- 기능명: 인터랙티브 뷰
- 저장 객체: 뷰 템플릿
- 실행 계층: 뷰 런타임
- 생성/개발 표면: Interactive SDK
- 사용자 상호작용 저장소: 뷰 상태

영문 코드명은 다음을 사용한다.

- `InteractiveView`
- `ViewTemplate`
- `InteractiveRuntime`
- `InteractiveSdk`
- `ViewState`

## 4. 권장 아키텍처

인터랙티브 뷰는 별도 editor tab이 아니다. 사용자는 기존처럼 instance를 열고, `InstanceEditor` 안에서 해당 instance를 보는 방식 중 하나로 인터랙티브 뷰를 선택한다.

```text
EditorTab(type: "instance")
  -> InstanceEditor
    -> 기본 편집 화면
    -> content/agent 화면
    -> InteractiveViewPanel
      -> Interactive View Template
      -> Interactive Runtime
      -> Interactive SDK
      -> Netior UI components
      -> Data and state actions
      -> netior-service persistence
```

Narre가 생성하는 것은 "완성된 앱 권한"이 아니라, 제한된 SDK 위에서 실행되는 view module이다.

```tsx
import {
  Button,
  Field,
  ImageField,
  Stack,
  useField,
  useViewState
} from "@netior/interactive-sdk"

export default function View() {
  const answer = useField("answer")
  const [selected, setSelected] = useViewState("selectedChoice")
  const [revealed, setRevealed] = useViewState("revealed")

  const result =
    revealed && selected ? (selected === answer.value ? "correct" : "wrong") : null

  return (
    <Stack>
      <Field name="question" />
      <ImageField name="problem_image" />
      <Field name="choices" onSelect={setSelected} />
      <Button disabled={!selected} onClick={() => setRevealed(true)}>
        정답 확인
      </Button>
      {revealed && <Field name="explanation" />}
      {result && <Field value={result} />}
    </Stack>
  )
}
```

위 코드는 개념 예시다. 실제 SDK는 React hook, component props, async data loading, permission handling을 명확히 정의해야 한다.

## 5. Authoring Model

### 5.1 기본: Restricted TSX + Interactive SDK

Narre는 일반 TSX와 비슷한 형태로 view를 작성한다. 하지만 import 가능한 모듈과 사용할 수 있는 API는 제한한다.

허용:

- `@netior/interactive-sdk`
- SDK에서 제공하는 UI primitive
- SDK에서 제공하는 data, state, action hook
- 제한된 local helper function

차단 또는 sandbox 전용:

- 임의 npm package import
- `window`, `document`, `localStorage`, `indexedDB`
- `eval`, `Function`, dynamic import
- 직접 IPC 호출
- 직접 파일 시스템 접근
- 전역 CSS 또는 document body 조작
- 무제한 network access

### 5.2 보조: Manifest metadata

렌더링과 인터랙션은 TSX source가 담당한다. 별도 JSON spec으로 화면을 선언하지 않는다.

Manifest는 화면을 만드는 규칙이 아니라, source를 저장하고 실행하기 전에 host가 판단해야 하는 metadata만 담는다.

예:

```json
{
  "kind": "interactive-view",
  "sdkVersion": 1,
  "target": { "schemaId": "schema-id" },
  "permissions": {
    "readFields": ["field-id-a", "field-id-b"],
    "writeFields": ["field-id-a"],
    "viewState": true
  },
  "runtime": "sandbox"
}
```

즉 Netior는 시나리오 DSL을 제공하지 않는다. Netior가 제공하는 것은 source를 검증하고, 권한을 설명하고, 저장/승인/실행 경로를 관리하는 얇은 계약이다.

## 6. 실행 경로

작성 모델은 하나로 유지하되, 실행 경로는 두 개를 둔다.

```text
InstanceEditor / InteractiveViewPanel
  -> current instance context
  -> current schema fields
  -> current instance properties
  -> selected view template
  -> runtime 선택

Restricted TSX + Interactive SDK
  -> Host Renderer Runtime
  -> Sandbox Runtime
```

### 6.1 Host Renderer Runtime

Host renderer runtime은 view module을 Netior renderer의 React tree 안에서 직접 실행한다.

장점:

- UI 정합성이 가장 좋다.
- 기존 React context, theme, modal, tooltip, toast, focus 처리가 자연스럽다.
- SDK component가 실제 Netior component처럼 동작한다.

위험:

- Narre 생성 코드가 renderer와 같은 JS context에서 실행된다.
- 실수로 만든 무한 루프가 앱 renderer를 멈출 수 있다.
- 전역 DOM, event, storage 접근을 완벽히 막기 어렵다.

정책:

- built-in view template은 host 실행 가능하다.
- 사용자가 직접 작성하고 승인한 local view는 host 실행 후보가 될 수 있다.
- Narre가 새로 생성한 view는 기본적으로 host 실행하지 않는다.
- validation, preview, 사용자 승인, 실행 이력을 통과한 view만 host 실행 후보가 된다.

### 6.2 Sandbox Runtime

Sandbox runtime은 view module을 iframe 또는 isolated webContents 같은 격리된 실행 환경에서 실행한다.

장점:

- 앱 본체 DOM, CSS, store, IPC에 직접 접근하지 못하게 할 수 있다.
- 잘못된 코드의 피해 범위를 해당 view로 제한한다.
- 문제가 생기면 view만 reload하거나 disable할 수 있다.

단점:

- UI 정합성이 host runtime보다 낮을 수 있다.
- theme, font, token, focus, modal, tooltip, scroll 처리를 동기화해야 한다.

정책:

- Narre가 새로 생성한 view의 기본 실행 경로다.
- preview mode는 sandbox runtime을 우선 사용한다.
- 자유 HTML/CSS/JS 또는 custom visualization은 sandbox runtime 전용으로 둔다.

## 7. 신뢰와 안정성 판단

same renderer에서 실행할지 여부는 사용자가 감으로 판단하지 않는다. Netior가 기술 검사를 수행하고, 사용자는 권한 상승을 승인한다.

### 7.1 Netior 자동 검사

정적 검사:

- import allowlist 확인
- forbidden global 접근 확인
- forbidden API 확인
- top-level side effect 확인
- manifest 권한과 실제 field/action 사용 비교
- TypeScript compile과 SDK typecheck

preview 검사:

- sample instance로 render 성공
- ErrorBoundary error 없음
- 기본 interaction simulation 성공
- excessive state update 없음
- timeout 없음

runtime 관찰:

- render error 횟수
- unauthorized action 요청
- state update 빈도
- long task 또는 timeout
- sandbox crash 또는 reload 횟수

### 7.2 사용자 승인

Netior가 host 실행 후보라고 판단한 view만 사용자에게 승인 UI를 보여준다.

예시:

```text
이 인터랙티브 뷰는 네이티브 실행 후보입니다.

- 허용된 SDK만 사용
- 요청 권한: question, answer 읽기 / view state 저장
- preview 실행 성공

[샌드박스에서 사용] [신뢰하고 네이티브 실행]
```

위험하거나 검증에 실패한 경우:

```text
이 인터랙티브 뷰는 네이티브 실행할 수 없습니다.

- document 접근 감지
- manifest에 없는 field 수정 시도

[샌드박스에서 미리보기] [차단]
```

## 8. 권한 모델

각 view template은 manifest를 가진다.

```json
{
  "id": "view-template.problem-solver",
  "name": "Problem Solver",
  "runtime": "auto",
  "permissions": {
    "readFields": ["question", "problem_image", "choices", "answer", "explanation"],
    "writeFields": ["memo"],
    "writeViewState": true,
    "readFiles": ["problem_image"],
    "writeFiles": [],
    "readNetwork": false,
    "writeNetwork": false
  }
}
```

초기 권한은 field와 view state 중심으로 좁게 시작한다.

1차 권한:

- `readFields`
- `writeFields`
- `writeViewState`
- `readFiles`

후속 권한:

- object search
- instance create/update
- edge create/update
- network read/write
- external fetch

후속 권한은 preview와 사용자 승인 UI가 충분해진 뒤에 연다.

## 9. 데이터 모델 초안

### 9.1 ViewTemplate

저장 위치는 초기에는 DB metadata가 적합하다. template source가 길어지거나 asset이 붙는 경우 project directory의 artifact 파일과 DB metadata를 함께 사용할 수 있다.

필드 후보:

- `id`
- `project_id`
- `name`
- `description`
- `source_kind`
- `source_id`
- `source_ref`
- `target_schema_id`
- `target_model_id`
- `runtime_policy`
- `trust_level`
- `manifest_json`
- `source_code`
- `created_at`
- `updated_at`

### 9.2 ViewState

View state는 instance와 view template의 조합에 대해 저장한다.

필드 후보:

- `id`
- `project_id`
- `instance_id`
- `view_template_id`
- `state_json`
- `created_at`
- `updated_at`

View state는 instance property가 아니다. 동일 instance를 다른 view로 열었을 때 상태가 분리될 수 있어야 한다.

## 10. SDK 표면 초안

### 10.1 Data hooks

```ts
useField(fieldKey: string): FieldValue
useFields(fieldKeys: string[]): Record<string, FieldValue>
useContent(ref: ContentRef): ContentValue
```

### 10.2 Mutation hooks

```ts
useUpdateField(): (fieldKey: string, value: unknown) => Promise<void>
useViewState<T>(key: string, initialValue?: T): [T, (value: T) => Promise<void>]
usePatchViewState(): (patch: Record<string, unknown>) => Promise<void>
```

### 10.3 UI primitives

초기 component set:

- `Stack`
- `Inline`
- `Panel`
- `Section`
- `Field`
- `Text`
- `Markdown`
- `ImageField`
- `Button`
- `IconButton`
- `Input`
- `TextArea`
- `Select`
- `Checkbox`
- `Toggle`
- `Badge`
- `Divider`
- `Toast`

컴포넌트는 desktop-app의 기존 UI component를 감싼 public wrapper로 제공한다. 내부 component와 store를 직접 export하지 않는다.

## 11. 구현 계획

### Phase 0. 코드베이스 정렬과 개념 고정

목표:

- 인터랙티브 뷰가 별도 editor tab이 아니라 `InstanceEditor` 내부 view mode임을 코드 계획에 고정한다.
- 기존 instance property, schema field, Narre card/approval 흐름 중 재사용할 지점을 확정한다.

작업:

- `InstanceEditor`의 상태와 저장 흐름 확인
- `InstancePropertiesPanel`, `InstanceBodyEditor`, `InstanceAgentView`와의 배치 관계 확인
- instance property 저장 경로 확인
- Narre card/approval 흐름 확인
- 이 문서와 구현 TODO에서 `InteractiveView` tab 추가 표현 제거

산출물:

- `InstanceEditor` 내부에 붙일 `InteractiveViewPanel`의 책임 정의
- view state를 instance property와 분리해야 한다는 저장 정책
- 첫 MVP가 제품 preset이 아니라 개발용 fixture로 데이터 흐름을 검증한다는 합의

통과 기준:

- 구현 계획에서 새 `EditorTabType` 추가가 제외되어 있다.
- 인터랙티브 뷰 진입점이 `InstanceEditor` 내부로 정의되어 있다.
- 기존 instance data 경로 중 어떤 API를 재사용할지 명확하다.

검증 방법:

- [EditorContent.tsx](../../../packages/desktop-app/src/renderer/components/editor/EditorContent.tsx)에는 새 tab type을 추가하지 않는 계획인지 확인한다.
- [InstanceEditor.tsx](../../../packages/desktop-app/src/renderer/components/editor/InstanceEditor.tsx) 내부에 view mode/panel을 붙이는 계획인지 확인한다.
- [instance-store.ts](../../../packages/desktop-app/src/renderer/stores/instance-store.ts)와 instance property service 경로를 SDK data API의 기반으로 삼을 수 있는지 확인한다.

### Phase 1. InstanceEditor 내부 런타임 프로토타입

목표:

- Narre 없이 사람이 작성한 개발용 fixture view를 `InstanceEditor` 안에서 실행한다.
- 핵심 데이터 흐름과 UI 정합성을 확인한다.

작업:

- `InstanceEditor` 안에 view switcher 또는 section entry 추가
- `InteractiveViewPanel` component 추가
- `InteractiveRuntimeHost` component 추가
- public SDK wrapper 초안 추가
- `useField`, `useFields`, `useViewState`, `useUpdateField` 초안 추가
- 사람이 작성한 개발용 fixture view를 정적 import로 연결
- 이 fixture는 제품에 노출되는 preset이 아니라 field/state/action primitive 검증용 코드로만 둔다.

검증:

- instance field 읽기
- view state 저장
- 정답 처리 같은 임의 로직 실행
- Netior UI component 정합성

통과 기준:

- 사용자가 instance tab을 열고 같은 `InstanceEditor` 안에서 인터랙티브 뷰를 볼 수 있다.
- fixture view가 instance property를 읽고 view state를 변경한다.
- fixture view의 로직이 Netior 내부 store나 IPC를 직접 호출하지 않고 SDK wrapper를 통해서만 동작한다.
- 기존 instance 편집 저장 흐름을 깨지 않는다.

검증 방법:

- 수동 테스트: instance를 열고 일반 편집 화면과 인터랙티브 뷰를 오가도 unsaved state와 저장 동작이 깨지지 않는지 확인한다.
- 수동 테스트: fixture view에서 선택한 UI 상태가 view state에 남는지 확인한다.
- 코드 검토: fixture view가 `@renderer/stores/*`, `window.electron`, service module을 직접 import하지 않는지 확인한다.
- 테스트 가능 시 renderer test로 `InteractiveViewPanel`이 field 값을 렌더링하고 state setter를 호출하는지 검증한다.

### Phase 2. ViewState 저장

목표:

- 사용자의 상호작용 상태를 instance property와 분리해서 저장한다.
- 아직 view template source 저장은 하지 않고, 개발용 fixture view의 상태 저장부터 검증한다.

작업:

- `interactive_view_states` migration 추가
- shared types 추가
- core repository 추가
- service endpoint 추가
- IPC channel 추가
- preload bridge 추가
- renderer service/store 추가

주의:

- 이미 적용된 migration은 수정하지 않고 새 migration을 추가한다.
- view state와 instance property를 분리한다.
- view state key는 최소 `instance_id + view_template_id` 조합을 기준으로 한다.
- fixture 단계에서는 `view_template_id`를 테스트 전용 id로 둔다.

통과 기준:

- 같은 instance를 닫았다 다시 열어도 view state가 복원된다.
- instance property에는 `selectedChoice`, `revealed`, `result` 같은 interaction-only 값이 저장되지 않는다.
- 다른 view template의 state와 충돌하지 않는다.
- instance 삭제 시 관련 view state가 정리된다.

검증 방법:

- core repository test로 create/read/update/delete와 cascade 동작을 검증한다.
- service/IPC smoke test 또는 renderer integration test로 저장 왕복을 확인한다.
- 수동 테스트: 앱 재시작 후 view state 복원 확인.

### Phase 3. Interactive SDK 계약과 Narre 생성 실험

목표:

- Narre가 Restricted TSX 형태를 안정적으로 생성할 수 있는지 확인한다.
- 이 단계에서는 Narre 생성 코드를 제품 런타임에 바로 실행하지 않는다.

작업:

- SDK contract 문서화
- 서로 다른 schema/field 구조를 가진 instance 예시 5개 이상 준비
- Narre에게 interactive view source와 manifest 생성 요청
- 생성물을 별도 artifact 또는 draft card로 보여주기
- compile/typecheck 가능성 확인
- field mapping 정확도 확인
- 생성된 interaction logic이 요청 의도와 맞는지 확인
- 수정 요청을 줬을 때 재생성 품질 확인
- Narre prompt에 Interactive SDK contract 추가
- MCP 또는 service surface에 schema/field metadata 제공

Flow:

```text
사용자 요청
  -> Narre가 schema와 instance context 조회
  -> view source와 manifest 생성
  -> draft/preview로 표시
  -> compile/typecheck 실험
  -> 실패 사유를 Narre에게 feedback
```

통과 기준:

- Narre가 SDK contract를 보고 최소 70% 이상의 예제에서 의도에 맞는 field mapping을 생성한다.
- 생성된 source가 import allowlist를 크게 벗어나지 않는다.
- 실패 유형이 분류되어 repair prompt로 되돌릴 수 있다.
- 사람이 읽었을 때 `InstanceEditor` 내부 interactive view로 들어갈 코드인지 판단 가능하다.

검증 방법:

- 동일한 instance 세트에 대해 2회 이상 생성 실험을 하고 실패 유형을 기록한다.
- TypeScript compile/typecheck 또는 최소 AST parse를 시도한다.
- 생성물에서 `window`, `document`, renderer store import, service import 같은 금지 패턴이 나오는지 확인한다.
- field id/name/source_ref 매핑 오류율을 기록한다.

### Phase 4. ViewTemplate 저장과 preview/approval UX

목표:

- 검증을 통과한 view source와 manifest를 재사용 가능한 template으로 저장한다.
- Narre 생성물을 사용자가 preview하고 승인할 수 있게 한다.

작업:

- `interactive_view_templates` migration 추가
- schema 기본 view template 연결 정책 구현
- instance preference는 schema 기본값 상속, 특정 template override, interactive view 비활성화 중 하나로 저장
- Narre card에 interactive view preview type 추가
- manifest diff와 권한 요청 표시
- 승인 시 template 저장
- feedback 시 Narre repair loop로 반환

통과 기준:

- 사용자가 Narre 생성물을 보고 저장 여부를 결정할 수 있다.
- 저장된 template이 `InstanceEditor` 내부 인터랙티브 뷰 목록에 나타난다.
- template은 기본적으로 target schema 범위에 연결된다.
- instance는 schema template을 자동 상속하고, 필요한 경우에만 instance 수준에서 override 또는 비활성화할 수 있다.
- 권한 manifest가 source와 함께 저장된다.

검증 방법:

- Narre card 렌더링 테스트로 preview/confirm/feedback 응답을 확인한다.
- repository/service/IPC test로 template CRUD를 확인한다.
- 수동 테스트: 생성 -> preview -> 승인 -> instance에서 선택 가능 여부 확인.

### Phase 5. Validator and Trust Policy

목표:

- host 실행 후보와 sandbox 실행 대상을 구분한다.

작업:

- AST import allowlist
- forbidden global check
- manifest permission check
- TypeScript compile/typecheck
- preview smoke test
- runtime error telemetry
- trust level 저장

정책:

- Narre-generated view는 sandbox 기본값
- built-in view는 host 가능
- validation + preview + user approval 통과 시 host 후보
- runtime error 발생 시 sandbox downgrade 또는 disable

통과 기준:

- 금지 import/API가 있는 source는 host 실행 후보가 되지 않는다.
- manifest에 없는 field write 시도는 차단된다.
- preview smoke test 실패 시 저장 또는 host 승인이 막힌다.
- built-in/manual template과 Narre-generated template의 trust level이 구분된다.

검증 방법:

- validator unit test에 허용/차단 fixture를 둔다.
- 금지 패턴 fixture: `window`, `document`, `localStorage`, `eval`, dynamic import, renderer store import.
- permission fixture: 허용 field read/write와 미허용 field write를 비교한다.
- runtime ErrorBoundary 테스트로 실패 template disable/downgrade 동작을 확인한다.

### Phase 6. Sandbox Runtime

목표:

- generated 또는 untrusted view를 격리 실행한다.

작업:

- iframe 또는 isolated webContents 검토
- sandbox SDK bridge 구현
- postMessage/RPC protocol 정의
- theme token, font, component CSS 동기화
- sandbox reload/disable UX

초기 선택:

- 구현 단순성과 웹 표준성을 우선하면 iframe
- Electron-level 격리를 더 강하게 원하면 isolated webContents

통과 기준:

- Narre-generated view는 기본적으로 sandbox runtime에서 실행된다.
- sandbox 내부 코드는 `window.electron`, renderer store, app DOM에 접근하지 못한다.
- SDK bridge를 통해 허용된 field/state action만 호출할 수 있다.
- sandbox가 렌더 에러나 무한 업데이트에 빠져도 `InstanceEditor` 전체가 치명적으로 멈추지 않는다.

검증 방법:

- sandbox fixture에서 금지 global 접근 시도가 실패하는지 확인한다.
- bridge test로 허용 action과 미허용 action을 구분한다.
- 수동 테스트: sandbox reload/disable UX 확인.
- 가능하면 Playwright 또는 renderer integration test로 theme/token 동기화와 기본 interaction을 확인한다.

### Phase 7. Polish and Expansion

목표:

- 실제 사용 가능한 생성/수정/재사용 workflow로 다듬는다.

작업:

- view template list
- schema에 기본 view 연결
- instance별 상속/override/비활성화 선택
- view source edit/preview
- Narre repair prompt
- 권한 변경 diff
- view state reset/export

통과 기준:

- schema별 기본 인터랙티브 뷰를 설정할 수 있다.
- instance는 schema 기본 인터랙티브 뷰를 자동 상속한다.
- instance별로 다른 view template을 override하거나 인터랙티브 뷰를 끌 수 있다.
- view state를 reset할 수 있다.
- Narre에게 "이 뷰를 수정해줘"라고 요청했을 때 기존 template을 바탕으로 repair loop가 돈다.

검증 방법:

- 사용 흐름 테스트: template 선택, default 설정, state reset, Narre 수정 요청.
- regression test: 기존 InstanceEditor 편집, property 저장, content 저장, agent view가 계속 정상 동작하는지 확인.

## 12. 첫 MVP 범위

MVP는 기능의 철학을 검증하는 데 집중한다.

포함:

- `InstanceEditor` 내부 `InteractiveViewPanel`
- 사람이 작성한 Restricted TSX style view 1개
- field 읽기
- view state 저장
- 기존 UI component wrapper 일부
- host renderer prototype
- Narre 생성 실험 문서화

제외:

- 완전한 sandbox runtime
- arbitrary npm import
- network/file write 권한
- marketplace/package 배포
- 복잡한 trust score UI
- full custom HTML editor

MVP의 성공 기준:

- 하나의 instance를 같은 `InstanceEditor` 안에서 property panel이 아니라 interactive view로 볼 수 있다.
- view 내부 로직이 SDK를 통해 field와 state를 사용한다.
- Netior UI처럼 보인다.
- 같은 SDK contract를 Narre에게 줬을 때 쓸 만한 view source가 생성된다.

## 13. 열어둔 결정 사항

- view template을 DB에 저장할지 project artifact 파일로 저장할지
- sandbox runtime의 1차 구현을 iframe으로 할지 isolated webContents로 할지
- host runtime 허용을 어느 release부터 열지
- SDK에서 Markdown/content rendering을 어디까지 허용할지
- Narre가 만든 view source를 사용자가 직접 수정할 수 있게 할지
- view template을 schema, model, instance 중 어디에 기본 연결할지
- `InstanceEditor` 안에서 기본 편집 화면과 인터랙티브 뷰를 어떤 UI로 전환할지

## 14. 결론

인터랙티브 뷰의 중심은 preset 시나리오가 아니라 `Interactive SDK`다.

Netior는 다음을 제공한다.

- 데이터와 상태 API
- UI primitive
- 권한 manifest
- preview와 validator
- host runtime과 sandbox runtime

Narre는 다음을 만든다.

- instance에 맞는 화면 구성
- field와 content의 연결
- 상호작용 로직
- state 전환
- 사용자 경험의 구체 형태

따라서 권장 방향은 다음과 같다.

```text
기본 authoring:
  Restricted TSX + Interactive SDK

초기 구현:
  InstanceEditor 내부 Host renderer prototype

제품 기본 실행:
  Narre-generated view는 sandbox first

신뢰된 실행:
  validation + preview + user approval 통과 시 host runtime 후보
```
