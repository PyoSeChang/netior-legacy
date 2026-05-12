# AGENTS.md

## Codex Operational Notes

- When a command is blocked by the Codex sandbox, describe it as "requesting approval to run outside the sandbox". Do not call it "elevated permissions" or "admin privileges" unless Windows UAC/admin is actually involved.
- Before editing with `apply_patch`, read the exact nearby block first. Prefer small patches tied to current file text. If a patch fails, re-read the target block before retrying.
- Treat Korean docs as encoding-sensitive. Do not rewrite whole Korean documents, and do not write Korean docs with PowerShell `Set-Content` or shell redirection. Prefer minimal `apply_patch` edits and re-read the changed area afterward.
- On Windows, avoid shell-generated text file rewrites for docs. For code edits, use `apply_patch`; for formatting or generated build artifacts, use the repo's normal tools.
- When staging or committing in a dirty worktree, stage explicit paths only and report which tracked files were included.

## What Is Netior

Netior is a network-based desktop app for organizing ontology-backed instances. Instances are placed as nodes in networks, and relationships are represented as edges with model-backed meaning. Instance data lives in files such as `.md` and `.pdf`.

It is the successor to Culturium. The structure was redesigned to remove three blockers to open-sourcing: backend coupling, SQLite metadata isolation, and `culture.json` complexity.

## Commands

```bash
# Development
pnpm dev:desktop

# Build
pnpm build
pnpm --filter @netior/shared build
pnpm --filter @netior/core build
pnpm --filter @netior/mcp build
pnpm --filter @netior/narre-server build

# Test
pnpm test
pnpm --filter @netior/shared test
pnpm --filter @netior/core test
pnpm --filter @netior/desktop-app test

# Typecheck
pnpm typecheck
```

## Architecture

### Monorepo

- **`packages/shared`** (`@netior/shared`) — shared types, constants, and i18n. Built with tsup as ESM and CJS. Subpaths: `/types`, `/constants`, `/i18n`.
- **`packages/netior-core`** (`@netior/core`) — DB logic library: connection, repositories, migrations. The runtime owner is `netior-service`.
- **`packages/netior-service`** (`@netior/service`) — DB/native owner process. Wraps `@netior/core` behind HTTP and is the only runtime that should directly own `better-sqlite3`.
- **`packages/netior-mcp`** (`@netior/mcp`) — MCP server. Exposes Netior tools through `netior-service`.
- **`packages/narre-server`** (`@netior/narre-server`) — Narre AI service. Provider adapters plus Express plus SSE. DB access goes through `netior-service`.
- **`packages/desktop-app`** (`@netior/desktop-app`) — Electron app built with electron-vite. Output goes to `out/`.

### Desktop App Layers

```text
main process          -> preload bridge        -> renderer (React)
------------------------------------------------------------------
sidecar clients          preload/index.ts         services/*.ts
ipc/*.ts                 contextBridge API        stores/*.ts (Zustand)
process/*.ts                                       components/**/*.tsx
                                                   hooks/
```

**Data flow**: renderer services -> `window.electron.*` -> preload `ipcRenderer.invoke` -> main IPC handlers -> `netior-service` HTTP -> `@netior/core` -> `better-sqlite3`.

**IPC pattern**: every response uses `IpcResult<T>` (`{ success: true, data } | { success: false, error }`). Channel constants live in `@netior/shared/constants` as `IPC_CHANNELS`.

### i18n and Display Names

- i18n is a presentation concern only. Do not use translated labels as identifiers, ordering keys, grouping keys, sync predicates, or layout predicates.
- Identity and behavior must use stable data such as `id`, `key`, `source_kind`, `source_id`, `source_ref`, `object_type`, `ref_id`, model keys, schema/instance source refs, or explicit metadata.
- Built-in ontology display names should go through the shared ontology display resolver (`@netior/shared`), not desktop-only helpers or ad hoc `t(...)` calls in consumers.
- Use the shared ontology display resolver whenever a label or description is derived from a stable built-in identity, including models, model categories, built-in schemas/instances, MCP tools, Narre tools, agents, and future `source_kind`/`source_ref` backed objects. Consumers should pass identity plus fallback metadata to the resolver; they should not compute i18n keys locally.
- MCP tool presentation must use the resolver namespace `narre.tools.<tool_key>.name` and `narre.tools.<tool_key>.description`. When adding a tool to `NETIOR_MCP_TOOL_SPECS`, add both locale entries in `packages/shared/src/i18n/locales/en.json` and `packages/shared/src/i18n/locales/ko.json`, and add or update tests that fail when a spec key has no resolver-backed display entry.
- Do not add parallel translation paths such as `narre.toolLabel.*`, `narre.toolDescription.*`, camelCase conversion helpers, desktop-only label maps, or local `t(...)` calls for built-in display names. If an old path exists, delete the old keys and the code that reads them in the same change that introduces the resolver path.
- Fallback text is only for user-authored/custom data or unknown external objects. It must not be used to hide missing i18n for Netior-owned built-ins, system ontology objects, or Netior MCP tools; missing resolver keys should be treated as a test/build issue.
- Legacy cleanup rule: replacing usage is not enough. Remove obsolete constants, locale keys, helper functions, and tests that keep the old path discoverable, then verify with `rg` that the legacy key names and helper names no longer exist in source. This prevents later agents from extending the wrong path.
- Built-in model categories are schema/instance data. Category instances should be displayed from `source_ref` such as `model-category.time`, while network grouping must use category instance ids or contains edges, never the localized category label.
- When adding a built-in source kind or source ref, update shared i18n/display rules and every consumer path that surfaces it: desktop renderer, Narre prompts/tool previews, MCP metadata, and any service response that must carry source fields.

### Production Packaging

- The packaged desktop app includes a bundled Node runtime under `resources/node-runtime`.
- Production sidecars are embedded under `resources/sidecars`.
- The sidecar set is:
  - `netior-service`
  - `netior-mcp`
  - `narre-server`
- The installer upgrade path is customized in `packages/desktop-app/build/installer.nsh`.
- Upgrade behavior:
  - If `Netior.exe` is not actually running, the installer pre-cleans the previous install directory and uninstall registry entries before relying on an older uninstaller.
  - If an older uninstaller still fails later in the flow, the installer falls back to manual cleanup instead of aborting immediately.

### Two Storage Layers

| Layer | Location | Contents |
|---|---|---|
| Metadata | `%APPDATA%/netior/data/netior.db` | projects, instances, schemas, models, networks, network_nodes, edges, files, objects, sources, instance_properties, editor prefs |
| Instance Data | User project directory | `.md`, `.pdf`, `.png`, and other real files |

The app does not write metadata into the project directory. Networks and SQLite handle structure; the filesystem is pure instance storage.

### Data Model

- Canonical reference: [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md)
- **Project** — owns a user root directory and project-scoped ontology.
- **Instance** — concrete object in a project. This replaces the old `Concept` domain name.
- **Schema** — ontological meta object that describes fields and structure for instances.
- **Model** — meaning layer. It classifies how objects or edges should be interpreted by Netior, Narre, MCP tools, and layouts.
- **Network** — spatial/relational object graph surface with nodes, edges, layout state, and viewport state.
- **NetworkNode** — placement of an object in a network. It references an `objects` row instead of embedding per-kind identity directly.
- **Edge** — connection between two network nodes. Its `model_id` points to the model that defines the edge meaning.
- **ObjectRecord** — normalized object reference with `object_type`, `ref_id`, scope, and project id.
- **FileEntity** — metadata for a project file or directory. File contents stay on disk.

### Type System

Project-level ontology objects:

- **Schema** — field-bearing ontology object for instances.
- **Model** — semantic object used by instances, edges, network grouping, Narre, and MCP metadata.
- **Model category** — built-in schema/instance data, not a model field duplicated elsewhere. The schema uses `source_ref = 'schema.model_category'`; category instances use refs like `model-category.time`.
- **Source provenance** — built-in and package-provided ontology objects use `source_kind`, `source_id`, `source_ref`, and `source_version`; do not rely on a `built_in` boolean as the policy boundary.
- **Schema field binding** — `schema_field_bindings` is the canonical relationship/behavior layer for schema fields. `field_type` stays the storage/UI primitive; bindings hold option sources, schema composition/extension, conditional metadata, computed metadata, and derived collection metadata.

Schema field authoring UI must choose behavior before type. Select-like controls (`select`, `multi-select`, `radio`) are normal field types, not behavior modes. Behavior-specific type restrictions belong in the editor. As of this note, `conditional_field`, `computed_field`, and `derived_collection` are persisted definitions only; do not present them as runtime-complete until instance editing, validation, persistence, and query evaluation actually execute those bindings.

When adding a new persisted object or ontology type, follow the seven-layer pattern:

`migration -> types -> constants -> repository -> IPC -> preload -> renderer`

### Network Canvas Engine

There is no external canvas library. The network surface is implemented directly with CSS transforms and SVG.

- Pan/zoom is handled in network workspace components.
- `Ctrl + wheel` navigates network hierarchy.
- Nodes are rendered by `NodeCardDefault` plus shape layouts
- Edges are rendered by `EdgeLayer` and `EdgeLine`
- Background uses an SVG dot grid
- Interaction modes: `browse` and `edit`

### Edge Interaction

- **Create** — edit mode -> right-click a node -> add connection -> click target node -> open `EdgeEditor`
- **Edit** — double-click an edge -> open `EdgeEditor`
- **Delete** — edit mode -> right-click an edge -> `EdgeContextMenu` -> delete
- **Visual override** — per-edge `color`, `line_style`, and `directed`; `null` falls back to the edge model default.

### Editor System

`EditorTabType`:

Current editor tab types include ontology objects, files, terminals, edges, networks, and Narre. Legacy compatibility names may still exist in runtime types while migrations and UI routes are being carried forward; new domain docs should use `instance`, `schema`, `model`, `network`, and `edge`.

Extension-based editor routing:

- `.md` -> `MarkdownEditor`
- `.txt`, `.json`, `.yaml`, and similar -> `PlainTextEditor`
- `.png`, `.jpg`, and similar -> `ImageViewer`
- `.pdf` -> `PdfViewer`
- anything else -> `UnsupportedFallback`

### Narre

Narre uses `EditorTabType 'narre'`. The Sparkles icon in the activity bar opens it. There is one Narre tab per project.

Architecture:

```text
desktop-app (renderer) -> desktop-app (main) -> narre-server (sidecar)
NarreChat.tsx             narre-ipc.ts          Express + SSE + provider adapters
SSE UI events         <-  IPC forwarder      <- provider runtime
                                                |
                                                +-> netior-service / netior-mcp
```

Key pieces:

- `NarreEditor`
- `NarreSessionList`
- `NarreChat`
- `NarreMentionInput`
- `NarreToolLog`

Session storage:

- `%APPDATA%/netior/data/narre/{projectId}/sessions.json`
- `%APPDATA%/netior/data/narre/{projectId}/session_{uuid}.json`

Process management:

- `narre-server-manager.ts` launches the packaged or dev Narre sidecar
- `desktop-app` forwards SSE output into renderer state

### Network Sidebar

The sidebar displays a hierarchy tree for networks. Legacy APIs may still expose `getCanvasTree`/`canvas_nodes` names while the domain model is being migrated.

- Root network
- Instance/model category group headers
- Recursive network hierarchy support
- Context actions such as open in editor and delete

### Path Aliases

- `@main` -> `src/main`
- `@renderer` -> `src/renderer`
- `@shared` -> `src/shared`
- `@netior/core` -> `../netior-core/src`
- `@netior/shared` -> `../shared/src`

### netior-mcp

Example Codex registration:

```jsonc
{
  "mcpServers": {
    "moc": {
      "command": "node",
      "args": ["packages/netior-mcp/dist/index.cjs"],
      "env": {
        "NETIOR_SERVICE_URL": "http://127.0.0.1:3201"
      }
    }
  }
}
```

## Key Constraints

- **better-sqlite3 ownership** — the native binding belongs to `netior-service`. In development you may need `pnpm run rebuild:native` for the current Node runtime.
- **Build order** — `@netior/shared` -> `@netior/core` -> `@netior/service`, `@netior/mcp`, `@netior/narre-server`, `@netior/desktop-app`.
- **DB concurrency** — SQLite runs in WAL mode with `busy_timeout(5000)`. `desktop-app` does not open the DB directly.
- **Desktop packaging** — production should prefer bundled sidecars instead of deep workspace or pnpm-linked runtime trees.
- **Installer upgrades** — keep `packages/desktop-app/build/installer.nsh` aligned with packaging changes; if payload layout changes, verify upgrade and uninstall behavior explicitly.
- **UI components stay in desktop-app** — `shared` should stay limited to pure types, constants, and i18n.
- **Context menu pattern** — prefer `onMouseDown={e => e.stopPropagation()}` over document-level close listeners when appropriate.
- **Migration rule** — never edit an already-applied migration in place; add a new migration file.

## Testing

Vitest v2 with Vite 5 compatibility.

Typical test split:

- `shared`
  - constants
  - i18n
- `netior-core`
  - repositories
  - migrations
  - cascade and constraint behavior
- `desktop-app`
  - renderer stores and UI behavior

`netior-core` tests use in-memory SQLite via `test-db.ts`, with `getDatabase()` mocked where appropriate.

## UI Development

### Semantic Tokens Only

Do not hardcode color utility classes. Use semantic tokens:

- Surface: `surface-base`, `surface-panel`, `surface-card`, `surface-hover`, `surface-modal`
- Text: `text-default`, `text-secondary`, `text-muted`, `text-on-accent`
- Border: `border-subtle`, `border-default`, `border-strong`
- Accent: `accent`, `accent-hover`, `accent-muted`

### Available UI Components

Under `src/renderer/components/ui/`:

- Button
- IconButton
- Input
- NumberInput
- TextArea
- Select
- Checkbox
- Toggle
- Modal
- ConfirmDialog
- Toast
- Tooltip
- Badge
- Divider
- Spinner
- ScrollArea

### Theme System

Three-tier theme system:

- `data-concept`
- `data-mode`
- Tailwind semantic tokens
