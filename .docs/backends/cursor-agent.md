# Cursor Agent CLI backend (`cursor-agent`)

[← Documentation index](../index.md) · [Backend model](../architecture/backend-model.md)

Runs the **Cursor Agent CLI** against your vault folder:

```bash
CURSOR_API_KEY=crsr_… agent -p "your prompt"
```

## Authentication

The plugin passes your **Cursor API key** (`crsr_…`) to the CLI as `CURSOR_API_KEY` when set in settings (shared with the `cursor-sdk` backend).

Fallback if no key is configured:

1. **`agent login`** — Cursor session on this machine

## Install

```bash
curl https://cursor.com/install -fsS | bash
```

## Settings

| Field | Default | Description |
|-------|---------|-------------|
| `cursor.apiKey` | — | `crsr_…` — injected as `CURSOR_API_KEY` for the CLI |
| `cursorAgent.cliPath` | `agent` | Executable name or full path |

## Requirements

- **Desktop only** (`isDesktopOnly: true`)
- **Local folder vault** — plugin passes vault path as `cwd`
- CLI must be on `PATH` (or set full path in settings)

## Limitations (v0.5)

- Non-streaming: waits for full `agent -p` output
- Long runs may need timeout tuning

## vs `cursor-sdk`

| | `cursor-sdk` | `cursor-agent` |
|---|-------------|----------------|
| API key | Yes (`crsr_…`) | Yes (same setting, via env) |
| Runs where | Cursor API (HTTP) | Local machine (CLI subprocess) |
| Vault file tools | Prompt injection only | CLI can edit vault files |
