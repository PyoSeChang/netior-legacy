# Service Endpoint Index

## Metrics

- Discovered endpoints: 73 seeded
- Mapped endpoints: 73 seeded endpoints mapped at primary feature level
- Unmapped endpoints: 0 at endpoint-group level; handler branch coverage pending

## Records

## netior-service

35 unique route path conditions were found in `packages/netior-service/src/index.ts`.

| Path group | Mapping status |
|---|---|
| `/health` | unmapped |
| `/eval/query` | unmapped |
| `/dsl/evaluate` | unmapped |
| `/instances`, `/instances/search` | unmapped |
| `/schemas`, `/schema-fields`, `/schema-fields/reorder`, `/schema-meanings` | unmapped |
| `/models`, `/model-categories` | unmapped |
| `/instance-properties` | unmapped |
| `/interactive-view-states`, `/interactive-view-templates`, `/interactive-view-preferences`, `/interactive-view-schema-preferences` | unmapped |
| `/objects/by-ref` | unmapped |
| `/contexts` | unmapped |
| `/files`, `/files/by-path` | unmapped |
| `/modules`, `/module-directories` | unmapped |
| `/projects` | unmapped |
| `/networks`, `/networks/universe`, `/networks/ontology`, `/networks/tree` | unmapped |
| `/network-types`, `/node-types`, `/edge-types`, `/network-nodes` | unmapped |
| `/relationships`, `/edges` | unmapped |
| `/layouts/by-network` | unmapped |

## Core Backing Mapping

| Endpoint group | Backing feature IDs |
|---|---|
| `/projects` | CORE-0003 |
| `/objects/by-ref` | CORE-0004 |
| `/instances`, `/instances/search`, `/instance-properties` | CORE-0005 |
| `/schemas`, `/schema-fields`, `/schema-fields/reorder`, `/schema-meanings` | CORE-0006 |
| `/models`, `/model-categories` | CORE-0007 |
| `/networks*`, `/network-nodes`, `/edges` | CORE-0008 |
| `/layouts/by-network` | CORE-0009 |
| `/files`, `/files/by-path`, `/modules`, `/module-directories` | CORE-0010 |
| `/contexts` | CORE-0011 |
| `/interactive-view-*` | CORE-0012 |
| editor prefs/settings routes | CORE-0013 |
| `/network-types`, `/node-types`, `/edge-types` | CORE-0014 |
| `/relationships` | CORE-0015 |
| `/dsl/evaluate`, `/eval/query` | CORE-0017 |

## Service Feature Mapping

| Service surface | Feature ID | Status |
|---|---|---|
| startup and DB ownership | SVC-0001 | mapped |
| health and JSON envelope | SVC-0002 | mapped |
| core repository HTTP facade | SVC-0003 | mapped |
| DSL/eval endpoints | SVC-0004 | mapped |
| instance agent sync endpoints | SVC-0005 | mapped |

## MCP Client Mapping

| Client surface | Feature ID | Status |
|---|---|---|
| netior-service URL resolution and response unwrap | MCP-0003 | mapped |
| repository-backed MCP tool calls | MCP-0004 through MCP-0009 | mapped |

## narre-server

38 Express endpoints were found in `packages/narre-server/src/index.ts`.

| Endpoint group | Mapping status |
|---|---|
| `GET /health` | NARRE-0001 |
| `GET/POST/PATCH/DELETE /sessions` and `/sessions/:id` | NARRE-0002 |
| `GET /skills` | NARRE-0004 |
| `POST /chat`, `/chat/steer`, `/chat/respond` | NARRE-0003, NARRE-0006 |
| `GET /supervisor/agents`, `/supervisor/skills`, `/supervisor/sessions`, `/supervisor/events` | NARRE-0007 |
| `/supervisor/conversations` | NARRE-0008 |
| `/supervisor/runs*` | NARRE-0008 |
| `/supervisor/tasks*` | NARRE-0008 |
| `/supervisor/assignments*` | NARRE-0008 |
| `/supervisor/approvals/:id/resolve` | NARRE-0008 |
| `/supervisor/executors*` | NARRE-0009 |
