# Development guide

How to implement **obsidian-cursor-plugin** after the design docs.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 (22+ only if you work on optional local bridge) |
| Obsidian | ≥ 1.5 (desktop for v1) |
| Cursor account | API key with Cloud Agents access |
| Git | clone this repo |

## Planned project layout

```
obsidian-cursor-plugin/
├── manifest.json
├── versions.json
├── package.json
├── esbuild.config.mjs
├── tsconfig.json
├── CHANGELOG.md
├── README.md
├── docs/
│   ├── DESIGN.md
│   ├── API-INTEGRATION.md
│   ├── DEVELOPMENT.md
│   └── UX.md
├── src/
│   ├── main.ts                 # Plugin entry
│   ├── constants.ts            # API_BASE, VIEW_TYPE
│   ├── settings/
│   │   ├── CursorSettings.ts
│   │   └── CursorSettingsTab.ts
│   ├── views/
│   │   ├── CursorChatView.ts
│   │   └── chat/
│   │       ├── MessageList.ts
│   │       ├── Composer.ts
│   │       └── ToolCallCard.ts
│   ├── api/
│   │   ├── CursorApiClient.ts
│   │   ├── SseReader.ts
│   │   └── errors.ts
│   ├── context/
│   │   └── VaultContextBuilder.ts
│   ├── session/
│   │   └── ChatSessionManager.ts
│   └── types/
│       ├── cursor-api.ts
│       └── chat.ts
└── styles.css
```

## Toolchain

Use **esbuild** (Obsidian community standard) — single `main.js` output.

### package.json (planned)

```json
{
  "name": "obsidian-cursor-plugin",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production"
  },
  "devDependencies": {
    "@types/node": "^22",
    "builtin-modules": "^5",
    "esbuild": "^0.25",
    "obsidian": "latest",
    "typescript": "^5.8"
  },
  "dependencies": {
    "eventsource-parser": "^3"
  }
}
```

### manifest.json (planned)

```json
{
  "id": "obsidian-cursor-chat",
  "name": "Cursor Chat",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "AI chat sidebar powered by the Cursor Cloud Agents API.",
  "author": "Erwin Lejeune",
  "isDesktopOnly": true
}
```

Set `isDesktopOnly: true` until mobile streaming is solved.

## Local development loop

1. `npm install`
2. `npm run dev` — watch build to `main.js`
3. Symlink or copy into vault:
   ```bash
   ln -s "$(pwd)" "/path/to/vault/.obsidian/plugins/obsidian-cursor-chat"
   ```
4. Enable plugin in Obsidian → Community plugins
5. Open DevTools (`Ctrl+Shift+I`) for console errors
6. Reload plugin after changes: disable → enable, or use Hot Reload plugin

## Implementation checklist

### Settings

- [ ] `PluginSettingTab` with masked API key field
- [ ] **Test connection** → `GET /v1/me`
- [ ] **Load models** → `GET /v1/models` on tab open
- [ ] Persist `DEFAULT_SETTINGS` merge pattern

### API client

- [ ] `CursorApiClient` class with injectable `request` fn (for tests)
- [ ] Unified `Authorization` header builder
- [ ] `SseReader` async generator
- [ ] Typed errors mapping HTTP status

### Chat view

- [ ] Register `CURSOR_CHAT_VIEW` in `onload`
- [ ] `getViewType()`, `getDisplayText()`, `getIcon()` → `"message-square"`
- [ ] Message list with `MarkdownRenderer.render` for assistant content
- [ ] Composer: Enter to send, Shift+Enter newline
- [ ] Stop button → `cancelRun` + `AbortController` on fetch

### Sessions

- [ ] `ChatSessionManager` in plugin `data`
- [ ] New chat → local session only; create Cursor agent on first send
- [ ] Thread switcher in header (Phase 2)

### Vault context

- [ ] Read active `MarkdownView` file via `app.workspace.getActiveFile()`
- [ ] `VaultContextBuilder.build()` with char budget
- [ ] Command: *Cursor: Send selection to chat*

### CSS

- [ ] Use Obsidian CSS variables (`--background-primary`, `--text-normal`, `--interactive-accent`)
- [ ] See [UX.md](./UX.md)

## Testing strategy

| Layer | Approach |
|-------|----------|
| `CursorApiClient` | Mock `fetch` with recorded SSE fixtures |
| `SseReader` | Unit test parser against sample stream from API docs |
| `VaultContextBuilder` | Mock `App` / `TFile` |
| E2E | Manual in Obsidian with test API key |

No colcon / ROS — not applicable.

### Minimal self-check (ponytail)

```typescript
// src/api/sse-self-check.ts — assert parser handles sample chunk
import { parseSseChunk } from "./SseReader";
const sample = 'event: assistant\ndata: {"text":"hi"}\n\n';
console.assert(parseSseChunk(sample)?.text === "hi");
```

Run once in dev build or as a node script over compiled parser.

## Coding conventions

- TypeScript strict mode
- Match existing Obsidian plugin patterns (`obsidian-sample-plugin`)
- No React in v1 unless message list complexity demands it
- Comment non-obvious SSE resume and `409` handling only
- Update `CHANGELOG.md` under `[Unreleased]` for every user-visible change

## API key handling in dev

```bash
# Do not commit keys. For local testing only:
export CURSOR_API_KEY="crsr_…"
```

Plugin stores key in vault plugin data — use a **dedicated dev key** with minimal scope.

## Release

1. Bump `manifest.json` + `versions.json`
2. `npm run build`
3. Tag release; attach `main.js`, `manifest.json`, `styles.css`
4. Submit to Obsidian Community Plugin store (separate process)

## Related reading

- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Cursor Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints)
- [Cursor API overview](https://cursor.com/docs/api)
