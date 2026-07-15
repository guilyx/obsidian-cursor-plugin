# Installation

## Requirements

- **Obsidian** ≥ 1.5 (desktop recommended; plugin sets `isDesktopOnly: true`)
- For **BYOK**: an API key and base URL for an OpenAI-compatible provider
- For **Cursor REST** (upcoming): a [Cursor API key](https://cursor.com/dashboard) (`crsr_…`)

## Local install (development or manual)

Use a **dedicated vault** for plugin development — not your primary notes vault.

### 1. Build the plugin

```bash
git clone https://github.com/guilyx/obsidian-cursor-plugin.git
cd obsidian-cursor-plugin
npm install
npm run build
```

This produces `main.js` in the repository root.

### 2. Install into your vault

The plugin folder name must match `id` in `manifest.json` (`obsidian-cursor-chat` today).

**Symlink (recommended for development):**

```bash
ln -s "$(pwd)" "/path/to/your-vault/.obsidian/plugins/obsidian-cursor-chat"
```

**Copy release files:**

```bash
DEST="/path/to/your-vault/.obsidian/plugins/obsidian-cursor-chat"
mkdir -p "$DEST"
cp main.js manifest.json styles.css LICENSE "$DEST/"
cp -r bridge "$DEST/"
```

For **local SDK** mode, the `bridge/` folder must be present (the plugin auto-starts `bridge/sdk-server.mjs` and runs `npm install` there on first use if needed).

### 3. Enable in Obsidian

1. **Settings → Community plugins → Turn on community plugins**
2. Find **Cursor Chat** under Installed plugins → enable
3. **Settings → Cursor Chat** → configure provider (see [BYOK](../backends/byok.md))
4. Open via ribbon icon or command **Open Cursor Chat**

If you change `manifest.json`, restart Obsidian or reload the app.

## Community plugin store (future)

Published plugins are installed from **Settings → Community plugins → Browse**. Obsidian downloads these files from a **GitHub Release** whose tag matches `version` in `manifest.json`:

- `main.js`
- `manifest.json`
- `styles.css` (optional)
- `LICENSE`
- `bridge/` (required for local SDK backend)

Submission checklist:

- Public GitHub repository with `README.md` and `LICENSE`
- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin) on [community.obsidian.md](https://community.obsidian.md)
- Plugin `id` must be unique and **must not contain the word `obsidian`** — rename before store release

## Configure BYOK (default backend)

| Setting | Example |
|---------|---------|
| Base URL | `https://api.openai.com/v1` |
| Model | `gpt-4o-mini` |
| API key | `sk-…` |

Click **Test connection** (calls `GET /models`). Then open the chat sidebar and send a message.

More detail: [Local development](local-development.md) · [BYOK backend](../backends/byok.md)
