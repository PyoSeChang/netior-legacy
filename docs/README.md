# Netior Documentation

이 문서는 Netior 설계 문서의 폴더 체계와 읽기 순서를 정리한다.

## 읽기 순서

1. [Product](00-product/README.md)
2. [Architecture](01-architecture/NETIOR_ARCHITECTURE_DRAFT.md)
3. [Definition Model](02-domain/NETIOR_DEFINITION_MODEL.md)
4. [Domain Operations](02-domain/NETIOR_DOMAIN_OPERATIONS.md)
5. [View Model](02-domain/view/NETIOR_VIEW_MODEL.md)
6. [Interactive View Capability](02-domain/capability/interactive-view.md)
7. [UI Layout](03-ui/NETIOR_UI_LAYOUT.md)
8. [Plan](04-plan/README.md)
9. [Development Log](05-development-log/README.md)
10. [Test](06-test/README.md)

## 폴더 체계

### `00-product`

Netior가 어떤 제품인지, 무엇을 해결하려는지, 어떤 방향으로 성장해야 하는지 정리한다.

- [README.md](00-product/README.md)
- [NETIOR_PHILOSOPHY.md](00-product/NETIOR_PHILOSOPHY.md)
- [NETIOR_PHILOSOPHY_V2.md](00-product/NETIOR_PHILOSOPHY_V2.md)
- [NETIOR_ROADMAP_DRAFT.md](00-product/roadmap/NETIOR_ROADMAP_DRAFT.md)
- [Interactive SDK Roadmap](00-product/roadmap/interactiveSDK-roadmap.md)

### `01-architecture`

Electron, netior-service, MCP, desktop renderer, interactive view runtime, transport boundary를 정리한다.

- [NETIOR_ARCHITECTURE_DRAFT.md](01-architecture/NETIOR_ARCHITECTURE_DRAFT.md)

### `02-domain`

World, Model, Kind, RelationKind, Instance, Resource, Assignment, Evidence 같은 Netior의 핵심 언어를 정리한다.

- [NETIOR_DEFINITION_MODEL.md](02-domain/NETIOR_DEFINITION_MODEL.md)
- [NETIOR_DOMAIN_OPERATIONS.md](02-domain/NETIOR_DOMAIN_OPERATIONS.md)
- [NETIOR_DOMAIN_MODEL_DRAFT.md](02-domain/NETIOR_DOMAIN_MODEL_DRAFT.md)

`NETIOR_DEFINITION_MODEL.md`를 현재 기준 문서로 보고, `NETIOR_DOMAIN_MODEL_DRAFT.md`는 이전 논의 맥락이 필요한 경우 참고한다.

#### `02-domain/view`

View는 Netior 도메인의 일부다. Explorer와 Canvas가 무엇을 보여주고, View가 subject를 어떻게 참조하고 저장하는지 정리한다.

- [NETIOR_VIEW_MODEL.md](02-domain/view/NETIOR_VIEW_MODEL.md)
- [Explorer View Mockup](02-domain/view/mockups/NETIOR_EXPLORER_VIEW_MOCKUP.html)

#### `02-domain/capability`

Capability는 Netior core 밖의 실행 능력이 World와 어떻게 연결되는지 정리한다.

- [Interactive View Capability](02-domain/capability/interactive-view.md)

### `03-ui`

Home/Workspace 화면 구조, titlebar/app chrome, sidebar, view remote, editor tab strip, form editor 방향을 정리한다.

- [NETIOR_UI_LAYOUT.md](03-ui/NETIOR_UI_LAYOUT.md)
- [Editor Forms Mockup](03-ui/mockups/NETIOR_EDITOR_FORMS_MOCKUP.html)
- [Workspace Layout Mockup V2](03-ui/mockups/NETIOR_LAYOUT_WORKSPACE_MOCKUP_V2.html)
- [Color Token Reference](03-ui/reference/color-token-values.md)

`03-ui/mockups/archive`에는 세션 중 만들어졌지만 현재 기준에서 선호하지 않는 실험 목업을 보관한다.

- [Archived Workspace Layout Mockup](03-ui/mockups/archive/NETIOR_LAYOUT_WORKSPACE_MOCKUP.html)
- [Archived Editor Action Flow Mockup](03-ui/mockups/archive/NETIOR_EDITOR_ACTION_FLOW_MOCKUP.html)

### `04-plan`

당장 실행할 작업 단위, 마이그레이션 범위, 완료 조건, 검증 기준을 정리한다.

- [README.md](04-plan/README.md)
- [template.md](04-plan/template.md)
- [NETIOR_RENDERER_MIGRATION_PLAN.md](04-plan/NETIOR_RENDERER_MIGRATION_PLAN.md)

### `05-development-log`

설계 변경, 구현 중 결정, 마이그레이션 기록을 시간순으로 남길 공간이다.

Codex로 빠르게 구현할 때 설계 의도와 판단 근거가 누락되지 않도록, 단순 변경 사항보다 문제, 맥락, 결정, 근거, 대안, 검증을 중심으로 남긴다.

- [README.md](05-development-log/README.md)
- [template.md](05-development-log/template.md)

### `06-test`

테스트 전략, 검증 시나리오, QA checklist를 정리할 공간이다.

- [README.md](06-test/README.md)

## 현재 기준 문서

현재 설계 판단의 기준은 다음 문서다.

- `00-product/NETIOR_PHILOSOPHY.md`
- `00-product/NETIOR_PHILOSOPHY_V2.md`
- `01-architecture/NETIOR_ARCHITECTURE_DRAFT.md`
- `02-domain/NETIOR_DEFINITION_MODEL.md`
- `02-domain/NETIOR_DOMAIN_OPERATIONS.md`
- `02-domain/capability/interactive-view.md`
- `02-domain/view/NETIOR_VIEW_MODEL.md`
- `03-ui/NETIOR_UI_LAYOUT.md`

목업 기준은 다음 두 파일이다.

- `03-ui/mockups/NETIOR_EDITOR_FORMS_MOCKUP.html`
- `03-ui/mockups/NETIOR_LAYOUT_WORKSPACE_MOCKUP_V2.html`
