# obsidian-cursor-plugin

Obsidian plugin that embeds a **Cursor-powered AI chat** in the vault sidebar, connected via the [Cursor Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) and API key authentication.

## Status

**Design phase** — architecture and development docs are in place; implementation not started.

## What it will do

- Sidebar chat view inside Obsidian
- Multi-turn conversations backed by Cursor **agents** (`bc-*`) and **runs**
- Streaming assistant replies over SSE
- Vault context injection (active note, selection, `@mentions`)
- API key configuration with connection test (`GET /v1/me`)

## What it is not

- Not a mirror of the Cursor IDE composer window
- Not an OpenAI-compatible chat-completions proxy
- Not using `@cursor/sdk` inside Obsidian (Node-only; wrong runtime)

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/README.md](./docs/README.md) | Documentation index |
| [docs/DESIGN.md](./docs/DESIGN.md) | Architecture, components, security, phased delivery |
| [docs/API-INTEGRATION.md](./docs/API-INTEGRATION.md) | Cursor API endpoints, auth, streaming |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Project layout, toolchain, implementation checklist |
| [docs/UX.md](./docs/UX.md) | Chat UI specification |

## Quick architecture

```
Obsidian Chat View → VaultContextBuilder → CursorApiClient → api.cursor.com
                              ↓
                       ChatSessionManager (local persistence)
```

Each chat thread maps to one Cursor Cloud Agent. Messages are sent as `prompt.text`; replies stream from `GET …/runs/:runId/stream`.

## Prerequisites (for future development)

- Cursor account with API key ([Dashboard → API Keys](https://cursor.com/dashboard))
- Obsidian ≥ 1.5 (desktop)
- Node.js for building the plugin

## License

TBD
