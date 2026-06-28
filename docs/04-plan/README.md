# Plan

Plan 문서는 Netior의 당장 실행할 작업 단위, 마이그레이션 범위, 의존성, 검증 기준을 정리하는 실행 중심 문서다.

Development log가 "왜 이런 생각과 결정을 했는가"를 남긴다면, plan은 "무엇을 어떤 순서로 구현하고, 어디까지를 이번 범위로 볼 것인가"를 남긴다.

Roadmap은 plan에 두지 않는다. Roadmap은 큰 방향과 미래 제품 사고를 다루므로 `00-product/roadmap`에 둔다.

## File Naming

파일명은 시간순 번호와 짧은 제목을 사용한다.

```text
00-title.md
01-title.md
02-title.md
```

제목은 영어 kebab-case를 권장한다.

```text
00-domain-definition-migration.md
01-view-and-editor-shell.md
02-service-contract.md
```

기존 draft 문서는 현재 맥락 보존용으로 둔다. 새 계획 문서는 위 번호 체계를 따른다.

## Metadata

각 계획 문서는 문서 상단에 fenced `yaml` metadata를 둔다.

```yaml
date: 2026-06-26
package: netior-service
related_area: domain-operations
scope:
  - world-definition
  - resource-mapping
related_files:
  - packages/netior-service/src
related_docs:
  - docs/02-domain/NETIOR_DEFINITION_MODEL.md
commit_ids:
  - abc1234
```

`commit_ids`는 구현 전이면 비워둔다.

## Template

새 계획 문서는 [template.md](template.md)를 복사해서 작성한다.

## MVP Plan Sequence

현재 MVP 목표는 세상 정의, 최소 동작, Explorer/Canvas View 완성이다. MCP와 Narre server는 이 시퀀스에서 제외한다.

- [00-repo-package-boilerplate.md](00-repo-package-boilerplate.md)
- [01-runtime-skeleton.md](01-runtime-skeleton.md)
- [02-app-shell.md](02-app-shell.md)
- [03-primitive-ui-components.md](03-primitive-ui-components.md)
- [04-db-migration-foundation.md](04-db-migration-foundation.md)
- [05-domain-schema-migrations.md](05-domain-schema-migrations.md)
- [06-service-domain-operations.md](06-service-domain-operations.md)
- [07-domain-model-editors.md](07-domain-model-editors.md)
- [08-legacy-migration-compatibility.md](08-legacy-migration-compatibility.md)
- [09-resource-minimal-operation.md](09-resource-minimal-operation.md)
- [10-explorer-view.md](10-explorer-view.md)
- [11-canvas-view.md](11-canvas-view.md)
- [12-mvp-hardening.md](12-mvp-hardening.md)

## Writing Rule

좋은 plan은 다음 질문에 답해야 한다.

- 이 계획의 목표는 무엇인가?
- 이번 범위에 포함되는 것과 제외되는 것은 무엇인가?
- 어떤 순서로 진행할 것인가?
- 각 단계의 완료 조건은 무엇인가?
- 선행 의존성과 위험은 무엇인가?
- 무엇을 검증해야 다음 단계로 넘어갈 수 있는가?
- 아직 결정되지 않은 질문은 무엇인가?

사용자의 교정이나 Codex의 추론을 계획의 확정 범위로 섞지 않는다. 확정되지 않은 내용은 `미결정` 또는 `검토 필요`로 남긴다.
