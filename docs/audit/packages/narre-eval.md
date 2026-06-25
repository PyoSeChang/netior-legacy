# packages/narre-eval Audit

Status: scanning

## Scope Decision

Included as an internal evaluation and quality-assurance package. It is not a shipped user-facing desktop surface, but it creates projects, starts service processes, drives Narre sessions/orchestration, grades outputs, and writes persistent run artifacts; therefore it affects reproducibility and regression coverage.

## Initial Scope If Included

- Target files: 31
- Existing test files: 0
- Primary surfaces:
  - CLI runner
  - TUI runner
  - evaluation scenarios
  - orchestration E2E harness
  - grader and report generation

## Feature Records

### EVAL-0001 Narre Eval CLI, Run Options, And Run-Spec Execution

- Status: traced
- Risk: medium
- Test status: untested
- Package: `packages/narre-eval`
- Locations:
  - `src/cli.ts`
  - `src/run-spec.ts`
  - `src/execution.ts`
  - `package.json`
- Type: internal CLI
- User/caller behavior: developers run Narre evaluation scenarios from scripts with filters, repeat count, judge settings, ports, baseline comparison, dev DB, project reuse, and run-spec overrides.
- System behavior: parses CLI options, loads run specs, resolves execution defaults/overrides, checks adapter compatibility, sets run IDs, runs each scenario, records results, and prints summaries.
- Entry points:
  - `pnpm --filter @netior/narre-eval eval`
  - `pnpm --filter @netior/narre-eval eval:dev`
  - `parseArgs`
  - `main`
- Inputs: CLI args, run-spec YAML, environment variables, scenario manifests
- Outputs: scenario results, run artifacts, console summary
- State changes: run ID state, filesystem run output
- Persistence: `packages/narre-eval/runs/**`, scenario result folders, `%APPDATA%/netior/data/eval`
- Dependencies: EVAL-0002 through EVAL-0005, NARRE server, netior-service
- Failure cases: invalid run-spec, unsupported adapter capability, bad port/db path, scenario execution failure.
- Error handling: skipped/error scenario result builders preserve run metadata.
- Async/loading behavior: sequential async scenario execution
- i18n/display relevance: none
- Linked indexes:
  - scripts-commands: narre-eval scripts
- Notes: CLI behavior is not currently represented in automated tests.

### EVAL-0002 Scenario Manifest, Legacy Loader, Types, And Execution Normalization

- Status: traced
- Risk: medium
- Test status: untested
- Package: `packages/narre-eval`
- Locations:
  - `src/types.ts`
  - `src/loader.ts`
  - `src/execution.ts`
  - `scenarios/*/seed.ts`
- Type: scenario definition system
- User/caller behavior: developers author scenario bundles with manifests, turn plans, verify files, rubrics, fixtures, seed entrypoints, optional responders, and execution metadata.
- System behavior: loads manifest or legacy scenario YAML, validates required files and target skill turns, dynamically imports seed/responder modules, normalizes providers/testers/execution modes, and carries version/provenance metadata into results.
- Entry points:
  - `loadScenarios`
  - `loadFromManifest`
  - `loadFromLegacy`
  - `normalizeScenarioExecution`
- Inputs: `manifest.yaml`, `scenario.yaml`, turn/rubric/verify YAML, seed/responder modules
- Outputs: `EvalScenario` objects
- State changes: dynamic module loading only
- Persistence: none directly
- Dependencies: YAML parser, shared Narre/card/tool types
- Failure cases: missing turn/verify/rubric/seed files, target skill mismatch, malformed YAML, invalid execution enum values.
- Error handling: throws descriptive loader errors.
- Async/loading behavior: async dynamic imports
- i18n/display relevance: none
- Linked indexes:
  - scripts-commands: scenario authoring surface
- Notes: Loader treats legacy scenarios as versionless.

### EVAL-0003 Scenario Harness, Temporary DB, netior-service Process, And Seed Context

- Status: traced
- Risk: high
- Test status: untested
- Package: `packages/narre-eval`
- Locations:
  - `src/harness.ts`
  - `src/netior-service-process.ts`
  - `src/netior-service-client.ts`
  - `src/dev-runtime.ts`
- Type: evaluation environment setup
- User/caller behavior: each scenario gets a temporary or requested DB/project environment seeded with Netior data before Narre is exercised.
- System behavior: creates temp directories/DB paths, starts netior-service on an available port, exposes seed helpers for projects/schemas/models/instances/files/modules/properties, copies fixtures, tracks pending seed operations, and tears down service/temp files unless preserved.
- Entry points:
  - `setupScenario`
  - `teardownScenario`
  - `startNetiorServiceForEval`
  - seed context helper methods
- Inputs: scenario directory, seed function, db path/project id/preserve flags
- Outputs: seeded project, service URL, temp dir, DB path, teardown callback
- State changes: temp filesystem, SQLite DB, netior-service child process
- Persistence: temp DB/files or preserved DB/files when requested
- Dependencies: SVC-0001 through SVC-0005, CORE repositories
- Failure cases: service startup timeout, port conflict, seed not creating a project, fixture missing, teardown EPERM/EBUSY.
- Error handling: setup stops service and removes temp dir on failure; teardown retries recursive removal.
- Async/loading behavior: service health polling and tracked seed promises
- i18n/display relevance: none
- Linked indexes:
  - service-endpoints: eval netior-service client calls
  - filesystem-effects: temp dirs, fixture copies, DB files
- Notes: This package directly exercises netior-service, bypassing desktop.

### EVAL-0004 Narre Server Adapter, Session Runner, Tester Runtime, And Card Responses

- Status: mapped
- Risk: high
- Test status: untested
- Package: `packages/narre-eval`
- Locations:
  - `src/agents/base.ts`
  - `src/agents/narre-server.ts`
  - `src/runner/session-runner.ts`
  - `src/tester-runtime.ts`
- Type: Narre evaluation runner
- User/caller behavior: scenarios send one or more turns to Narre, optionally resume sessions, handle cards, and collect transcript/tool/event data.
- System behavior: starts or connects to Narre server, sends chat turns, parses stream/tool/card events, builds tester card handlers, substitutes template variables, and returns normalized transcripts.
- Entry points:
  - `NarreServerAdapter`
  - `runScenario`
  - `runSingleTurn`
  - `runConversation`
  - `buildTesterCardHandler`
- Inputs: project ID, scenario turns, mentions, tester settings, Narre cards/SSE events
- Outputs: transcript with assistant text, events, tool calls, errors, card responses, tester interactions
- State changes: Narre sessions and provider side effects
- Persistence: Narre session data through Narre server
- Dependencies: NARRE-0002 through NARRE-0006
- Failure cases: Narre health timeout, stream parse failure, card response mismatch, session resume drift, provider/API failure.
- Error handling: adapter/runner errors are captured by CLI into error results.
- Async/loading behavior: stream/event driven chat execution
- i18n/display relevance: none directly
- Linked indexes:
  - narre-events: stream event collection
- Notes: This is the main bridge between eval scenarios and live Narre behavior.

### EVAL-0005 Grading, Tool-Use Analysis, Baseline Comparison, And Report Artifacts

- Status: mapped
- Risk: medium
- Test status: untested
- Package: `packages/narre-eval`
- Locations:
  - `src/grader.ts`
  - `src/analyzer.ts`
  - `src/comparator.ts`
  - `src/report.ts`
  - `src/codex-exec.ts`
- Type: evaluation result analysis
- User/caller behavior: developers receive pass/fail/error/skipped results, verify counts, metrics, optional LLM judge scores, baseline comparisons, transcripts, and markdown/TSV artifacts.
- System behavior: grades DB and side-effect expectations, analyzes tool call sequences/budgets/dynamic conversation behavior, optionally runs Claude/Codex judges, compares against baseline runs, and writes latest/history artifacts.
- Entry points:
  - `gradeScenario`
  - `analyzeScenario`
  - `compareResults`
  - `recordResult`
  - `recordRunResult`
  - `runCodexStructuredTask`
- Inputs: transcript, setup result, scenario verify/rubrics, baseline dir, judge provider env
- Outputs: `ScenarioResult`, metrics, findings, markdown report, transcript/report files
- State changes: report files and run history
- Persistence: `runs/latest`, `runs/history`, per-scenario `results/**`
- Dependencies: EVAL-0004, Codex/Claude judge commands or SDK depending on provider
- Failure cases: judge provider unavailable, malformed judge response, baseline missing, DB verify query mismatch, report write failure.
- Error handling: error/skipped metric helpers and fallback report markdown exist.
- Async/loading behavior: DB checks and optional LLM judge calls
- i18n/display relevance: Korean fallback report text exists; output is developer-facing.
- Linked indexes:
  - filesystem-effects: eval run artifacts
- Notes: Judge model/provider names are environment/config dependent.

### EVAL-0006 Evaluation TUI And Operator Artifact Workflow

- Status: mapped
- Risk: medium
- Test status: untested
- Package: `packages/narre-eval`
- Locations:
  - `src/tui.ts`
- Type: terminal UI
- User/caller behavior: developers browse scenarios/runs, view summaries/reports/transcripts/findings/scenario sources, launch eval runs, and use an operator workflow to draft notes, patches, or diffs.
- System behavior: renders a keyboard-driven terminal dashboard, loads scenario/run artifacts, prompts for provider/tester selections, spawns eval CLI runs, stores operator chat/history/session files, and validates/applies generated artifacts.
- Entry points:
  - `pnpm --filter @netior/narre-eval tui`
  - `pnpm --filter @netior/narre-eval tui:dev`
  - `main`
  - `handleKey`
  - `runEvalFromTui`
- Inputs: keyboard events, run artifacts, scenario source files, operator commands
- Outputs: terminal dashboard, spawned run-spec execution, generated operator artifacts
- State changes: operator history/session/artifact files
- Persistence: run/operator files under `packages/narre-eval/runs/**`
- Dependencies: EVAL-0001, EVAL-0005, Codex exec helpers
- Failure cases: raw mode/input handling issues, missing artifacts, generated patch validation failure, spawned CLI failure.
- Error handling: busy-state wrappers and validation/apply result messages; detailed branch audit pending.
- Async/loading behavior: interactive key loop and spawned process execution
- i18n/display relevance: developer-facing mixed Korean/English output
- Linked indexes:
  - scripts-commands: TUI scripts
- Notes: `src/tui.ts` is large enough to merit a later sub-audit.

### EVAL-0007 Orchestration Control Plane Eval Runner And E2E Script

- Status: mapped
- Risk: high
- Test status: untested
- Package: `packages/narre-eval`
- Locations:
  - `src/runner/orchestration-runner.ts`
  - `src/orchestration-control-plane-e2e.ts`
  - `scenarios/orchestration-terminal-control-plane/seed.ts`
- Type: orchestration evaluation
- User/caller behavior: developers evaluate multi-agent orchestration, task planning/execution, terminal executor command polling, approvals, and event-to-transcript conversion.
- System behavior: creates/runs orchestration runs through Narre server APIs, resolves terminal agent keys, polls executor commands, converts supervisor events into Narre stream-event-like transcript records, and provides a standalone E2E script.
- Entry points:
  - `runOrchestrationScenario`
  - `pnpm --filter @netior/narre-eval e2e:orchestration`
- Inputs: project ID, orchestration scenario config, Narre server URL, executor IDs
- Outputs: orchestration transcript, agent/task/run events, E2E assertions
- State changes: Narre orchestration run/task/assignment state
- Persistence: Narre server orchestration/session data and eval artifacts
- Dependencies: NARRE-0007 through NARRE-0009, EVAL-0004
- Failure cases: missing terminal agent, executor command polling timeout, server start failure, task status mismatch, event conversion drift.
- Error handling: assertions and CLI error result handling.
- Async/loading behavior: polling and long-running orchestration execution
- i18n/display relevance: none
- Linked indexes:
  - narre-events: supervisor/orchestration events
- Notes: This is the highest-risk eval path because it spans Narre server, orchestration runtime, and external executor behavior.
