# packages/netior-service Audit

Status: scanning

## Initial Scope

- Target files: 4
- Existing test files: 0
- Route path conditions: 35
- Method conditions: 101

## Initial Feature Candidates

| Candidate | Evidence | Status |
|---|---|---|
| Service startup and DB ownership | `src/index.ts` | unmapped |
| Health check | `/health` | unmapped |
| CRUD HTTP facade for core repositories | route conditions in `src/index.ts` | unmapped |
| DSL/eval endpoints | `/dsl/evaluate`, `/eval/query` | unmapped |
| Service response envelope | `NetiorServiceResponse` usage | unmapped |

## Feature Records

### SVC-0001 netior-service Startup And DB Ownership

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-service`
- Locations:
  - `src/index.ts`
- Type: sidecar service lifecycle
- User/caller behavior: desktop, MCP, and Narre can access Netior metadata through one local HTTP service.
- System behavior: requires `NETIOR_SERVICE_DB_PATH`, initializes core database, starts a Node `http.createServer`, listens on `PORT` / `NETIOR_SERVICE_PORT` default `3201`, and closes DB/server on `SIGINT`/`SIGTERM`.
- Entry points:
  - `node dist/index.js`
  - package script `start`
- Inputs: environment variables and HTTP requests
- Outputs: listening HTTP service
- State changes: initializes/migrates SQLite metadata DB
- Persistence: SQLite metadata DB through `@netior/core`
- Dependencies: `@netior/core`, `@netior/shared/types`, Node HTTP
- Failure cases: missing DB path exits process; DB init/migration failure prevents service startup; port conflict prevents listening.
- Error handling: missing DB path logs and exits; unhandled request errors return 500 JSON.
- Async/loading behavior: async request body parsing with synchronous core DB calls.
- i18n/display relevance: none directly; service returns source/display fields from core.
- Linked indexes:
  - service-endpoints: `netior-service`
  - db-tables: CORE-0001
- Notes: This is the runtime owner for `better-sqlite3`.

### SVC-0002 Health, JSON Envelope, Routing, And Error Semantics

- Status: traced
- Risk: medium
- Test status: untested
- Package: `packages/netior-service`
- Locations:
  - `src/index.ts`
- Type: HTTP API contract
- User/caller behavior: clients can probe service health and receive consistent success/error JSON envelopes.
- System behavior: parses method/path/search params, routes manually, serializes JSON, reads request bodies, emits 404/405/400/500 errors, and serves `GET /health`.
- Entry points:
  - `GET /health`
  - all route misses and method mismatches
  - `readJsonBody`
  - `sendJson`
- Inputs: HTTP method, path, query params, JSON body
- Outputs: `NetiorServiceResponse`-style `{ ok: true, data }` or `{ ok: false, error }`
- State changes: none for health/errors
- Persistence: none
- Dependencies: Node `IncomingMessage` / `ServerResponse`
- Failure cases: invalid route, invalid method, invalid JSON/body, unexpected exception.
- Error handling: 404, 405, 400, or 500 JSON responses.
- Async/loading behavior: async body accumulation
- i18n/display relevance: error strings are literal English.
- Linked indexes:
  - service-endpoints: `/health`
- Notes: This package uses `ok`, while desktop IPC uses `success`; clients must normalize.

### SVC-0003 Core Repository HTTP Facade

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-service`
- Locations:
  - `src/index.ts`
- Type: HTTP API facade
- User/caller behavior: clients can create/read/update/delete projects, instances, schemas, models, networks, nodes, edges, relationships, files, modules, contexts, layouts, interactive views, editor prefs, and settings over HTTP.
- System behavior: maps manual HTTP routes to `@netior/core` repository functions and returns repository results in the service envelope.
- Entry points:
  - `/projects`
  - `/instances`, `/instances/search`
  - `/schemas`, `/schema-fields`, `/schema-meanings`, `/schema-meaning-slots`
  - `/models`, `/model-categories`
  - `/instance-properties`
  - `/editor-prefs/*`, `/config/*`
  - `/interactive-view-*`
  - `/objects/*`
  - `/contexts`, `/context-members/*`
  - `/files`, `/modules`, `/module-directories`
  - `/networks*`, `/network-types`, `/node-types`, `/edge-types`, `/network-nodes`
  - `/relationships`
  - `/edges`
  - `/layouts/by-network`, `/layout-nodes/*`, `/layout-edges/*`, `/layouts/*`
- Inputs: route params, query params, JSON create/update payloads
- Outputs: core records, arrays, booleans, nulls, or errors
- State changes: SQLite metadata writes through core repositories
- Persistence: SQLite metadata DB
- Dependencies: CORE-0003 through CORE-0015
- Failure cases: missing required search params, repository constraint errors, stale IDs, method mismatch, invalid payload shape.
- Error handling: method mismatches return 405; unhandled repository errors are caught by top-level 500 handler; some missing lookups are returned as `null`/`undefined` in successful envelopes.
- Async/loading behavior: async HTTP body parsing, synchronous core calls
- i18n/display relevance: returns source refs and user/custom labels for display consumers.
- Linked indexes:
  - service-endpoints: all netior-service CRUD route groups
  - db-tables: CORE repository mappings
- Notes: There are no direct netior-service tests in the initial scan; behavior is indirectly covered where desktop/MCP clients are tested.

### SVC-0004 DSL Evaluation And Eval Query Endpoints

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-service`
- Locations:
  - `src/index.ts`
- Type: HTTP API / evaluation
- User/caller behavior: clients can evaluate Netior DSL expressions, and development/eval tooling can run read-only SQL when explicitly enabled.
- System behavior: `POST /dsl/evaluate` validates required context/expression and calls `evaluateNetiorDsl`; `/eval/query` is only enabled when `NETIOR_SERVICE_ENABLE_EVAL=1` and only accepts SQL starting with `SELECT`.
- Entry points:
  - `POST /dsl/evaluate`
  - `POST /eval/query`
- Inputs: DSL request or SQL/params body
- Outputs: DSL evaluation result or selected DB rows
- State changes: none intended; SQL endpoint is restricted to select-prefix queries.
- Persistence: reads SQLite metadata DB
- Dependencies: CORE-0017 and `getDatabase`
- Failure cases: missing DSL context/expression, disabled eval route, non-POST method, missing SQL, non-SELECT SQL, SQL runtime errors.
- Error handling: 400/404/405 for validation/method/feature gating; runtime errors flow to 500.
- Async/loading behavior: async body parsing, synchronous DB reads
- i18n/display relevance: none
- Linked indexes:
  - service-endpoints: `/dsl/evaluate`, `/eval/query`
  - db-tables: CORE-0017
- Notes: The select-prefix check is a coarse safety gate and should not be treated as a general SQL sandbox.

### SVC-0005 Instance Agent Content Sync Routes

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/netior-service`
- Locations:
  - `src/index.ts`
- Type: HTTP API / content sync
- User/caller behavior: an instance can be serialized into agent-facing markdown and parsed back from agent-authored markdown.
- System behavior: loads instance content data, serializes through core, writes `agent_content`, parses returned agent content, upserts instance properties, updates instance title/content, normalizes `agent_content`, and returns refreshed instance data.
- Entry points:
  - `POST /instances/:id/sync-to-agent`
  - `POST /instances/:id/sync-from-agent`
- Inputs: instance ID and optional `{ agentContent }`
- Outputs: updated instance record
- State changes: instance content/title/agent_content and instance property rows
- Persistence: SQLite metadata DB
- Dependencies: CORE-0005, CORE-0006, CORE-0016
- Failure cases: missing instance returns 404, malformed agent content produces best-effort parse, stale field IDs, property upsert failure.
- Error handling: 404 for missing instance; repository/parser errors flow to 500.
- Async/loading behavior: async body parsing, synchronous core calls
- i18n/display relevance: field names appear in serialized agent content.
- Linked indexes:
  - service-endpoints: `/instances/:id/sync-*`
  - ipc-channels: `instance:syncToAgent`, `instance:syncFromAgent`
- Notes: Core parser has a focused test, but these service routes do not have direct route tests yet.
