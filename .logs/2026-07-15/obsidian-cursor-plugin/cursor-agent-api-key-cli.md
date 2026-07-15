# Cursor Agent CLI — API key auth

**Date:** 2026-07-15  
**Branch:** `cursor/cursor-default-openrouter-byok-db56`  
**PR:** #8

## Done

- `CursorAgentCliBackend` injects `CURSOR_API_KEY` from `settings.cursor.apiKey` when spawning `agent`
- Settings tab + setup wizard: shared API key field for `cursor-agent` backend
- Chat status line shows "API key set" vs "login or API key"
- Tests: `validate --version`, `CURSOR_API_KEY` env assertion (42 tests pass)
- Docs + changelog updated

**Note:** Obsidian log target `/home/wardn/Apps/Obsidian/...` not writable in cloud env; copy this file if needed.
