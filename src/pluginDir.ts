import type { Plugin } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import path from "path";

declare const __dirname: string;

/** Vault plugin folder — reliable in Obsidian; falls back to bundled main.js dir. */
export function resolvePluginDir(plugin: Plugin): string {
  const adapter = plugin.app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return path.join(adapter.getBasePath(), plugin.app.vault.configDir, "plugins", plugin.manifest.id);
  }
  return __dirname;
}
