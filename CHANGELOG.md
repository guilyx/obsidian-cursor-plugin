# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
