# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`cursor-agent` yolo mode** — passes `--yolo` and `--trust` to skip CLI confirmation prompts (toggle in settings)
- **Cursor API integration tests** — live tests against `api.cursor.com` when `CURSOR_API_KEY` is set (CI secret)
- **Obsidian HTTP transport** — SDK backend uses `requestUrl` (bypasses CORS) and polls `GET /runs/:id` when streaming is unavailable

### Fixed

- **SDK backend in Obsidian** — was using `fetch` which often fails in the plugin sandbox; now uses `requestUrl` + polling
- **SDK empty replies** — fall back to polling when SSE stream ends without assistant text, on `410`, or on network errors
- **Chat text selection** — message bubbles are selectable/copyable in the chat sidebar

### Changed

- Default Cursor SDK mode: `plan` → `agent` (better for direct Q&A)

## [0.5.0] - 2026-07-15

### Added

- **Three-backend model** with clear user-facing names:
  - `cursor-sdk` — Cursor agent via API key (`crsr_…`)
  - `cursor-agent` — Cursor Agent CLI (`agent -p`), machine login
  - `llm-gateway` — OpenRouter / LiteLLM / BYOK
- **Set up Cursor Chat** command + setup wizard modal
- Auto-open setup wizard on first chat until configured
- Architecture doc: [Backend model (v0.5+)](.docs/architecture/backend-model.md)

### Changed

- **BREAKING:** Renamed backend IDs (`cursor-rest` → `cursor-sdk`, etc.) with automatic migration on load
- Removed stub SDK bridge from router (CLI replaces it for local agent use)
- Default backend: `cursor-sdk`

### Removed

- User-facing `cursor-sdk-local` bridge backend (bridge package kept for future sidecar)

## [0.4.0] - 2026-07-14

### Added

- **SDK bridge stub** (`cursor-sdk-local`) — `bridge/` package with health + mock SSE server
- `BridgeApiClient` + `CursorBridgeBackend` wired through `BackendRouter`
- Settings: bridge URL, bridge token, health test via `GET /health`
- Vault path passed to bridge on agent create (local folder vaults only)

### Notes

- Bridge is a **stub** — full `@cursor/sdk` integration is a follow-up; stub returns a demo assistant message

## [0.3.0] - 2026-07-14

### Added

- **Session switcher** in chat header (dropdown + new chat)
- **@mention** fuzzy file picker — attach notes as context chips
- **Context chips** for active note, selection, and @attachments
- **Tool-call cards** for Cursor REST SSE `tool_call` events
- **Privacy first-run modal** with settings shortcut
- Streaming cursor animation on assistant bubble

### Changed

- `VaultContextBuilder` accepts attached note paths from @mentions
- Thinking blocks render as collapsible `<details>` when enabled

## [0.2.0] - 2026-07-14

### Added

- **Cursor REST backend** (`cursor-rest`) via Cloud Agents API v1
- `CursorApiClient` — `me`, `listModels`, agent/run lifecycle, SSE stream
- `CursorRestBackend` — maps chat sessions to `bc-*` agents, streams replies
- Cursor SSE parser (`assistant`, `result`, `error`, `done`; `410` → poll `GET run`)
- Settings: Cursor API key (`crsr_…`), model, mode, show thinking, test via `GET /v1/me`
- Session persistence of `cursorAgentId` per chat thread
- Stop button cancels in-flight Cursor runs

### Changed

- `BackendRouter` wires `cursor-rest`; SDK bridge still stubbed
- New chats use the currently selected backend
- Settings tab split by backend (BYOK vs Cursor REST)

## [0.1.0] - 2026-07-14

### Added

- Obsidian vault MOC with wikilinks (`docs/` — superseded by `.docs/` MkDocs site)
- Cross-linked **See also** sections on every design note
- YAML frontmatter (title, tags, aliases, parent) on all `docs/*.md`
- Backend selection guide (`docs/BACKEND-SELECTION.md`)
- BYOK, SDK bridge, API integration, design, development, UX docs

### Changed

- Default recommended backend: **BYOK** (`openai-compatible`) for Phase 1
- Cursor SDK documented as optional sidecar
- Phased delivery: BYOK → REST → bridge
