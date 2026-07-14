# obsidian-cursor-plugin — Documentation

Design and development documentation for an Obsidian plugin that embeds a Cursor-powered AI chat in the vault sidebar.

## Documents

| Document | Purpose |
|----------|---------|
| [DESIGN.md](./DESIGN.md) | Architecture, components, data model, security, and phased delivery |
| [API-INTEGRATION.md](./API-INTEGRATION.md) | Cursor Cloud Agents API mapping, auth, streaming, and error handling |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Project layout, toolchain, build workflow, and implementation checklist |
| [UX.md](./UX.md) | Chat UI specification, interactions, and Obsidian integration points |

## Quick summary

The plugin exposes a **sidebar chat view** in Obsidian. Each conversation maps to a **Cursor Cloud Agent** (`bc-*` id). Messages are sent via the [Cloud Agents API v1](https://cursor.com/docs/cloud-agent/api/endpoints); responses stream back over **SSE**.

Vault context (active note, selection, linked notes) is **injected into prompts** on the Obsidian side — Cursor does not mount the vault filesystem directly.

Authentication uses a **Cursor user or service-account API key** (`crsr_…`) configured in plugin settings.

## Status

**Design phase** — no implementation yet. See [DESIGN.md § Phased delivery](./DESIGN.md#phased-delivery) for the build order.
