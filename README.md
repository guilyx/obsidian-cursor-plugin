# obsidian-cursor-plugin

[![CI](https://github.com/guilyx/obsidian-cursor-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/guilyx/obsidian-cursor-plugin/actions/workflows/ci.yml)

Obsidian plugin with an **AI chat sidebar** and three backends:

| Backend | What it does |
|---------|----------------|
| **Cursor SDK** | `@cursor/sdk` on your vault (auto-started) or Cloud Agents REST |
| **Cursor Agent CLI** | `agent -p` in your vault folder |
| **LLM Gateway** | OpenRouter, LiteLLM, or any OpenAI-compatible API (BYOK) |

## Documentation

📖 **[Full documentation site](https://guilyx.github.io/obsidian-cursor-plugin/)** — built from [`.docs/`](.docs/index.md) with MkDocs Material.

| Section | Link |
|---------|------|
| Getting started | [Installation](.docs/getting-started/installation.md) · [Local dev](.docs/getting-started/local-development.md) |
| Architecture | [Backend model](.docs/architecture/backend-model.md) · [Design](.docs/architecture/design.md) |
| Backends | [Cursor SDK](.docs/backends/cursor-sdk.md) · [Cursor Agent CLI](.docs/backends/cursor-agent.md) · [LLM Gateway](.docs/backends/byok.md) |
| Development | [Guide](.docs/development/guide.md) · [Roadmap](.docs/development/roadmap.md) |

### Build docs locally

```bash
uv sync --group docs
uv run mkdocs serve
```

See [Building the docs](.docs/development/building-docs.md).

## Plugin quick start

```bash
npm install && npm run build
npm run ci    # typecheck, build, tests
```

Symlink into `.obsidian/plugins/obsidian-cursor-chat/` — details in [Installation](.docs/getting-started/installation.md).

## Status

**v0.5.0** — three-backend model, local SDK auto-start, Cursor Agent CLI, LLM gateway. See [CHANGELOG](CHANGELOG.md) and [roadmap](.docs/development/roadmap.md).

## License

[MIT](LICENSE) — Copyright (c) 2026 Erwin Lejeune
