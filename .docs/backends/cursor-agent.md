# Cursor Agent CLI backend (`cursor-agent`)

[← Documentation index](../index.md) · [Backend model](../architecture/backend-model.md)

Runs the **Cursor Agent CLI** against your vault folder:

```bash
agent -p "your prompt"
```

## Authentication

No API key in the plugin. The CLI uses:

1. **`agent login`** — Cursor subscription session on this machine (recommended), or
2. **`CURSOR_API_KEY`** in the shell environment (for automation)

## Install

```bash
curl https://cursor.com/install -fsS | bash
agent login
```

## Settings

| Field | Default | Description |
|-------|---------|-------------|
| `cursorAgent.cliPath` | `agent` | Executable name or full path |

## Requirements

- **Desktop only** (`isDesktopOnly: true`)
- **Local folder vault** — plugin passes vault path as `cwd`
- CLI must be on `PATH` (or set full path in settings)

## Limitations (v0.5)

- Non-streaming: waits for full `agent -p` output
- Long runs may need timeout tuning
- Automated environments without TTY may need `agent login` beforehand

## vs `cursor-sdk`

| | `cursor-sdk` | `cursor-agent` |
|---|-------------|----------------|
| Key in plugin | Yes (`crsr_…`) | No |
| Runs where | Cursor cloud | Local machine |
| Vault file tools | Prompt injection only | CLI can edit vault files |
