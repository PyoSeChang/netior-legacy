# File Coverage Index

## Metrics

- Target files: 596
- Audited files: 288
- Excluded files: 0
- Blocked files: 0
- Coverage: 48.3%

## Classification Rules

| Classification | Meaning |
|---|---|
| `audited` | Inspected and mapped to feature IDs or supporting behavior |
| `excluded` | Out of scope with reason |
| `blocked` | Cannot inspect fully now; reason and next action required |

## Records

Initial target counts by package:

| Package | Target files | Audited | Excluded | Blocked |
|---|---:|---:|---:|---:|
| `packages/shared` | 21 | 21 | 0 | 0 |
| `packages/netior-core` | 94 | 89 | 0 | 0 |
| `packages/netior-service` | 4 | 1 | 0 | 0 |
| `packages/netior-mcp` | 30 | 30 | 0 | 0 |
| `packages/narre-server` | 50 | 50 | 0 | 0 |
| `packages/desktop-app` | 366 | 66 | 0 | 0 |
| `packages/narre-eval` | 31 | 31 | 0 | 0 |

Scan command:

```powershell
rg --files packages -g "*.ts" -g "*.tsx" -g "*.js" -g "*.jsx" -g "*.json" -g "!**/dist/**" -g "!**/out/**" -g "!**/node_modules/**"
```

## Audited File Groups

| File group | Feature IDs | Status |
|---|---|---|
| `packages/shared/src/index.ts` | SH-0001 | audited |
| `packages/shared/src/constants/index.ts` | SH-0002, SH-0003, SH-0004, SH-0005 | audited |
| `packages/shared/src/constants/netior-mcp-tools.ts` | SH-0006 | audited |
| `packages/shared/src/i18n/**` | SH-0007 | audited |
| `packages/shared/src/display.ts` | SH-0008 | audited |
| `packages/shared/src/dsl/index.ts` | SH-0009 | audited |
| `packages/shared/src/interactive-view/index.ts` | SH-0010 | audited |
| `packages/shared/src/semantic-editor.ts` | SH-0011 | audited |
| `packages/shared/src/types/index.ts` | SH-0012 | audited |
| `packages/shared/src/__tests__/*.test.ts` | SH-0002 through SH-0011 | audited |
| `packages/shared/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` | ROOT- pending | audited |
| `packages/netior-core/src/connection.ts`, `src/index.ts` | CORE-0001 | audited |
| `packages/netior-core/src/repositories/*.ts` | CORE-0003 through CORE-0015 | audited at public-surface level |
| `packages/netior-core/src/services/*.ts` | CORE-0016, CORE-0017 | audited |
| `packages/netior-core/src/__tests__/*.test.ts`, `test-db.ts` | CORE-0001 through CORE-0017 | audited |
| `packages/netior-core/src/migrations/*.ts` | CORE-0002 plus linked domain features | classified by migration domain group |
| `packages/netior-service/src/index.ts` | SVC-0001 through SVC-0005 | audited |
| `packages/netior-mcp/src/index.ts`, `package.json` | MCP-0001 | audited |
| `packages/netior-mcp/src/tools/index.ts`, `shared-tool-registry.ts` | MCP-0002 | audited |
| `packages/netior-mcp/src/netior-service-client.ts` | MCP-0003 | audited |
| `packages/netior-mcp/src/tools/*schema*`, `model-*`, `candidate-source-tools.ts` | MCP-0004 | audited |
| `packages/netior-mcp/src/tools/instance-*`, `object-tools.ts`, `network-*`, `edge-tools.ts`, `relationship-tools.ts` | MCP-0005, MCP-0006 | audited |
| `packages/netior-mcp/src/tools/dsl-tools.ts`, `interactive-view-tools.ts` | MCP-0007 | audited |
| `packages/netior-mcp/src/tools/filesystem-tools.ts`, `pdf-tools.ts`, `path-validation.ts` | MCP-0008 | audited |
| `packages/netior-mcp/src/tools/project-tools.ts` | MCP-0009 | audited |
| `packages/netior-mcp/src/events.ts` | MCP-0010 | audited |
| `packages/narre-server/src/index.ts`, `logging.ts`, `package.json` | NARRE-0001 | audited |
| `packages/narre-server/src/session-store.ts` | NARRE-0002 | audited |
| `packages/narre-server/src/streaming.ts`, `runtime/narre-runtime.ts` | NARRE-0003, NARRE-0004 | audited |
| `packages/narre-server/src/providers/**`, `runtime/provider-adapter.ts` | NARRE-0005 | audited at provider-layer level |
| `packages/narre-server/src/ui-tools.ts`, `tools/pending-ui-responses.ts`, `providers/shared/**` | NARRE-0006 | audited |
| `packages/narre-server/src/supervisor/supervisor-registry.ts`, `agent-registry.ts` | NARRE-0007 | audited |
| `packages/narre-server/src/supervisor/orchestration-registry.ts`, `agent-operator.ts`, `agent-runtime-dispatcher.ts` | NARRE-0008 | audited at control-plane level |
| `packages/narre-server/src/supervisor/executor-registry.ts` | NARRE-0009 | audited |
| `packages/narre-server/src/netior-service-client.ts`, `project-prompt-metadata.ts` | NARRE-0010 | audited |
| `packages/desktop-app/src/main/index.ts`, `runtime/**`, `logging.ts`, `system-fonts.ts` | DESK-0001 | audited at shell level |
| `packages/desktop-app/src/main/process/*.ts` | DESK-0002 | mapped |
| `packages/desktop-app/src/preload/index.ts` | DESK-0003 | audited |
| `packages/desktop-app/src/main/ipc/*.ts`, `main/netior-service/netior-service-client.ts` | DESK-0004 | mapped at IPC group level |
| `packages/desktop-app/src/renderer/App.tsx`, global hooks/settings/shortcut/toast shell files | DESK-0005 | mapped |
| `packages/desktop-app/src/renderer/services/*.ts` | DESK-0006 | mapped at service layer |
| `packages/desktop-app/src/renderer/stores/*.ts` | DESK-0007 | mapped at store layer |
| `packages/desktop-app/src/renderer/components/workspace/**`, `components/editor/**`, editor/open libs | DESK-0008 | mapped at shell/router level |
| `packages/narre-eval/src/cli.ts`, `src/run-spec.ts`, `src/execution.ts`, `package.json` | EVAL-0001 | audited at CLI surface level |
| `packages/narre-eval/src/types.ts`, `src/loader.ts`, `scenarios/*/seed.ts` | EVAL-0002 | audited at scenario surface level |
| `packages/narre-eval/src/harness.ts`, `src/netior-service-process.ts`, `src/netior-service-client.ts`, `src/dev-runtime.ts` | EVAL-0003 | audited |
| `packages/narre-eval/src/agents/**`, `src/runner/session-runner.ts`, `src/tester-runtime.ts` | EVAL-0004 | mapped |
| `packages/narre-eval/src/grader.ts`, `src/analyzer.ts`, `src/comparator.ts`, `src/report.ts`, `src/codex-exec.ts` | EVAL-0005 | mapped |
| `packages/narre-eval/src/tui.ts` | EVAL-0006 | mapped at TUI surface level |
| `packages/narre-eval/src/runner/orchestration-runner.ts`, `src/orchestration-control-plane-e2e.ts` | EVAL-0007 | mapped |
