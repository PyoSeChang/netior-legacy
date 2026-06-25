# packages/narre-server Audit

Status: scanning

## Initial Scope

- Target files: 50
- Existing test files: 0
- Express endpoints: 38

## Initial Feature Candidates

| Candidate | Evidence | Status |
|---|---|---|
| Narre server startup and provider selection | `src/index.ts` | unmapped |
| SSE chat streaming | `src/index.ts`, `src/streaming.ts` | unmapped |
| Session storage | `src/session-store.ts` | unmapped |
| Provider adapters | `src/providers/**` | unmapped |
| Runtime orchestration | `src/runtime/narre-runtime.ts` | unmapped |
| Supervisor control plane | `src/supervisor/**` | unmapped |
| Skill registry and routing | `src/skills/**`, `src/skill-invocation-router.ts` | unmapped |
| Approval and UI response flow | `src/approval-store.ts`, `src/tools/pending-ui-responses.ts` | unmapped |

## Feature Records

### NARRE-0001 Express Server Startup, Environment, Logging, And Health

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/index.ts`
  - `src/logging.ts`
  - `package.json`
- Type: sidecar service lifecycle
- User/caller behavior: desktop can start Narre as a sidecar and check that the AI service is alive.
- System behavior: requires `MOC_DATA_DIR`, initializes Narre logging, parses behavior/Codex settings, creates registries, initializes provider/runtime, starts Express with CORS/JSON middleware, and serves `/health`.
- Entry points:
  - package script `start`
  - `GET /health`
- Inputs: environment variables including `MOC_DATA_DIR`, provider/model/settings, shared user data roots, agent IDs, port
- Outputs: Express HTTP service
- State changes: creates log files and registry/session storage as needed
- Persistence: `%APPDATA%/netior/data/narre/**` equivalent under `MOC_DATA_DIR`
- Dependencies: Express, CORS, provider adapters, session/supervisor registries
- Failure cases: missing `MOC_DATA_DIR`, provider initialization failure, port conflict, malformed settings env.
- Error handling: missing data dir logs and exits; endpoint handlers return JSON errors.
- Async/loading behavior: async provider/runtime initialization and request handlers
- i18n/display relevance: none directly
- Linked indexes:
  - service-endpoints: `GET /health`
  - narre-events: startup/logging
- Notes: Initial scan found no direct Narre server tests.

### NARRE-0002 Session Store And Session REST API

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/session-store.ts`
  - `src/index.ts`
- Type: session persistence and HTTP API
- User/caller behavior: users can create, list, open, rename, and delete Narre chat sessions per project.
- System behavior: stores `sessions.json` plus `session_<uuid>.json`, normalizes legacy message files into transcript v2, converts transcript/messages for compatibility, preserves card responses, and exposes session REST endpoints.
- Entry points:
  - `GET /sessions`
  - `POST /sessions`
  - `GET /sessions/:id`
  - `PATCH /sessions/:id`
  - `DELETE /sessions/:id`
  - `SessionStore`
- Inputs: project ID, session ID, session title/create payloads
- Outputs: session summaries/details or JSON errors
- State changes: Narre session index and session files
- Persistence: JSON files under `MOC_DATA_DIR/narre/{projectId}`
- Dependencies: shared Narre transcript/session types
- Failure cases: missing projectId, missing session, malformed legacy session JSON, file read/write failure.
- Error handling: endpoint validation returns 400/404/500; store read failures generally fall back to empty/null.
- Async/loading behavior: async filesystem I/O
- i18n/display relevance: session title is user-authored text.
- Linked indexes:
  - service-endpoints: `/sessions*`
  - narre-events: session persistence
- Notes: Legacy transcript normalization is a compatibility-sensitive path.

### NARRE-0003 SSE Chat Endpoint And Stream Event Forwarding

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/index.ts`
  - `src/streaming.ts`
  - `src/runtime/narre-runtime.ts`
- Type: SSE chat runtime
- User/caller behavior: desktop sends a Narre message and receives streaming text, tool events, cards, errors, and done events over SSE.
- System behavior: initializes SSE headers, creates trace IDs, builds runtime request, emits events from runtime callbacks, supports abort/interrupt handling, logs summarized stream events, and ends the SSE stream.
- Entry points:
  - `POST /chat`
  - `initSSE`
  - `sendSSEEvent`
  - `endSSE`
  - `NarreRuntime.runChat`
- Inputs: project ID, message, mentions, session ID, active agent/runtime profile, skills, run/task/assignment IDs
- Outputs: `NarreStreamEvent` SSE frames
- State changes: session transcript updates, supervisor session status, provider state
- Persistence: session files and provider-specific state files
- Dependencies: provider adapters, session store, MCP server path, prompt metadata, skill loader, supervisor registry
- Failure cases: missing MCP server build, provider error, aborted request, malformed body, stale session/project, SSE disconnect.
- Error handling: runtime emits `error` events and returns empty assistant text on missing MCP; route handlers catch and stream errors where possible.
- Async/loading behavior: streaming async provider iteration and filesystem/service calls
- i18n/display relevance: stream card/tool metadata uses shared tool display metadata.
- Linked indexes:
  - service-endpoints: `POST /chat`
  - narre-events: SSE stream events
- Notes: SSE frames are JSON payloads prefixed with `data:`.

### NARRE-0004 Narre Runtime Prompt, Skill, MCP, Transcript, And Supervisor Integration

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/runtime/narre-runtime.ts`
  - `src/system-prompt.ts`
  - `src/project-prompt-metadata.ts`
  - `src/skill-invocation-router.ts`
  - `src/skills/**`
  - `src/agent-skills/**`
- Type: AI runtime orchestration
- User/caller behavior: Narre responses include project context, selected skills, active agent behavior, tool access, mentions, and persisted transcript turns.
- System behavior: resolves or creates session, loads history, builds project/system/agent/skill prompts, parses slash skill invocations, resolves MCP server configs and tool profiles, appends user/assistant transcript turns, tracks tool/card blocks, and updates supervisor session status.
- Entry points:
  - `NarreRuntime.runChat`
  - `NarreRuntime.listSkills`
  - skill registry and user-agent skill loaders
- Inputs: chat request, behavior settings, project metadata, user/global agent skill directories
- Outputs: assistant text, transcript turns, runtime events
- State changes: session files and supervisor session status
- Persistence: JSON session files and agent skill files
- Dependencies: SH-0003, MCP-0001/0002, project service client, provider adapters
- Failure cases: missing MCP server, malformed skill markdown, unavailable project root, invalid runtime profile, stale transcript.
- Error handling: missing MCP emits user-facing runtime error; skill/user-agent loading is best-effort in loaders.
- Async/loading behavior: async filesystem and provider calls
- i18n/display relevance: built-in skill descriptions are translation-key based; prompts are mostly English.
- Linked indexes:
  - narre-events: runtime/session/skill events
- Notes: This is the central Narre behavior path and deserves deeper branch-level audit later.

### NARRE-0005 Provider Adapter Layer

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/runtime/provider-adapter.ts`
  - `src/providers/claude.ts`
  - `src/providers/openai.ts`
  - `src/providers/codex.ts`
  - `src/providers/openai-family/**`
  - `src/providers/shared/**`
  - `src/providers/codex-thread-store.ts`
  - `src/providers/openai-file-session.ts`
- Type: provider integration
- User/caller behavior: Narre can run through Claude, OpenAI, or Codex-family providers while exposing a common stream/tool/card interface.
- System behavior: defines `NarreProviderAdapter`, constructs provider adapters by env/runtime profile, caches adapters by provider/model, runs provider transports, maps text/tool/card callbacks, supports UI bridge responses and steering where provider supports it.
- Entry points:
  - `createProviderAdapter`
  - `getCachedProviderAdapter`
  - `ClaudeProviderAdapter.run`
  - `OpenAIFamilyProviderAdapter.run`
  - `NarreProviderAdapter.resolveUiCall`
  - optional `steer`
- Inputs: provider name/model/settings, runtime context, MCP configs, UI responses
- Outputs: provider run result, streamed callbacks, tool calls
- State changes: provider state files, thread/session stores, pending UI responses
- Persistence: provider state under Narre data directory where applicable
- Dependencies: external provider SDKs/transports, MCP server configs, UI bridge
- Failure cases: unsupported provider, missing login/API key, provider transport errors, duplicate/late UI response, model setting mismatch.
- Error handling: unsupported provider throws; provider errors flow to runtime/route error events.
- Async/loading behavior: async provider streaming/transports
- i18n/display relevance: tool metadata uses shared registry; provider errors are literal.
- Linked indexes:
  - narre-events: provider events
- Notes: Provider-specific detail remains a later sub-audit.

### NARRE-0006 UI Cards, Responses, Interrupt, And Steer

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/index.ts`
  - `src/ui-tools.ts`
  - `src/tools/pending-ui-responses.ts`
  - `src/providers/shared/ui-bridge.ts`
  - `src/providers/shared/claude-sdk-ui-server.ts`
- Type: interactive AI UI bridge
- User/caller behavior: Narre can ask for permission, proposals, drafts, interviews, and accept user responses or steering while a session is active.
- System behavior: creates provider UI tools, emits `card` stream events, resolves provider UI calls, records submitted card responses in session transcript, handles `/chat/respond`, `/chat/steer`, and interrupt requests.
- Entry points:
  - `POST /chat/respond`
  - `POST /chat/steer`
  - Narre UI bridge/provider tool calls
  - interrupt handling in chat route
- Inputs: session ID, tool call/card response payload, steering message
- Outputs: resolved UI call boolean or JSON status
- State changes: pending UI responses, session transcript card blocks, provider runtime state
- Persistence: session transcript files
- Dependencies: provider adapters and session store
- Failure cases: unknown tool call ID, stale session, provider does not support steering, interrupted stream race.
- Error handling: unresolved/invalid responses return errors or false depending route/provider path.
- Async/loading behavior: async route and provider UI waits
- i18n/display relevance: card text is provider/generated or system prompt text.
- Linked indexes:
  - service-endpoints: `/chat/respond`, `/chat/steer`
  - narre-events: card and UI response events
- Notes: This is a high-risk race-prone area because provider execution can be waiting on user UI.

### NARRE-0007 Supervisor Agent Registry And Session/Event Reporting

- Status: traced
- Risk: medium
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/supervisor/supervisor-registry.ts`
  - `src/supervisor/agent-registry.ts`
  - `src/index.ts`
- Type: supervisor control plane
- User/caller behavior: desktop can list supervisor agents/sessions/events and report agent session status.
- System behavior: provides built-in/global/project agent definitions, registers Narre/agent sessions, stores bounded event lists, exposes list/report endpoints, and normalizes agent keys.
- Entry points:
  - `GET /supervisor/agents`
  - `GET /supervisor/sessions`
  - `GET /supervisor/events`
  - `POST /supervisor/sessions/report`
  - supervisor registry methods
- Inputs: project ID, session reports, agent definitions
- Outputs: agent/session/event snapshots
- State changes: in-memory supervisor session/event registry
- Persistence: none for supervisor registry itself in initial scan
- Dependencies: shared agent/session types
- Failure cases: invalid report payload, event list truncation, stale session status.
- Error handling: invalid report returns 400.
- Async/loading behavior: mostly synchronous
- i18n/display relevance: agent display should use shared resolver where surfaced.
- Linked indexes:
  - service-endpoints: supervisor list/report endpoints
  - narre-events: supervisor events
- Notes: Orchestration and executor persistence are separate records.

### NARRE-0008 Orchestration Runs, Tasks, Assignments, Approvals, And Operator

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/supervisor/orchestration-registry.ts`
  - `src/supervisor/agent-operator.ts`
  - `src/supervisor/agent-runtime-dispatcher.ts`
  - `src/index.ts`
- Type: orchestration control plane
- User/caller behavior: Narre/supervisor can create conversations and runs, plan/run/cancel work, create tasks/assignments, record events/status, and resolve approvals.
- System behavior: persists orchestration state to JSON, manages conversations/runs/tasks/assignments/approvals/events, dispatches assignments to available executors/providers, and exposes control endpoints.
- Entry points:
  - `/supervisor/conversations`
  - `/supervisor/runs*`
  - `/supervisor/tasks*`
  - `/supervisor/assignments*`
  - `/supervisor/approvals/:id/resolve`
  - `AgentOperator`
  - `AgentRuntimeDispatcher`
- Inputs: create run/task/assignment payloads, status updates, approval decisions
- Outputs: orchestration snapshots, run/task/assignment records, events
- State changes: orchestration JSON state, supervisor events, assignment statuses
- Persistence: `MOC_DATA_DIR/narre/supervisor/orchestration.json`
- Dependencies: executor registry, runtime dispatcher, provider/runtime profiles
- Failure cases: invalid payloads, missing run/task/assignment, no available executor/provider, race between status updates, corrupt persisted JSON.
- Error handling: invalid inputs return 400; registry methods throw and route catches return 400/404/500 depending endpoint.
- Async/loading behavior: async operator/dispatcher calls, synchronous JSON persistence inside registry
- i18n/display relevance: user request/task/result text is user/provider-authored.
- Linked indexes:
  - service-endpoints: supervisor orchestration endpoints
  - narre-events: orchestration events
- Notes: This is a major user-facing workflow surface with no direct tests found in initial scan.

### NARRE-0009 Executor Registry And Command Polling

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/supervisor/executor-registry.ts`
  - `src/index.ts`
- Type: executor control plane
- User/caller behavior: terminal/native agent executors can register, heartbeat, receive commands, and report command results.
- System behavior: persists executor registrations and queued commands, marks claimed commands as running, completes commands, finds available executors by provider/capability, and exposes executor endpoints.
- Entry points:
  - `GET /supervisor/executors`
  - `POST /supervisor/executors/register`
  - `POST /supervisor/executors/:id/heartbeat`
  - `POST /supervisor/executors/:id/commands`
  - `GET /supervisor/executors/:id/commands`
  - `POST /supervisor/executors/:executorId/commands/:commandId/result`
  - `ExecutorRegistry`
- Inputs: executor registration, heartbeat status, command payloads, command result status
- Outputs: executor and command records
- State changes: executor/command maps and persisted JSON
- Persistence: `MOC_DATA_DIR/narre/supervisor/executors.json`
- Dependencies: shared executor/agent runtime types
- Failure cases: unknown executor/command, stale heartbeat, duplicate executor ID, command result race.
- Error handling: registry throws; endpoints return JSON errors.
- Async/loading behavior: synchronous JSON persistence inside registry
- i18n/display relevance: none
- Linked indexes:
  - service-endpoints: supervisor executor endpoints
  - narre-events: executor command events
- Notes: This is the bridge to terminal/native agent execution.

### NARRE-0010 Netior Service Client And Project Prompt Metadata

- Status: traced
- Risk: medium
- Test status: untested
- Package: `packages/narre-server`
- Locations:
  - `src/netior-service-client.ts`
  - `src/project-prompt-metadata.ts`
- Type: service client / prompt context
- User/caller behavior: Narre prompt generation can include project root and ontology/context metadata from Netior.
- System behavior: calls netior-service, unwraps service JSON, builds project prompt metadata, and feeds system prompts/runtime.
- Entry points:
  - `getProjectById`
  - project prompt metadata builder
- Inputs: project ID, service URL env
- Outputs: project metadata and root path
- State changes: none
- Persistence: reads SQLite metadata through netior-service
- Dependencies: SVC-0003 and CORE project/schema/model/network data
- Failure cases: service unavailable, missing project, stale metadata, non-JSON response.
- Error handling: service client throws; runtime/route catches and emits errors.
- Async/loading behavior: async fetch
- i18n/display relevance: prompt metadata may include user/system display names.
- Linked indexes:
  - service-endpoints: netior-service client calls
- Notes: This preserves the rule that Narre does not own DB directly.
