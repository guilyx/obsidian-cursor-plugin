# Backend selection — BYOK, SDK, or REST?

[← Documentation index](../index.md)

The plugin supports **multiple connection backends**. Pick based on what you need — not everything requires the Cursor SDK or even a Cursor API key.

> Related: [BYOK](../backends/byok.md) · [Cursor REST](../backends/cursor-rest.md) · [SDK bridge](../backends/sdk-bridge.md) · [Architecture design](../architecture/design.md)

## Three credential models (do not confuse them)

| Model | Key type | Where inference runs | Agent tools / MCP |
|-------|----------|----------------------|-------------------|
| **A. Cursor API key** | `crsr_…` from [Dashboard → API Keys](https://cursor.com/dashboard) | Cursor-hosted models + agent loop | Yes (cloud or local via SDK) |
| **B. LLM BYOK** | User's OpenAI / Anthropic / Scaleway / etc. key + optional base URL | Provider directly | No (plain chat completion only) |
| **C. OpenAI-compatible proxy** | Any key your proxy accepts | Your proxy | Depends on proxy |

**"BYOK" in this project means B (and optionally C)** — the user supplies their own provider credentials for simple chat.

**Cursor API key (A)** is separate: it authenticates to Cursor's agent platform (SDK + Cloud Agents API). It is still "your key", but it bills through Cursor and uses Cursor's agent stack — not a raw OpenAI passthrough.

> Cursor IDE's own BYOK (Settings → API Keys → override OpenAI base URL) is a third product surface. Agent/Edit modes with BYOK require a paid Cursor subscription. This plugin does **not** replicate that IDE settings panel; it either talks to providers directly (B) or to Cursor's API (A).

---

## Decision matrix

| Your need | Recommended backend | Credential |
|-----------|---------------------|------------|
| **Default — Cursor-native chat about notes** | `cursor-rest` | `crsr_…` |
| BYOK via OpenRouter (many models, one key) | `openai-compatible` → OpenRouter preset | OpenRouter `sk-or-…` |
| BYOK via self-hosted LiteLLM proxy | `openai-compatible` → LiteLLM preset | LiteLLM master key |
| Chat about notes, direct OpenAI key | `openai-compatible` → OpenAI preset | OpenAI `sk-…` |
| Full Cursor agent: tools, MCP, plan/agent modes, cloud VM | `cursor-rest` or `cursor-sdk-cloud` | `crsr_…` |
| Agent reads/writes vault **files on disk** (real paths) | `cursor-sdk-local` (bridge) | `crsr_…` |
| Agent works on a GitHub repo linked to vault | `cursor-rest` with `repos[]` | `crsr_…` |
| Headless / scripting / multi-agent orchestration | `cursor-sdk` (external, not in-plugin) | `crsr_…` |
| No network except to user's Ollama/LM Studio | `openai-compatible` → local base URL | None or local |
| Mobile Obsidian | `openai-compatible` or poll-based `cursor-rest` | Varies |

```mermaid
flowchart TD
  START["What do you need?"]
  START --> Q0{"Want Cursor-native\n(agents, default)?"}
  Q0 -->|Yes| REST["cursor-rest\ncrsr_…"]
  Q0 -->|No| Q1{"Full Cursor agent\n(tools, MCP, edits)?"}
  Q1 -->|No| BYOK["openai-compatible BYOK\nOpenRouter / LiteLLM / …"]
  Q1 -->|Yes| Q2{"Vault files on disk\nwithout prompt injection?"}
  Q2 -->|No| REST["cursor-rest\nCloud Agents API"]
  Q2 -->|Yes| BRIDGE["cursor-sdk-local bridge\nNode or Python sidecar"]
  REST --> Q3{"Repo / PR workflow?"}
  Q3 -->|Yes| REST_REPO["cursor-rest + repos[]"]
  Q3 -->|No| REST_NOREPO["cursor-rest no-repo agent"]
```

---

## Backend implementations

### 1. `cursor-rest` (Cursor-native — **plugin default**)

**Best for:** Cursor-native models and cloud agents without installing anything beyond Obsidian.

- Direct HTTPS to `api.cursor.com` (Cloud Agents API v1)
- SSE streaming from plugin via `fetch` + `eventsource-parser`
- `@cursor/sdk` **not** bundled in plugin
- Vault context injected into `prompt.text` (Cursor has no vault mount)

See [Cursor REST](../backends/cursor-rest.md).

### 2. `openai-compatible` (BYOK — OpenRouter / LiteLLM / …)

**Best for:** Users who prefer their own LLM gateway — OpenRouter, LiteLLM proxy, or direct OpenAI.

- Plugin calls provider's chat-completions API (streaming)
- Vault context injected in system/user messages (same `VaultContextBuilder`)
- No Cursor account required
- No agent tools, no MCP, no `bc-*` agents

Settings presets:

| Provider | Base URL | Model example |
|----------|----------|---------------|
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-sonnet-4` |
| LiteLLM | `http://127.0.0.1:4000/v1` | your proxy model name |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Custom | any | any |

See [BYOK](../backends/byok.md).

### 3. `cursor-sdk-local` (bridge — TypeScript or Python)

**Best for:** Local agent loop against the vault directory on disk — real `read_file` / `write` / `grep` on notes without pasting content into prompts.

Obsidian plugin ↔ **localhost HTTP** ↔ bridge process running `cursor-sdk`:

| Bridge | Package | Runtime | Notes |
|--------|---------|---------|-------|
| TypeScript | `@cursor/sdk` | Node ≥ 22.13 | `CursorClient.launch_bridge()` or `connect()` |
| Python | `cursor-sdk` | Python ≥ 3.10 | `CursorClient.launch_bridge()` or `connect()` |

```mermaid
flowchart LR
  OBS["Obsidian Plugin"] -->|"localhost:PORT"| BRIDGE["SDK Bridge\n(Node or Python)"]
  BRIDGE -->|"CURSOR_API_KEY"| CURSOR["Cursor API\nmodels + agent loop"]
  BRIDGE --> DISK["Vault path on disk\nlocal.cwd"]
```

Bridge exposes a thin local API (plugin-owned contract):

```
POST /agents          → Agent.create({ local: { cwd: vaultPath } })
POST /agents/:id/send → agent.send(message) → { runId }
GET  /runs/:id/stream → SSE (proxy run.stream() / run.messages())
POST /runs/:id/cancel → run.cancel()
```

User still provides **`crsr_…`** to the bridge (env or settings). The plugin never embeds the SDK.

See [SDK bridge](../backends/sdk-bridge.md).

### 4. `cursor-sdk-cloud` (bridge optional)

Cloud agents via SDK from a bridge process — useful when you want SDK ergonomics (`Agent.resume`, `run.conversation()`) without reimplementing REST.

For most users, **`cursor-rest` is enough** for cloud; bridge adds value mainly for **local** agents.

---

## Recommended default per use case

| Persona | Default backend | Why |
|---------|-----------------|-----|
| Note-taker, already has OpenAI | `openai-compatible` | Cheapest path, true BYOK |
| Cursor subscriber, wants same models as IDE | `cursor-rest` | No sidecar, agent features in cloud |
| Power user, vault-as-codebase | `cursor-sdk-local` | Agent edits files directly |
| Team automation | External `cursor-sdk` script | Out of plugin scope |

---

## Plugin settings: backend picker

```typescript
type ChatBackend =
  | "openai-compatible"   // BYOK
  | "cursor-rest"         // crsr_ key, Cloud Agents API
  | "cursor-sdk-local";   // crsr_ key + bridge URL

interface PluginSettings {
  backend: ChatBackend;
  // BYOK block
  byok?: { provider: string; apiKey: string; baseUrl: string; model: string };
  // Cursor block
  cursor?: { apiKey: string; defaultModelId?: string; bridgeUrl?: string };
}
```

Only show relevant fields per backend. **Never send BYOK keys to Cursor** or `crsr_` keys to OpenAI.

---

## What we are NOT building

| Item | Reason |
|------|--------|
| Bundling `@cursor/sdk` inside `main.js` | Node 22 + native binaries; wrong Obsidian runtime |
| Bundling `cursor-sdk` Python in plugin | Same |
| Cursor IDE settings sync | No public API for IDE-internal BYOK config |
| Tab completion | Different Cursor product surface |

---

## Phased rollout (revised)

| Phase | Backend | Deliverable |
|-------|---------|-------------|
| **1** | `cursor-rest` | Cursor-native default |
| **1b** | `openai-compatible` | BYOK via OpenRouter / LiteLLM |
| **2** | `cursor-rest` | Cursor API key + cloud agent + SSE |
| **3** | `cursor-sdk-local` | Optional bridge package + local agent mode |
| **4** | Polish | Backend switcher, unified session UI, MCP via bridge |
