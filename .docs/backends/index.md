# Backends

The plugin routes all chat traffic through a **`BackendRouter`**. Each backend implements the same `ChatBackend` interface (`validate`, `send` streaming).

## Comparison

| Backend | ID | Credential | Agent tools | Vault on disk |
|---------|-----|------------|-------------|---------------|
| [BYOK](byok.md) | `openai-compatible` | Provider `sk-…` | No | Context in prompts only |
| [Cursor REST](cursor-rest.md) | `cursor-rest` | `crsr_…` | Yes (cloud) | Context in prompts only |
| [SDK bridge](sdk-bridge.md) | `cursor-sdk-local` | `crsr_…` on sidecar | Yes (local) | `local.cwd` = vault path |

## Selection guide

Start with [Backend selection](../architecture/backend-selection.md) if you are unsure which to use or implement.

## Implementation status

| Backend | Status |
|---------|--------|
| BYOK | **Shipped** in v0.1.0 |
| Cursor REST | PR #2 |
| SDK bridge | PR #4 |
