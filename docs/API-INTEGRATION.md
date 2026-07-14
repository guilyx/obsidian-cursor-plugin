# Cursor API integration (`cursor-rest` backend)

Reference for the **`cursor-rest`** backend: Cloud Agents API v1 over HTTPS from the Obsidian plugin.

> **Not the only path.** For BYOK (OpenAI/Anthropic direct), see [BYOK.md](./BYOK.md). For local agents with filesystem access, see [SDK-BRIDGE.md](./SDK-BRIDGE.md). Decision guide: [BACKEND-SELECTION.md](./BACKEND-SELECTION.md).

**Primary source:** [Cloud Agents API v1](https://cursor.com/docs/cloud-agent/api/endpoints) (public beta).

**SDK alternative:** [@cursor/sdk](https://cursor.com/docs/sdk/typescript) (TypeScript) and [`cursor-sdk`](https://cursor.com/docs/sdk/python) (Python) wrap the same platform — use via [SDK-BRIDGE.md](./SDK-BRIDGE.md) when you need local `cwd` or SDK ergonomics, not inside the plugin bundle.

---

## Authentication

### API key

1. Open [Cursor Dashboard → API Keys](https://cursor.com/dashboard)
2. Create a **user API key** or **service account** key (teams)
3. Copy once — format `crsr_…`

### HTTP headers

```http
Authorization: Bearer crsr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

Basic auth (`-u KEY:`) is also accepted; Bearer is preferred in plugin code.

### Validate on setup

```http
GET https://api.cursor.com/v1/me
```

Use response to show account email / team in settings confirmation.

---

## Endpoints used by the plugin

| Operation | Method | Path | When |
|-----------|--------|------|------|
| Validate key | `GET` | `/v1/me` | Settings test |
| List models | `GET` | `/v1/models` | Model picker populate |
| Create thread | `POST` | `/v1/agents` | First message in new chat |
| Follow-up | `POST` | `/v1/agents/{id}/runs` | Subsequent messages |
| Stream reply | `GET` | `/v1/agents/{id}/runs/{runId}/stream` | After run created |
| Run status | `GET` | `/v1/agents/{id}/runs/{runId}` | Stream expired / polling |
| Cancel | `POST` | `/v1/agents/{id}/runs/{runId}/cancel` | User clicks Stop |
| Usage (optional) | `GET` | `/v1/agents/{id}/usage` | Token display |
| List agents (optional) | `GET` | `/v1/agents` | Recover orphaned threads |

---

## Create agent (new chat thread)

**Vault chat (default)** — no repository:

```json
POST /v1/agents
{
  "name": "Obsidian: Weekly review",
  "mode": "plan",
  "model": { "id": "composer-2.5" },
  "prompt": {
    "text": "<assembled vault context + user message>"
  }
}
```

Omit both `repos` and `env` for a **no-repo agent** suitable for note Q&A.

**Repo-linked chat (optional):**

```json
{
  "prompt": { "text": "…" },
  "repos": [
    {
      "url": "https://github.com/org/vault-notes",
      "startingRef": "main"
    }
  ],
  "workOnCurrentBranch": false,
  "autoCreatePR": false
}
```

Response includes both `agent` and initial `run`:

```json
{
  "agent": {
    "id": "bc-00000000-0000-0000-0000-000000000001",
    "status": "ACTIVE",
    "url": "https://cursor.com/agents/bc-…",
    "latestRunId": "run-…"
  },
  "run": {
    "id": "run-00000000-0000-0000-0000-000000000001",
    "status": "CREATING"
  }
}
```

Store `agent.id` in `ChatSession.cursorAgentId`.

---

## Follow-up message

```json
POST /v1/agents/{agentId}/runs
{
  "prompt": {
    "text": "<context prefix + user message>"
  },
  "mode": "plan"
}
```

**Constraint:** only one run `CREATING` or `RUNNING` per agent → `409 agent_busy` if user sends too fast.

---

## Streaming (SSE)

```http
GET /v1/agents/{agentId}/runs/{runId}/stream
Accept: text/event-stream
Authorization: Bearer crsr_…
```

### Event types (simplified)

| Event | Payload | Plugin action |
|-------|---------|---------------|
| `status` | `{ runId, status }` | Update run badge |
| `assistant` | `{ text }` | Append to assistant bubble |
| `thinking` | `{ text }` | Optional collapsible (if `showThinking`) |
| `tool_call` | `{ callId, name, status, args?, result? }` | Render tool card |
| `result` | `{ runId, status, text?, durationMs? }` | Finalize message |
| `error` | `{ code, message }` | Show error toast |
| `done` | `{}` | Close stream reader |
| `heartbeat` | `{}` | Ignore |

### Resume

Reconnect with:

```http
Last-Event-ID: <opaque id from last event>
```

Invalid id → `400 invalid_last_event_id`.  
Retention elapsed → `410 stream_expired` → fall back to `GET …/runs/{runId}`.

### Parser sketch

```typescript
import { createParser, type EventSourceMessage } from "eventsource-parser";

async function* streamRun(url: string, apiKey: string): AsyncGenerator<StreamEvent> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
  });
  if (!res.ok || !res.body) throw new ApiError(res.status, await res.text());

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let eventType = "";

  const parser = createParser({
    onEvent(msg: EventSourceMessage) {
      eventType = msg.event ?? "message";
      // yield parsed JSON from msg.data — handled in generator wrapper
    },
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
    // dispatch yields from onEvent via queue
  }
}
```

> **Obsidian note:** `requestUrl` does not stream. Desktop Electron generally allows `fetch` to `api.cursor.com`; verify during Phase 1. Mobile may require polling `GET run` until Obsidian adds streamable requests.

---

## Models

```http
GET https://api.cursor.com/v1/models
```

Each model entry includes `id` and optional `params` (e.g. reasoning effort). Populate settings dropdown; pass selected id as:

```json
"model": { "id": "composer-2.5", "params": [{ "id": "fast", "value": "true" }] }
```

Omit `model` entirely to let Cursor resolve user → team → system default.

---

## Rate limits & billing

- Cloud Agents API is **beta**; rate limits apply (see [API overview](https://cursor.com/docs/api))
- Usage bills to the key owner (user plan or service account team)
- Per-run tokens available via `/v1/agents/{id}/usage`

---

## Type definitions (plugin-local)

Keep types in `src/types/cursor-api.ts` — do not import `@cursor/sdk` at runtime. Mirror OpenAPI shapes for:

- `Agent`, `Run`, `RunStatus` (`CREATING` | `RUNNING` | `FINISHED` | `ERROR` | `CANCELLED` | `EXPIRED`)
- `CreateAgentRequest`, `CreateRunRequest`
- `StreamEvent` discriminated union

Regenerate or diff when Cursor publishes OpenAPI updates.

---

## Error code reference

| Code / status | Handling |
|---------------|----------|
| `401` | `InvalidApiKeyError` → settings |
| `403` | `InsufficientScopeError` |
| `404` `run_not_found` | Stale UI — drop run id |
| `409` `agent_busy` | Queue or cancel current run |
| `409` `agent_id_conflict` | Client supplied duplicate `agentId` |
| `409` `run_not_cancellable` | Refresh terminal state |
| `410` `stream_expired` | Poll `GET run` |
| `429` | Exponential backoff |

---

## What this API is *not*

| Expectation | Reality |
|-------------|---------|
| OpenAI-compatible `/v1/chat/completions` | **No** — use [BYOK backend](./BYOK.md) instead |
| BYOK OpenAI key through Cursor | **No** — use provider-direct BYOK or Cursor `crsr_` key |
| Live sync with Cursor IDE chat tabs | **No** — separate agent instances |
| Direct vault file tools (REST only) | **No** — inject context in `prompt.text` or use [SDK bridge](./SDK-BRIDGE.md) |
| In-plugin `@cursor/sdk` | **No** — runs in optional bridge process |
