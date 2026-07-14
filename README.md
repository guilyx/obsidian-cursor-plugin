# obsidian-cursor-plugin

Obsidian plugin that embeds an **AI chat sidebar** with **pluggable backends**.

## Documentation

### In Obsidian

Open the `docs/` folder in your vault and start at **[[docs/Home|Home]]** (map of content with wikilinks).

### On GitHub

| Doc | Description |
|-----|-------------|
| [docs/Home.md](docs/Home.md) | **Obsidian MOC** — linked index |
| [docs/BACKEND-SELECTION.md](docs/BACKEND-SELECTION.md) | BYOK vs Cursor REST vs SDK bridge |
| [docs/BYOK.md](docs/BYOK.md) | Provider-direct BYOK |
| [docs/API-INTEGRATION.md](docs/API-INTEGRATION.md) | Cursor REST / Cloud Agents API |
| [docs/SDK-BRIDGE.md](docs/SDK-BRIDGE.md) | TypeScript / Python SDK sidecar |
| [docs/DESIGN.md](docs/DESIGN.md) | Full architecture |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Build guide |
| [docs/UX.md](docs/UX.md) | UI spec |

## Three backends

| Backend | Credential | Doc |
|---------|------------|-----|
| **BYOK** (`openai-compatible`) | Your provider key | [BYOK](docs/BYOK.md) |
| **Cursor REST** (`cursor-rest`) | Cursor API key (`crsr_…`) | [API-INTEGRATION](docs/API-INTEGRATION.md) |
| **SDK bridge** (`cursor-sdk-local`) | `crsr_…` on sidecar | [SDK-BRIDGE](docs/SDK-BRIDGE.md) |

**Pick your path:** [BACKEND-SELECTION](docs/BACKEND-SELECTION.md)

## Status

**v0.1.0 — BYOK MVP** (PR #1 in progress). See [docs/IMPLEMENTATION-ROADMAP.md](docs/IMPLEMENTATION-ROADMAP.md) for multi-PR plan.

### Build

```bash
npm install
npm run build      # → main.js
npm run check:sse  # SSE parser self-check
```

Symlink this folder into `Vault/.obsidian/plugins/obsidian-cursor-chat/` (needs `main.js`, `manifest.json`, `styles.css`).

## License

TBD
