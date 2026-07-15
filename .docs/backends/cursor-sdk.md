# Cursor SDK backend (`cursor-sdk`)

[← Documentation index](../index.md) · [Backend model](../architecture/backend-model.md)

Uses your **Cursor API key** (`crsr_…`) to run agents on Cursor's platform — the same Cloud Agents API that `@cursor/sdk` uses for cloud runs.

## Why not `@cursor/sdk` inside the plugin?

Obsidian plugins run in a browser-like renderer. The Cursor TypeScript SDK requires Node. The plugin therefore calls **`api.cursor.com/v1`** directly (HTTPS + SSE) — functionally equivalent to SDK cloud agents.

## Settings

| Field | Description |
|-------|-------------|
| `cursor.apiKey` | `crsr_…` from Dashboard → Integrations |
| `cursor.defaultModelId` | Optional model id |
| `cursor.defaultMode` | `plan` or `agent` |

## API surface

See [Cursor REST](cursor-rest.md) for endpoint details (same HTTP API).

## Sessions

Chat threads map to `bc-*` agent ids stored in `ChatSession.cursorAgentId`.
