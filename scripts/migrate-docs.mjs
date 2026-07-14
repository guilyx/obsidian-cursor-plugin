#!/usr/bin/env node
/**
 * One-shot migration: docs/ → .docs/ with wikilink → markdown link conversion.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "docs");
const dstDir = path.join(root, ".docs");

const moves = {
  "BACKEND-SELECTION.md": "architecture/backend-selection.md",
  "DESIGN.md": "architecture/design.md",
  "UX.md": "architecture/ux.md",
  "BYOK.md": "backends/byok.md",
  "API-INTEGRATION.md": "backends/cursor-rest.md",
  "SDK-BRIDGE.md": "backends/sdk-bridge.md",
  "DEVELOPMENT.md": "development/guide.md",
  "IMPLEMENTATION-ROADMAP.md": "development/roadmap.md",
};

const linkMap = {
  "[[BACKEND-SELECTION]]": "[Backend selection](../architecture/backend-selection.md)",
  "[[BYOK]]": "[BYOK](../backends/byok.md)",
  "[[API-INTEGRATION]]": "[Cursor REST](../backends/cursor-rest.md)",
  "[[SDK-BRIDGE]]": "[SDK bridge](../backends/sdk-bridge.md)",
  "[[DESIGN]]": "[Architecture design](../architecture/design.md)",
  "[[UX]]": "[UX specification](../architecture/ux.md)",
  "[[DEVELOPMENT]]": "[Development guide](../development/guide.md)",
  "[[IMPLEMENTATION-ROADMAP]]": "[Implementation roadmap](../development/roadmap.md)",
  "[[Home]]": "[Documentation home](../index.md)",
};

function stripFrontmatter(text) {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  return end === -1 ? text : text.slice(end + 4).trimStart();
}

function convertLinks(text, depth) {
  let out = text;
  // [[Page|label]]
  out = out.replace(/\[\[([^\]|#]+)\|([^\]]+)\]\]/g, (_, page, label) => {
    const key = `[[${page}]]`;
    const mapped = linkMap[key];
    if (mapped) return mapped.replace(/\[[^\]]+\]/, `[${label}]`);
    return `[${label}](${page.toLowerCase()}.md)`;
  });
  // [[Page#anchor]]
  out = out.replace(/\[\[([^\]|#]+)#([^\]]+)\]\]/g, (_, page, anchor) => {
    const slug = anchor
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    const targets = {
      "BACKEND-SELECTION": "../architecture/backend-selection.md",
      DESIGN: "../architecture/design.md",
      UX: "../architecture/ux.md",
      BYOK: "../backends/byok.md",
      "API-INTEGRATION": "../backends/cursor-rest.md",
      "SDK-BRIDGE": "../backends/sdk-bridge.md",
      DEVELOPMENT: "../development/guide.md",
      "IMPLEMENTATION-ROADMAP": "../development/roadmap.md",
      Home: "../index.md",
    };
    const href = targets[page] ?? `${page.toLowerCase()}.md`;
    return `[${anchor}](${href}#${slug})`;
  });
  for (const [from, to] of Object.entries(linkMap)) {
    out = out.split(from).join(to);
  }
  // Remove Obsidian-only sections
  out = out.replace(/\n## Using these notes in Obsidian[\s\S]*?(?=\n## |\n---\n\n## |$)/g, "\n");
  out = out.replace(/\n---\n\n## See also[\s\S]*$/g, "\n");
  return out.trim() + "\n";
}

fs.mkdirSync(dstDir, { recursive: true });
for (const rel of Object.values(moves)) {
  fs.mkdirSync(path.dirname(path.join(dstDir, rel)), { recursive: true });
}

for (const [src, rel] of Object.entries(moves)) {
  const raw = fs.readFileSync(path.join(srcDir, src), "utf8");
  const body = convertLinks(stripFrontmatter(raw), rel);
  const header = body.startsWith("#") ? "" : `# ${src.replace(".md", "")}\n\n`;
  fs.writeFileSync(path.join(dstDir, rel), body.startsWith("#") ? body : header + body);
}

console.log("Migrated", Object.keys(moves).length, "files to .docs/");
