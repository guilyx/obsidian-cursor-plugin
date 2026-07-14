# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **PR #1 implementation:** plugin scaffold (esbuild, TypeScript, manifest)
- BYOK backend (`openai-compatible`) with OpenAI-compatible streaming chat
- Sidebar `CursorChatView` with markdown rendering, send/stop, new chat
- Settings tab: API key, base URL, model, temperature, context options
- `VaultContextBuilder` (active note + editor selection)
- `BackendRouter` stub for future `cursor-rest` / SDK bridge
- Local session persistence in plugin data
- SSE parser self-check script (`npm run check:sse`)
- Multi-PR roadmap: see `.docs/development/roadmap.md`

### Changed

- Documentation moved to `.docs/` with MkDocs Material site and GitHub Pages workflow

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
