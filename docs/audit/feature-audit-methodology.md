# Netior Feature Audit Methodology

## Purpose

This audit records Netior behavior at the smallest practical feature unit and keeps enough evidence to measure whether the audit is complete.

A feature unit is the smallest behavior that is independently invoked, independently perceived by a user or caller, changes state, returns meaningful data, or has its own failure cases.

## Audit Scope

Default in-scope areas:

- `packages/shared`
- `packages/netior-core`
- `packages/netior-service`
- `packages/netior-mcp`
- `packages/narre-server`
- `packages/desktop-app`
- repo-level scripts and docs only when they expose product, build, release, migration, or runtime behavior

Default out-of-scope areas unless explicitly pulled in:

- generated build output
- vendored dependencies
- package manager caches
- temporary scratch folders
- historical prototypes
- binary assets with no code-facing behavior

Every excluded file or directory must have an exclusion reason in the file coverage index.

## Completion Metrics

The audit is complete only when these metrics are recorded:

| Metric | Done condition |
|---|---|
| File coverage | 100% of target files are classified as `audited`, `excluded`, or `blocked` |
| Entry point coverage | 100% of discovered entry points are mapped to a feature ID or explicitly blocked |
| Unknown test status | 0 feature records have `unknown` test status |
| Unmapped indexes | 0 IPC/API/DB/filesystem/MCP/Narre index entries are unmapped |
| High-risk traceability | 100% of high-risk features include failure cases and recommended verification |
| Blocked items | 100% of blocked items include reason and next action |

## Feature ID Prefixes

| Prefix | Area |
|---|---|
| `SH` | `packages/shared` |
| `CORE` | `packages/netior-core` |
| `SVC` | `packages/netior-service` |
| `MCP` | `packages/netior-mcp` |
| `NARRE` | `packages/narre-server` |
| `DESK` | `packages/desktop-app` |
| `EVAL` | `packages/narre-eval` if pulled into scope |
| `ROOT` | repo-level commands, scripts, or configuration |
| `E2E` | cross-package user-facing flows |

## Audit States

| State | Meaning |
|---|---|
| `not-started` | Known target, not inspected yet |
| `scanning` | File or entry point is being inspected |
| `mapped` | Feature candidate has an ID and location |
| `traced` | Main flow is traced from entry point to state/data boundary |
| `verified` | Test or manual verification status is known |
| `excluded` | Not in audit scope; reason required |
| `blocked` | Cannot complete now; reason and next action required |

## Risk Levels

`high`:

- data deletion, overwrite, migration, or schema changes
- DB repository behavior or transaction boundaries
- filesystem write/delete
- sidecar process lifecycle
- Narre provider/runtime/SSE flow
- IPC security boundary
- external network behavior
- no test coverage and user data impact

`medium`:

- complex state management
- async race or stale response risk
- UI state separated from persisted state
- i18n/display resolver behavior
- legacy compatibility path

`low`:

- pure display behavior
- constants or type-only behavior
- no persisted state impact
- well-covered by tests or type boundaries

## Test Status

| Status | Meaning |
|---|---|
| `tested` | Direct automated test exists |
| `indirectly-tested` | Covered through a broader test |
| `untested` | No automated test found |
| `manual-only` | Needs manual validation or visual/runtime verification |
| `unknown` | Not checked yet; must be resolved before completion |

## Required Fields Per Feature

Each feature record must include:

- feature ID
- name
- package and file locations
- feature type
- user/caller-facing behavior
- system behavior
- entry point
- input
- output
- state changes
- persistence boundary
- internal and external dependencies
- failure cases
- error handling
- loading or async behavior when relevant
- i18n/display-name relevance
- test status
- risk level
- linked indexes

## Required Indexes

The audit keeps reverse lookup indexes for:

- files
- UI components
- renderer stores and actions
- renderer services
- preload bridge methods
- IPC channels
- service HTTP endpoints
- DB tables and migrations
- filesystem writes/deletes
- MCP tools
- Narre events, tools, and provider adapters
- scripts and commands

An index item is complete when it points to one or more feature IDs, or has a `blocked` or `excluded` reason.

## Layer Trace Rule

For user-facing desktop features, trace as far as the code path allows:

```text
renderer UI
-> renderer store/service
-> preload bridge
-> IPC channel
-> main handler
-> sidecar/service HTTP
-> core repository
-> database/filesystem
```

The trace can stop only at a documented boundary, such as a pure UI feature, a mocked test-only path, or an external provider adapter.

