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
  Button,
  Field,
  FieldEditor,
  Inline,
  Panel,
  Stack,
  useContent,
  useField,
  useFields,
  useUpdateField,
  useViewState,
} from '@netior/interactive-sdk'
```

`react` import는 허용할 수 있지만, renderer store, service, IPC, filesystem, network package import는 금지한다.

## Data Access

- Field 값 읽기: `useField(fieldKey)`, `useFields()`, `Field`
- Body content 읽기: `useContent()`
- Instance field 수정: `useUpdateField()`
- Interaction state 저장: `useViewState(key, initialValue)`

`fieldKey`는 field `id`, 안정적인 `source_ref`, 또는 field name을 사용할 수 있다. 가능한 경우 field `id`나 `source_ref`를 우선한다.

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
    "schemaId": "schema-id"
  },
  "permissions": {
    "readFields": ["field-id-a"],
    "writeFields": ["field-id-a"],
    "viewState": true
  },
  "runtime": "sandbox"
}
```

## Validation Rule

Source는 저장 전에 최소한 다음 검사를 통과해야 한다.

- import allowlist 검사
- `window`, `document`, `localStorage`, `indexedDB`, `eval`, `Function`, dynamic import 차단
- manifest JSON 구조 검사
- manifest에 없는 field write 차단
- Narre-generated source는 기본 runtime을 `sandbox`로 둔다.
