# Overview

**Cursor Chat** is an Obsidian community plugin that adds a sidebar for AI-assisted note work. It is designed as a small, pluggable system: one chat UI, multiple backends.

## What it does today (v0.1.0)

- Sidebar chat view with streaming replies
- **BYOK** mode — OpenAI-compatible APIs (`/chat/completions`)
- Injects **vault context** (active note, editor selection) into prompts
- Settings tab with connection test
- Local session persistence

## What is coming

| Phase | Feature |
|-------|---------|
| PR #2 | Cursor REST (`crsr_…`, Cloud Agents API) |
| PR #3 | Multi-session UI, `@note` mentions |
| PR #4 | Optional Cursor SDK localhost bridge |

Details: [Implementation roadmap](../development/roadmap.md).

## Architecture at a glance

```
Obsidian Chat View → BackendRouter → BYOK | cursor-rest | SDK bridge
                          ↓
                   VaultContextBuilder
```

Full design: [System design](../architecture/design.md).

## Choose your backend

Not sure which path fits? Read [Backend selection](../architecture/backend-selection.md) first.
