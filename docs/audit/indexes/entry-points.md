# Entry Point Index

## Metrics

- Discovered entry points: seeded
- Mapped entry points: 0
- Blocked entry points: 0
- Unmapped entry points: seeded, not counted

## Entry Point Types

- UI route/view/editor/tab
- user action handler
- context menu action
- keyboard shortcut
- store action
- renderer service function
- preload bridge method
- IPC channel
- main IPC handler
- service HTTP endpoint
- repository public method
- migration
- MCP tool
- Narre SSE event
- provider adapter event
- CLI/script command

## Records

Initial entry-point surfaces:

| Surface | Count | Source |
|---|---:|---|
| Electron main IPC registrations | 165 | `packages/desktop-app/src/main` |
| netior-service route path conditions | 35 | `packages/netior-service/src/index.ts` |
| Narre Express endpoints | 38 | `packages/narre-server/src/index.ts` |
| MCP tool specs | 87 | `packages/shared/src/constants/netior-mcp-tools.ts` |
| Core repositories | 19 | `packages/netior-core/src/repositories` |
| Core migrations | 61 | `packages/netior-core/src/migrations` |
| Renderer components | 163 | `packages/desktop-app/src/renderer/components` |
| Renderer stores | 14 | `packages/desktop-app/src/renderer/stores` |
| Renderer services | 21 | `packages/desktop-app/src/renderer/services` |

Next mapping pass should assign feature IDs to each surface, then collapse duplicate layer entries into end-to-end feature records.

## Shared Entry Point Mapping

| Entry point | Feature ID | Status |
|---|---|---|
| `@netior/shared` package import | SH-0001 | mapped |
| `IPC_CHANNELS` import | SH-0002 | mapped |
| built-in skill constants and `findSkillBySlashTrigger` | SH-0003 | mapped |
| `AGENT_SKILL_STORAGE` import | SH-0004 | mapped |
| semantic/model definition helpers | SH-0005 | mapped |
| MCP tool spec helpers | SH-0006 | mapped |
| i18n helpers | SH-0007 | mapped |
| ontology display resolver helpers | SH-0008 | mapped |
| DSL validators | SH-0009 | mapped |
| interactive view validator | SH-0010 | mapped |
| semantic editor parser/serializer | SH-0011 | mapped |
| shared type imports | SH-0012 | mapped |
