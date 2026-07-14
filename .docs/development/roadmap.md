# Implementation roadmap (multi-PR)

[← Documentation index](../index.md) · [Development guide](../development/guide.md)

Track implementation across focused pull requests against **`main`**.

## PR status

| PR | Branch | Scope | Status |
|----|--------|-------|--------|
| **#1** | `cursor/plugin-scaffold-byok-db56` | Scaffold + BYOK MVP | **Done** (v0.1.0) |
| **#2** | `cursor/cursor-rest-backend-db56` | Cursor REST (`crsr_…`) + SSE | **Done** (v0.2.0) |
| **#3** | `cursor/multi-session-ux-db56` | Sessions list, `@mentions`, polish | **Done** (v0.3.0) |
| **#4** | `cursor/sdk-bridge-stub-db56` | Optional local SDK bridge package | **Done** (v0.4.0) |

## PR #1 — Scaffold + BYOK (this PR)

**Delivers**

- `manifest.json`, esbuild, TypeScript project
- Plugin shell: ribbon, command, settings tab
- `BackendRouter` + `ByokBackend` (OpenAI-compatible streaming)
- `VaultContextBuilder` (active note + selection)
- `CursorChatView` sidebar with markdown rendering
- Single local session persistence

**Does not include**

- `cursor-rest` or SDK bridge
- Multi-session UI
- Backend switcher beyond settings dropdown (other backends show “coming soon”)

See [BYOK](../backends/byok.md) · [UX specification](../architecture/ux.md)

## PR #2 — Cursor REST

**Branch:** `cursor/cursor-rest-backend-db56` (merged in v0.2.0)

- `CursorApiClient` + `CursorRestBackend`
- `crsr_…` settings, `GET /v1/me`, agent/run lifecycle
- SSE from `GET …/runs/:runId/stream`
- Map chat thread → `bc-*` agent id

See [Cursor REST](../backends/cursor-rest.md)

## PR #3 — Shared UX

**Branch:** `cursor/multi-session-ux-db56` (merged in v0.3.0)

- Session switcher in header
- `@note` fuzzy mentions in composer
- Tool-call cards (Cursor backends)
- Privacy first-run modal

See [UX specification](../architecture/ux.md)

## PR #4 — SDK bridge (optional)

**Branch:** `cursor/sdk-bridge-stub-db56` (merged in v0.4.0)

- `bridge/` package (stub HTTP server)
- `CursorBridgeBackend` + localhost contract
- Settings: bridge URL, token, health test

See [SDK bridge](../backends/sdk-bridge.md)
