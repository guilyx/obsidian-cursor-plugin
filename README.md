# obsidian-cursor-plugin

[![CI](https://github.com/guilyx/obsidian-cursor-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/guilyx/obsidian-cursor-plugin/actions/workflows/ci.yml)

Obsidian plugin that embeds an **AI chat sidebar** with pluggable backends (BYOK, Cursor REST, SDK bridge).

## Documentation

📖 **[Full documentation site](https://guilyx.github.io/obsidian-cursor-plugin/)** — built from [`.docs/`](.docs/index.md) with MkDocs Material.

| Section | Link |
|---------|------|
| Getting started | [Installation](.docs/getting-started/installation.md) · [Local dev](.docs/getting-started/local-development.md) |
| Architecture | [Backend selection](.docs/architecture/backend-selection.md) · [Design](.docs/architecture/design.md) |
| Backends | [BYOK](.docs/backends/byok.md) · [Cursor REST](.docs/backends/cursor-rest.md) · [SDK bridge](.docs/backends/sdk-bridge.md) |
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

**v0.1.0** — BYOK MVP (sidebar chat, OpenAI-compatible streaming). [Roadmap](.docs/development/roadmap.md).

## License

TBD
