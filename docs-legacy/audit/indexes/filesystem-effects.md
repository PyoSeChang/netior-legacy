# Filesystem Effect Index

## Metrics

- Discovered writes/deletes: seeded from IPC and MCP groups
- Mapped effects: MCP PDF metadata write mapped; desktop IPC pending
- Unmapped effects: not counted

## Records

Initial filesystem-effect entry points:

| Entry point | Mapping status |
|---|---|
| `fs:writeFile` | unmapped |
| `fs:rename` | unmapped |
| `fs:delete` | unmapped |
| `fs:stashDelete` | unmapped |
| `fs:restoreDeleted` | unmapped |
| `fs:createFile` | unmapped |
| `fs:createDir` | unmapped |
| `fs:copy` | unmapped |
| `fs:move` | unmapped |
| `fs:writeClipboardFiles` | unmapped |
| `fs:saveClipboardImage` | unmapped |
| MCP `update_file_pdf_toc` | MCP-0008 |

## Shared Contract Mapping

| Surface | Feature ID | Status |
|---|---|---|
| User agent skill storage layout constants | SH-0004 | mapped |
