# Cursor SDK backend (`cursor-sdk`)

[← Documentation index](../index.md) · [Backend model](../architecture/backend-model.md)

Uses your **Cursor API key** (`crsr_…`) with the **Cursor TypeScript SDK** — same agent platform as the IDE and CLI.

## Local vs cloud

| Setting | Runtime | How |
|---------|---------|-----|
| **`sdkRuntime: local`** (default) | `@cursor/sdk` `Agent.create({ local: { cwd } })` | Node bridge on `127.0.0.1:8765` |
| **`sdkRuntime: cloud`** | Cloud Agents REST API | `POST /v1/agents` on `api.cursor.com` |

See [Usage and billing](https://cursor.com/docs/sdk/typescript#usage-and-billing) — SDK runs use token-based pricing (SDK tag in dashboard). **Cloud Agents REST** additionally requires usage-based pricing headroom on some accounts.

### Start the local bridge

```bash
cd bridge
npm install
export CURSOR_API_KEY=crsr_…
npm run start
```

Local agent creation (what the bridge runs):

```typescript
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: {
    id: "composer-2.5",
    params: [{ id: "fast", value: "true" }],
  },
  local: { cwd: process.cwd() },
});
```

Plugin settings: **SDK runtime → Local**, **Bridge URL** `http://127.0.0.1:8765`.

## Why not `@cursor/sdk` inside the plugin?

Obsidian plugins cannot bundle Node 22 + `@cursor/sdk` native binaries. The bridge runs SDK locally; the plugin talks HTTP to the bridge (same SSE event names as Cloud Agents).

## Settings

| Field | Default | Description |
|-------|---------|-------------|
| `cursor.apiKey` | — | `crsr_…` |
| `cursor.sdkRuntime` | `local` | `local` (bridge) or `cloud` (REST) |
| `cursor.bridgeUrl` | `http://127.0.0.1:8765` | Local bridge base URL |
| `cursor.bridgeToken` | — | Optional `BRIDGE_TOKEN` |
| `cursor.defaultModelId` | — | e.g. `composer-2.5` |

## Obsidian HTTP transport

Inside the plugin, calls to `api.cursor.com` use Obsidian `requestUrl` (CORS-safe). The local bridge is reached at `localhost` and streams SSE normally.

## vs `cursor-agent` (CLI)

| | `cursor-sdk` local | `cursor-agent` |
|---|-------------------|----------------|
| Runtime | `@cursor/sdk` in Node bridge | `agent` subprocess |
| Vault files | Native `read_file` on `cwd` | CLI tools on vault |
| Setup | Run bridge + plugin | Install CLI only |
