# Development Log

Development log는 Codex와 함께 빠르게 설계하거나 구현할 때, 설계 의도와 판단 근거가 누락되지 않도록 남기는 사고 중심 기록이다.

목적은 단순히 "무엇을 바꿨는가"를 기록하는 것이 아니다. 어떤 문제가 있었고, 왜 그 문제가 중요했으며, 어떤 선택지를 검토했고, 어떤 근거로 현재 결정을 했는지 남긴다.

## File Naming

파일명은 시간순 번호와 짧은 제목을 사용한다.

```text
00-title.md
01-title.md
02-title.md
```

제목은 영어 kebab-case를 권장한다.

```text
00-titlebar-app-chrome.md
01-view-model-scope.md
02-instance-resource-separation.md
```

## Metadata

각 로그는 문서 상단에 fenced `yaml` metadata를 둔다.

```yaml
date: 2026-06-26
package: desktop-app
related_area: ui-layout
related_files:
  - packages/desktop-app/src/renderer/components/workspace/WorkspaceShell.tsx
related_docs:
  - docs/03-ui/NETIOR_UI_LAYOUT.md
commit_ids:
  - abc1234
```

`commit_ids`는 구현 전이면 비워둔다.

## Template

새 로그는 [template.md](template.md)를 복사해서 작성한다.

## Writing Rule

좋은 development log는 다음 질문에 답해야 한다.

- 어떤 문제가 있었는가?
- 왜 그 문제가 중요했는가?
- 어떤 결정을 했는가?
- 왜 그 결정을 했는가?
- 어떤 대안을 버렸는가?
- 구현할 때 무엇을 조심해야 하는가?
- 어떻게 검증할 것인가?

짧아도 된다. 대신 결정의 이유가 남아야 한다.
