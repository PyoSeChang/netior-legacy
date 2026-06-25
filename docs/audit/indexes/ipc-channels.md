# IPC Channel Index

## Metrics

- Discovered IPC channels: 165 main registrations
- Mapped IPC channels: shared constants mapped to SH-0002; 165 desktop main registrations mapped at group level to DESK-0004
- Unmapped IPC channels: 0 at group level; per-handler branch coverage pending

## Records

Initial grouped IPC surfaces:

| Group | Examples | Mapping status |
|---|---|---|
| Window shell | `window:minimize`, `window:maximize`, `window:close`, `window:isMaximized` | unmapped |
| Browser shell | `shell:openExternal`, `browser:clearData`, `browser:openDownload`, `browser:permission-response` | unmapped |
| Project | `project:create`, `project:list`, `project:update`, `project:delete`, `project:updateRootDir` | unmapped |
| Instance | `instance:create`, `instance:getByProject`, `instance:update`, `instance:delete`, `instance:search` | unmapped |
| Instance content | `instance:syncToAgent`, `instance:syncFromAgent` | unmapped |
| Network and nodes | `network:*`, `networkNode:*` | unmapped |
| Edges and relationships | `edge:*`, `relationship:*` | unmapped |
| Schema and fields | `schema:*`, `schemaField:*`, `schemaMeaning:*`, `schemaMeaningSlot:*` | unmapped |
| Model | `model:create`, `model:list`, `model:get`, `model:update`, `model:delete` | unmapped |
| Layout | `layout:*`, `layoutNode:*`, `layoutEdge:*` | unmapped |
| Filesystem | `fs:readFile`, `fs:writeFile`, `fs:rename`, `fs:delete`, `fs:copy`, `fs:move` | unmapped |
| File metadata | `file:*` | unmapped |
| Module | `module:*`, `moduleDir:*` | unmapped |
| Context | `context:*` | unmapped |
| Interactive views | `interactiveView*` | unmapped |
| Narre | `IPC_CHANNELS.NARRE_*` | unmapped |
| Terminal | `IPC_CHANNELS.TERMINAL_*` | unmapped |
| Agent runtime | `agent:*` | unmapped |
| Editor shell | `editor:*` | unmapped |
| Settings/config/fonts | `settings:*`, `config:get`, `fonts:listSystem` | unmapped |

## Shared Contract Mapping

| Contract | Feature ID | Status |
|---|---|---|
| `IPC_CHANNELS` exported from `@netior/shared/constants` | SH-0002 | mapped |

## Desktop Mapping

| Surface | Feature ID | Status |
|---|---|---|
| preload bridge | DESK-0003 | mapped |
| main IPC registration facade | DESK-0004 | mapped |
| window/browser/shell/editor/settings/font IPC | DESK-0001, DESK-0004 | mapped |
| domain CRUD IPC groups | DESK-0004 plus corresponding CORE/SVC records | mapped |
| Narre/terminal/agent IPC groups | DESK-0004 plus NARRE/terminal records pending | mapped |
