# Overview

**Cursor Chat** is an Obsidian community plugin that adds a sidebar for AI-assisted note work. It is designed as a small, pluggable system: one chat UI, multiple backends.

## What it does today (v0.5.0)

- Sidebar chat with streaming replies and selectable message text
- **Three backends:** Cursor SDK (local auto-start or cloud REST), Cursor Agent CLI, LLM gateway (OpenRouter / LiteLLM / BYOK)
- Setup wizard and backend switcher in settings
- Multi-session chat with `@note` mentions and vault context
- Local SDK server auto-started from the plugin (no manual bridge terminal)

## Architecture at a glance

```
Obsidian Chat View → BackendRouter → cursor-sdk | cursor-agent | llm-gateway
                          ↓
                   VaultContextBuilder
```

Full design: [Backend model](../architecture/backend-model.md) · [System design](../architecture/design.md).

## Choose your backend

Not sure which path fits? Read [Backend model](../architecture/backend-model.md) first.

## License

[MIT](https://github.com/guilyx/obsidian-cursor-plugin/blob/main/LICENSE) — Copyright (c) 2026 Erwin Lejeune
