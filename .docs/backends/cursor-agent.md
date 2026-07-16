# Cursor Agent CLI backend (`cursor-agent`)

[← Documentation index](../index.md) · [Backend model](../architecture/backend-model.md)

Runs the **Cursor Agent CLI** against your vault folder:

```bash
CURSOR_API_KEY=crsr_… agent --yolo --trust -p "your prompt"
```

## Flags

| Flag | When | Purpose |
|------|------|---------|
| `--yolo` / `--force` | `yoloMode` on (default) | Auto-approve shell commands |
| `--trust` | `yoloMode` on (default) | Trust workspace without prompting |
| `-p` | always | Non-interactive print mode |

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
| `cursorAgent.yoloMode` | `true` | Pass `--yolo --trust` to skip confirmations |

## Requirements

- **Desktop only** (`isDesktopOnly: true`)
- **Local folder vault** — plugin passes vault path as `cwd`
- CLI must be on `PATH` (or set full path in settings)

## Limitations (v0.5)

- Non-streaming: waits for full `agent -p` output
- Long runs may need timeout tuning

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| `Connection lost, reconnecting to agentn.global.api*.cursor.sh` | Cursor CLI cloud endpoint hiccup | Wait and **Retry**; if persistent, switch header backend to **Cursor SDK** |
| `resource_exhausted` | Rate limit or plan usage cap | Wait, check Cursor billing; use **Cursor SDK** or **LLM gateway** |
| Empty output | No API key / not logged in | Set `crsr_…` in settings or run `agent login` in a terminal |

The CLI still talks to Cursor's cloud (`agentn.global.api*.cursor.sh`) even though it runs locally — outages or limits on Cursor's side affect this backend too.

## vs `cursor-sdk`

| | `cursor-sdk` | `cursor-agent` |
|---|-------------|----------------|
| API key | Yes (`crsr_…`) | Yes (same setting, via env) |
| Runs where | Cursor API (HTTP) | Local machine (CLI subprocess) |
| Vault file tools | Prompt injection only | CLI can edit vault files |
