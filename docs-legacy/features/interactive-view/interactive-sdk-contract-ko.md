# Interactive View SDK Contract

이 문서는 Narre가 인터랙티브 뷰 source를 생성할 때 따라야 하는 최소 계약이다.

## Authoring Model

- View는 Restricted TSX로 작성한다.
- 화면과 interaction logic은 TSX source에 둔다.
- Manifest는 rendering spec이 아니라 target, permission, runtime metadata만 담는다.
- Netior가 미리 정한 scenario나 preset을 선택하는 구조가 아니다.

## Allowed Imports

```ts
import {
  Badge,
  Button,
  Checkbox,
  Chip,
  Divider,
  Field,
  FieldEditor,
  IconButton,
  Inline,
  Panel,
  Select,
  Stack,
  TextArea,
  TextInput,
  Toggle,
  ViewRoot,
  useContent,
  useCurrentInstance,
  useDslObject,
  useDslObjects,
  useDslValue,
  useField,
  useFieldValue,
  useFields,
  useOpenInstance,
  useOpenObject,
  useUpdateField,
  useViewState,
} from '@netior/interactive-sdk'
```

`react` import는 허용할 수 있지만, renderer store, service, IPC, filesystem, network package import는 금지한다.

허용된 SDK export 목록은 validator가 직접 검사한다. Narre는 위 목록에 없는 이름을 import하면 안 된다.

UI는 가능한 한 SDK primitive를 사용한다.

- 최상위 컨테이너: `ViewRoot`
- compact icon action: `IconButton`
- tag/list 값: `Chip`
- 입력 control: `Select`, `Checkbox`, `Toggle`, `TextInput`, `TextArea`
- 기본 layout: `Stack`, `Inline`, `Panel`, `Divider`
- 상태/분류 label: `Badge`

## Data Access

- Field 값 읽기: `useField(fieldKey)`, `useFields()`, `Field`
- Field 값만 읽기: `useFieldValue(fieldKey)`
- Body content 읽기: `useContent()`
- 현재 instance context 읽기: `useCurrentInstance()`
- Instance field 수정: `useUpdateField()`
- Interaction state 저장: `useViewState(key, initialValue)`
- Netior DSL 실행: `useDslValue(expression)`, `useDslObject(expression)`, `useDslObjects(expression)`

`fieldKey`는 field `id`, 안정적인 `source_ref`, 또는 field name을 사용할 수 있다. 가능한 경우 field `id`나 `source_ref`를 우선한다.

## Host Action API

Interactive View는 앱의 탭, 에디터, 선택 상태를 직접 만지지 않는다. 앱 동작이 필요한 경우 SDK가 제공하는 host action을 사용한다.

- `useOpenObject()`는 `(objectType, refId, title?) => void` 함수를 반환한다.
- 현재 지원하는 `objectType`은 `instance`다.
- `openObject('instance', refId, title)`는 새 독립 탭을 여는 동작이 아니라, 가능하면 현재 object editor 탭을 해당 instance로 교체한다.
- 이때 object editor의 view mode는 `interactive`로 유지된다.
- `useOpenInstance()`는 `useOpenObject()`의 instance 전용 wrapper다.

따라서 다음/이전 문제 이동 같은 interaction은 renderer store를 import하지 않고 host action으로 작성한다.

```tsx
import { Button, useOpenObject } from '@netior/interactive-sdk'

export function View() {
  const openObject = useOpenObject()
  return (
    <Button onClick={() => openObject('instance', 'next-instance-id', 'Next question')}>
      Next
    </Button>
  )
}
```

## State Rule

- 사용자의 진행 상태, 선택 상태, 펼침/접힘, 임시 결과는 view state에 저장한다.
- instance 자체의 의미 있는 데이터가 바뀔 때만 field update를 사용한다.
- view state 변경은 editor dirty 상태를 만들지 않는다.
- field update는 기존 `InstanceEditor` 저장 흐름에 들어간다.

## Manifest Example

```json
{
  "kind": "interactive-view",
  "sdkVersion": 1,
  "target": {
    "kind": "schema",
    "id": "schema-id"
  },
  "permissions": {
    "readFields": ["field-id-a"],
    "writeFields": ["field-id-a"],
    "viewState": true,
    "dsl": false
  },
  "runtime": "sandbox"
}
```

Legacy manifest shape은 사용하지 않는다.

- `target.schemaId`
- `target.instanceId`
- `permissions.fields.read`
- `permissions.fields.write`

위 값이 필요한 경우 현재 shape인 `target.kind/id`, `permissions.readFields/writeFields`로 변환한다.

## Validation Rule

Source는 저장 전에 최소한 다음 검사를 통과해야 한다.

- import allowlist 검사
- `window`, `document`, `localStorage`, `indexedDB`, `eval`, `Function`, dynamic import 차단
- manifest JSON 구조 검사
- manifest에 없는 field write 차단
- SDK export allowlist 검사
- DSL hook을 쓰면서 `permissions.dsl`이 `true`가 아니면 차단
- DSL operator allowlist 검사
- Narre-generated source는 기본 runtime을 `sandbox`로 둔다.

현재 Interactive View source에서 사용할 수 있는 Netior DSL operator는 다음으로 제한한다.

- `literal`
- `context.object`
- `context.schema`
- `item`
- `instances`
- `field.value`
- `field.object`
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

다음과 같은 invented operator 또는 아직 없는 projection 문법은 사용하지 않는다.

- `objects`
- `eq`
- `field`
- `id`
- `title`
- `select`
- `orderBy` array

## Narre Authoring Workflow

Narre가 Interactive View를 생성하거나 수정할 때는 다음 순서를 따른다.

1. 현재 instance, schema, field id를 확인한다.
2. source code와 manifest JSON을 작성한다.
3. `dry_run_interactive_view_template` MCP tool로 저장 전 검증을 수행한다.
4. dry-run이 실패하면 source/manifest를 수정하고 다시 dry-run한다.
5. dry-run이 통과한 뒤에만 `create_interactive_view_template` 또는 `update_interactive_view_template`로 저장한다.
6. schema 기본 view로 쓰는 경우 schema preference를 설정한다.

사용자에게 Netior DSL JSON AST, manifest 내부 구조, conditional config 같은 내부 표현을 직접 요구하지 않는다. 사용자의 책임은 도메인 요구를 설명하는 것까지이고, SDK/DSL/manifest 변환은 Narre의 책임이다.

## Editor UX Contract

- Object editor tab은 `objectViewMode`를 가질 수 있다.
- Interactive View 내부 navigation이 `openObject('instance', ...)`를 호출하면 현재 tab을 새 instance로 교체하고 `objectViewMode: 'interactive'`를 유지한다.
- Interactive View mode에서는 section expand/collapse header를 표시하지 않는다. 사용자는 이미 Interactive View mode를 선택한 상태이므로 실제 view content를 바로 본다.
