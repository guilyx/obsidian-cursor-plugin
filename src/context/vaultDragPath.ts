import type { App } from "obsidian";
import { FileSystemAdapter, TAbstractFile, TFile, TFolder } from "obsidian";
import type { ChatAttachment } from "../views/chatAttachments";
import { parseWikiLinkText, pathsFromHtml } from "./vaultDragPathParse";

function abstractPath(app: App, path: string): string | null {
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile || file instanceof TFolder) {
    return file.path;
  }
  return null;
}

function findUniqueFolderByName(app: App, name: string): TFolder | null {
  const matches: TFolder[] = [];
  const walk = (folder: TFolder): void => {
    for (const child of folder.children) {
      if (child instanceof TFolder) {
        if (child.name === name || child.path === name) {
          matches.push(child);
        }
        walk(child);
      }
    }
  };
  walk(app.vault.getRoot());
  if (matches.length === 1) {
    return matches[0];
  }
  return matches.find((f) => f.path === name) ?? null;
}

function resolveWikiLink(app: App, link: string): string | null {
  const trimmed = link.trim().replace(/\/$/, "");
  if (!trimmed) {
    return null;
  }

  const asPath = abstractPath(app, trimmed);
  if (asPath) {
    return asPath;
  }

  const file = app.metadataCache.getFirstLinkpathDest(trimmed, "");
  if (file) {
    return file.path;
  }

  const folder = findUniqueFolderByName(app, trimmed);
  return folder?.path ?? null;
}

function resolveObsidianUri(app: App, uri: string): string | null {
  try {
    const url = new URL(uri);
    const fileParam = url.searchParams.get("file");
    if (fileParam) {
      const decoded = decodeURIComponent(fileParam);
      const resolved = abstractPath(app, decoded);
      if (resolved) {
        return resolved;
      }
      return resolveWikiLink(app, decoded);
    }

    const pathParam = url.searchParams.get("path");
    if (pathParam) {
      const absolute = decodeURIComponent(pathParam);
      const adapter = app.vault.adapter;
      const base = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
      if (base && absolute.startsWith(base)) {
        const relative = absolute.slice(base.length).replace(/^\/+/, "");
        return abstractPath(app, relative);
      }
    }

    if (url.hostname === "" && url.pathname.length > 1) {
      const relative = decodeURIComponent(url.pathname.slice(1));
      return abstractPath(app, relative) ?? resolveWikiLink(app, relative);
    }
  } catch {
    return null;
  }
  return null;
}

/** Resolve a vault file or folder path from Obsidian drag-and-drop payload text. */
export function resolveVaultPathFromDragText(app: App, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const direct = abstractPath(app, trimmed);
  if (direct) {
    return direct;
  }

  if (trimmed.startsWith("obsidian://")) {
    return resolveObsidianUri(app, trimmed);
  }

  const wiki = parseWikiLinkText(trimmed);
  if (wiki) {
    return resolveWikiLink(app, wiki);
  }

  return null;
}

/** Extract vault paths from a drop event (file explorer, editor links, OS paths). */
export function vaultPathsFromDragEvent(app: App, evt: DragEvent): string[] {
  const dt = evt.dataTransfer;
  if (!dt) {
    return [];
  }

  const candidates: string[] = [];
  const plain = dt.getData("text/plain");
  if (plain) {
    candidates.push(...plain.split(/\r?\n/));
  }

  const uriList = dt.getData("text/uri-list");
  if (uriList) {
    candidates.push(
      ...uriList
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")),
    );
  }

  const html = dt.getData("text/html");
  if (html) {
    candidates.push(...pathsFromHtml(html));
  }

  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const path = resolveVaultPathFromDragText(app, raw);
    if (path && !seen.has(path)) {
      seen.add(path);
      resolved.push(path);
    }
  }
  return resolved;
}

export function attachmentFromAbstractFile(file: TAbstractFile): ChatAttachment | null {
  if (file instanceof TFile) {
    return { kind: "file", path: file.path, label: file.basename };
  }
  if (file instanceof TFolder) {
    return { kind: "folder", path: file.path, label: file.name };
  }
  return null;
}
