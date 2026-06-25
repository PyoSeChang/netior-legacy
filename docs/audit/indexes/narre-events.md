# Narre Event And Provider Index

## Metrics

- Discovered events/tools/providers: seeded from endpoints and provider files
- Mapped items: primary Narre server surfaces mapped to NARRE-0001 through NARRE-0010
- Unmapped items: provider-specific branches and supervisor method branches pending detailed sub-audit

## Records

Initial Narre surfaces:

| Surface | Count | Mapping status |
|---|---:|---|
| Express endpoints | 38 | unmapped |
| Provider adapter files | 8 | unmapped |
| Runtime files | 2 | unmapped |
| Supervisor registry/dispatcher files | 6 | unmapped |
| Skill files | 6 | unmapped |
| Streaming helper | 1 | unmapped |

## Shared Contract Mapping

| Surface | Feature ID | Status |
|---|---|---|
| Built-in slash skills | SH-0003 | mapped |
| MCP/Narre tool metadata | SH-0006 | mapped |

## Narre Server Mapping

| Surface | Feature ID | Status |
|---|---|---|
| startup, env, logging, health | NARRE-0001 | mapped |
| session store and REST API | NARRE-0002 | mapped |
| SSE chat streaming | NARRE-0003 | mapped |
| runtime prompt/skill/MCP orchestration | NARRE-0004 | mapped |
| provider adapter layer | NARRE-0005 | mapped |
| UI cards/respond/steer/interrupt | NARRE-0006 | mapped |
| supervisor agent/session/event registry | NARRE-0007 | mapped |
| orchestration runs/tasks/assignments/approvals | NARRE-0008 | mapped |
| executor registry and command polling | NARRE-0009 | mapped |
| netior-service prompt metadata client | NARRE-0010 | mapped |
