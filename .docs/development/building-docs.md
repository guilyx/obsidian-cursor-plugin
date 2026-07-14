# Building the documentation site

This repository ships technical documentation as a [MkDocs](https://www.mkdocs.org/) site using [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/).

## Source layout

```
.docs/                    # site content (docs_dir)
mkdocs.yml                # site configuration (repo root)
pyproject.toml            # uv dependency group: docs
.github/workflows/docs.yml
```

## Local preview

```bash
# Install doc dependencies with uv
uv sync --group docs

# Live reload server
uv run mkdocs serve
```

Browse to [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Production build

```bash
uv run mkdocs build
# Output: site/
```

## Deploy to GitHub Pages

The workflow `.github/workflows/docs.yml` builds on push to `main` and publishes to GitHub Pages.

**Repository settings:** Settings → Pages → Source: **GitHub Actions**.

After deploy, the site is available at:

```
https://<org>.github.io/obsidian-cursor-plugin/
```

(Update `site_url` in `mkdocs.yml` if you use a custom domain.)

## Editing conventions

- Use **standard Markdown links**, not Obsidian `[[wikilinks]]`
- Put new pages under the matching section and add them to `nav` in `mkdocs.yml`
- Keep the root [CHANGELOG.md](https://github.com/guilyx/obsidian-cursor-plugin/blob/main/CHANGELOG.md) authoritative; reference page uses an include snippet
- Mermaid diagrams are enabled in `mkdocs.yml`

## Changelog sync

`reference/changelog.md` includes the root `CHANGELOG.md` via pymdownx Snippets:

```markdown
--8<-- "../CHANGELOG.md"
```

Edit only `CHANGELOG.md` at the repo root.
