# obsidian-cursor-plugin — Documentation

Design and development documentation for an Obsidian plugin with a **pluggable AI chat backend**.

## Start here

**[BACKEND-SELECTION.md](./BACKEND-SELECTION.md)** — BYOK vs Cursor REST vs SDK bridge: which path fits your need.

## Documents

| Document | Purpose |
|----------|---------|
| [BACKEND-SELECTION.md](./BACKEND-SELECTION.md) | Decision matrix: BYOK, `cursor-rest`, `cursor-sdk-local` |
| [BYOK.md](./BYOK.md) | Provider-direct chat (OpenAI-compatible, true bring-your-own-key) |
| [API-INTEGRATION.md](./API-INTEGRATION.md) | Cursor Cloud Agents API (`crsr_…` key, REST + SSE) |
| [SDK-BRIDGE.md](./SDK-BRIDGE.md) | Optional Node/Python sidecar using `@cursor/sdk` / `cursor-sdk` |
| [DESIGN.md](./DESIGN.md) | Full architecture, components, security, phased delivery |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Project layout, toolchain, implementation checklist |
| [UX.md](./UX.md) | Chat UI specification |

## Three backends (one plugin)

| Backend | Key | Best for |
|---------|-----|----------|
| `openai-compatible` | Provider BYOK (`sk-…`) | Simple note Q&A, no Cursor account |
| `cursor-rest` | Cursor API key (`crsr_…`) | Cloud agents, MCP, plan/agent modes |
| `cursor-sdk-local` | `crsr_…` on bridge | Agent reads/edits vault files on disk |

## Status

**Design phase** — documentation complete; implementation not started.
