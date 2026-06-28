```yaml
date: 2026-06-26
package: desktop-app
related_area: primitive-ui
scope:
  - form-controls
  - overlays
  - pickers
  - editor-foundation
related_files:
  - packages/desktop-app/src/renderer/components/ui
  - packages/desktop-app/src/renderer/components/forms
related_docs:
  - docs/03-ui/NETIOR_UI_LAYOUT.md
commit_ids: []
```

# Primitive UI Components

## Goal

Domain editor와 View 구현에 필요한 공통 UI primitive를 먼저 만든다.

결과물을 한 문장으로 요약하면:

```text
Model, Kind, RelationKind, Instance editor를 만들 때 새 입력 컴포넌트가 없어서 멈추지 않는다.
```

## Background

Domain model editor는 form surface다. 따라서 primitive form/control이 domain editor보다 먼저 필요하다.

이미 합의된 원칙:

- layout 논의와 color token 논의는 분리한다.
- 구현에서는 semantic token을 사용한다.
- editor는 설명판이 아니라 실제 form이어야 한다.
- icon은 Lucide 또는 image resource를 지원해야 한다.

아직 결정되지 않은 것:

- UI component library를 기존 코드에서 얼마나 재사용할지
- form validation library를 도입할지 자체 구현할지

## Scope

이번 범위에 포함되는 것:

- `Button`
- `IconButton`
- `Input`
- `TextArea`
- `NumberInput`
- `Select`
- `Checkbox`
- `Toggle`
- `RadioGroup`
- `SegmentedControl`
- `Tabs`
- `Modal`
- `ConfirmDialog`
- `Toast`
- `Tooltip`
- `Badge`
- `Divider`
- `ScrollArea`
- `FormField`
- `FieldLabel`
- `EmptyState`
- `ContextMenu`
- `DropdownMenu`
- Netior pickers: `IconPicker`, `ModelPicker`, `KindPicker`, `RelationKindPicker`, `ResourcePicker`

이번 범위에서 제외하는 것:

- domain editor business logic
- service API 연결
- complex table/grid
- canvas node renderer

범위가 넓어질 때 다시 확인할 조건:

- picker가 service data를 직접 요구하는 경우
- accessibility 요구사항으로 component API가 커지는 경우

## Plan

### Step 1. Base Controls

- 작업: 기본 input/button/select/checkbox류를 만든다.
- 완료 조건: form editor가 사용할 수 있는 controlled API를 제공한다.
- 검증: Story/smoke page 또는 component test.

### Step 2. Overlay and Feedback

- 작업: modal, confirm, toast, tooltip, context menu를 만든다.
- 완료 조건: editor save/delete/validation flow에 필요한 overlay가 준비된다.
- 검증: keyboard focus와 close 동작 확인.

### Step 3. Netior Pickers

- 작업: icon/model/kind/relation/resource picker skeleton을 만든다.
- 완료 조건: 실제 service data가 없어도 options를 받아 표시할 수 있다.
- 검증: mock options로 선택/검색/empty state 확인.

## Dependencies

선행되어야 하는 문서, 결정, 코드, 도구:

- `02-app-shell.md`
- theme token skeleton

외부 의존성 또는 capability:

- Lucide icon package

## Risks

위험:

- primitive가 domain knowledge를 품으면 재사용성이 떨어진다.
- picker가 service API에 강결합되면 editor 테스트가 어려워진다.

완화 방법:

- primitive는 props 기반으로 만들고 service fetch는 상위 container에 둔다.
- Netior picker도 options/loader boundary를 분리한다.

## Validation

무엇을 확인해야 하는가?

- form control이 keyboard로 사용 가능한가
- 긴 텍스트와 작은 panel에서 overflow가 없는가
- light/dark token이 깨지지 않는가

테스트 또는 수동 확인:

- component smoke
- form mock screen
- keyboard navigation

## Open Questions

- [ ] form state library를 쓸지
- [ ] component visual test를 언제 도입할지

## Follow-up

- [ ] DB/migration foundation을 구축한다.
