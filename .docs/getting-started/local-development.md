# Local development

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | comes with Node |
| Obsidian | ≥ 1.5 desktop |
| Git | any recent |

Optional for documentation site:

| Tool | Purpose |
|------|---------|
| [uv](https://github.com/astral-sh/uv) | Python env for MkDocs |
| Python | ≥ 3.10 |

## Plugin dev loop

```bash
npm install
npm run dev    # watch — rebuilds main.js on save
```

Symlink the repo into a dev vault:

```bash
ln -s "$(pwd)" "/path/to/dev-vault/.obsidian/plugins/obsidian-cursor-chat"
```

In Obsidian:

1. Enable **Cursor Chat** under Community plugins
2. After TypeScript changes: **Command palette → Reload app without saving**, or toggle the plugin off/on
3. Optional: [Hot-Reload](https://github.com/pjeby/hot-reload) plugin for automatic reloads

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | esbuild watch mode |
| `npm run build` | production `main.js` |
| `npm run check:sse` | SSE parser self-check |

## Project layout

```
obsidian-cursor-plugin/
├── manifest.json
├── main.js              # build output (gitignored)
├── styles.css
├── src/
│   ├── main.ts
│   ├── backends/
│   ├── views/
│   └── …
└── .docs/               # this documentation site
```

Full checklist: [Development guide](../development/guide.md).

## Documentation site

Build and preview locally:

```bash
uv sync --group docs
uv run mkdocs serve
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

Deploy (GitHub Actions): push to `main` — see `.github/workflows/docs.yml`.

Details: [Building the docs](../development/building-docs.md).

## API keys in dev

Never commit secrets. Use a dedicated provider key with minimal scope.

```bash
# Example — plugin stores keys in vault plugin data, not env; for bridge work later:
export CURSOR_API_KEY="crsr_…"
```
