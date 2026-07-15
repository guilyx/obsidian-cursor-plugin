import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { PLUGIN_REPO } from "../constants";
import type { HttpClient } from "../api/httpClient";
import type { SpawnFn } from "./LocalSdkBridgeManager";

const BRIDGE_FILES = ["sdk-server.mjs", "local-agent-options.mjs", "package.json", "package-lock.json"] as const;

export function bridgeServerScript(pluginDir: string): string {
  return path.join(pluginDir, "bridge", "sdk-server.mjs");
}

export function bridgeDownloadRefs(version: string): string[] {
  const trimmed = version.trim();
  return [...new Set([`v${trimmed}`, trimmed, "main"])];
}

export function bridgeRawUrl(ref: string, file: string): string {
  return `https://raw.githubusercontent.com/${PLUGIN_REPO}/${ref}/bridge/${file}`;
}

export function formatBridgeMissingError(pluginDir: string, detail?: string): string {
  const lines = [
    "Local SDK bridge files are not in your plugin folder.",
    `Expected: ${path.join(pluginDir, "bridge", "sdk-server.mjs")}`,
    "",
    "Obsidian Community Plugin installs only ship main.js, manifest.json, and styles.css — not the bridge folder.",
    "The plugin downloads bridge files on first use when online.",
    "",
    "If this keeps failing:",
    "• Settings → Backend → Cursor Agent CLI (no bridge folder needed), or",
    "• Settings → SDK runtime → Cloud (REST API), or",
    "• Clone the repo and symlink into .obsidian/plugins/obsidian-cursor-chat/",
  ];
  if (detail) {
    lines.push("", `Details: ${detail}`);
  }
  return lines.join("\n");
}

function runCommand(
  spawnFn: SpawnFn,
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    const timer = globalThis.setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err: Error) => {
      globalThis.clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      globalThis.clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function downloadBridgeFiles(
  pluginDir: string,
  version: string,
  http: HttpClient,
): Promise<string> {
  const bridgeDir = path.join(pluginDir, "bridge");
  await mkdir(bridgeDir, { recursive: true });

  let lastError = "unknown error";
  for (const ref of bridgeDownloadRefs(version)) {
    try {
      for (const file of BRIDGE_FILES) {
        const url = bridgeRawUrl(ref, file);
        const res = await http.request({ method: "GET", url });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status} for ${url}`);
        }
        await writeFile(path.join(bridgeDir, file), await res.text(), "utf8");
      }
      return ref;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError);
}

/** Download bridge/*.mjs into the plugin folder when missing (Community Plugin installs). */
export async function ensureBridgeInstalled(options: {
  pluginDir: string;
  version: string;
  http?: HttpClient;
  spawnFn: SpawnFn;
}): Promise<void> {
  const { pluginDir, version, http, spawnFn } = options;
  const serverScript = bridgeServerScript(pluginDir);
  if (existsSync(serverScript)) {
    return;
  }

  if (!http) {
    throw new Error(formatBridgeMissingError(pluginDir, "no HTTP client available to download bridge files"));
  }

  try {
    await downloadBridgeFiles(pluginDir, version, http);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(formatBridgeMissingError(pluginDir, detail));
  }

  const bridgeDir = path.join(pluginDir, "bridge");
  if (!existsSync(path.join(bridgeDir, "node_modules", "@cursor", "sdk"))) {
    await runCommand(spawnFn, "npm", ["install", "--omit=dev"], bridgeDir, 120_000);
  }
}
