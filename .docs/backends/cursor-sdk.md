# Cursor SDK backend (`cursor-sdk`)

[← Documentation index](../index.md) · [Backend model](../architecture/backend-model.md)

Uses your **Cursor API key** (`crsr_…`) to **call Cursor agents through the API** — the same agent platform as the Cursor IDE and `@cursor/sdk`. Not limited to “cloud only”; agent runtime depends on how the agent is created (API supports local and cloud configurations via SDK; the plugin uses the HTTP API surface).

## Why not `@cursor/sdk` inside the plugin?

Obsidian plugins run in a browser-like renderer. The Cursor TypeScript SDK requires Node. The plugin calls **`api.cursor.com/v1`** directly (HTTPS + SSE) — the same API the SDK uses to drive agents programmatically.

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
