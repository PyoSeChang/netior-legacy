# Netior Feature Inventory

## Audit Snapshot

- Started: 2026-05-22
- Scope status: seeded
- File coverage: 288 / 596 target code/config files classified
- Entry point coverage: seeded, not mapped
- Unknown test status count: not measured
- Unmapped index count: seeded, not mapped

## Package Summary

| Package | Status | Feature count | File coverage | Notes |
|---|---:|---:|---:|---|
| `packages/shared` | verified | 12 | 21 / 21 | Shared types, constants, i18n, display rules |
| `packages/netior-core` | scanning | 17 | 89 / 94 | DB connection, repositories, services, tests, and migrations classified; table-level extraction pending |
| `packages/netior-service` | scanning | 5 | 1 / 4 | HTTP service and native DB owner; route tests not found |
| `packages/netior-mcp` | scanning | 10 | 30 / 30 | MCP tools through netior-service; direct tests not found |
| `packages/narre-server` | scanning | 10 | 50 / 50 | Narre Express, SSE, providers; branch-level provider/supervisor audit pending |
| `packages/desktop-app` | scanning | 16 | 66 / 366 | Electron main/preload/renderer layer surfaces mapped; core renderer workflows split into feature records; UI branch details pending |
| `packages/narre-eval` | scanning | 7 | 31 / 31 | Internal Narre evaluation harness; package surface mapped, branch details pending |

## Initial Scan Findings

- Target scan found 596 code/config files under `packages`, excluding `dist`, `out`, and `node_modules`.
- `desktop-app` is the largest package by file count and has the broadest entry-point surface.
- Initial IPC scan found 165 `ipcMain.handle` / `ipcMain.on` registrations in `packages/desktop-app/src/main`.
- Initial service scan found 35 unique netior-service route path conditions and 38 Narre Express endpoints.
- Initial MCP scan found 87 shared MCP tool specs in `NETIOR_MCP_TOOL_SPECS`.
- Initial core scan found 19 repository files and 61 migration files.

## Verified Feature Count

- `SH`: 12
- `CORE`: 17
- `SVC`: 5
- `MCP`: 10
- `NARRE`: 10
- `DESK`: 16
- `EVAL`: 7

## Feature Records

Feature records will be added after file and entry point indexes are seeded.

### Template

```md
### FEATURE-ID Feature name

- Status:
- Risk:
- Test status:
- Package:
- Locations:
- Type:
- User/caller behavior:
- System behavior:
- Entry points:
- Inputs:
- Outputs:
- State changes:
- Persistence:
- Dependencies:
- Failure cases:
- Error handling:
- Async/loading behavior:
- i18n/display relevance:
- Linked indexes:
- Notes:
```
