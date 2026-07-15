# Backends

The plugin routes all chat traffic through a **`BackendRouter`**. Each backend implements the same `ChatBackend` interface (`validate`, `send` streaming).

> **v0.5 model:** [Backend model (v0.5+)](../architecture/backend-model.md) · [Backend selection](../architecture/backend-selection.md)

| Backend | ID | Credential | Agent tools |
|---------|-----|------------|-------------|
| [Cursor SDK](cursor-sdk.md) | `cursor-sdk` | `crsr_…` | Yes (cloud) |
| [Cursor Agent CLI](cursor-agent.md) | `cursor-agent` | CLI login | Yes (local vault) |
| [LLM gateway](byok.md) | `llm-gateway` | Provider keys | No |

Legacy docs for [Cursor REST](cursor-rest.md) and [SDK bridge](sdk-bridge.md) describe implementation details superseded by the v0.5 naming.
