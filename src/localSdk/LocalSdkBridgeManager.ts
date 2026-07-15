import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { BridgeApiClient } from "../api/BridgeApiClient";
import type { HttpClient } from "../api/httpClient";
import type { CursorApiSettings } from "../settings/CursorSettings";
import { parseBridgeUrl } from "./bridgeUrl";
import { ensureBridgeInstalled, bridgeServerScript } from "./bootstrapBridge";
import { resolveNodeExecutable } from "./resolveNode";

const HEALTH_POLL_MS = 200;
const HEALTH_TIMEOUT_MS = 20_000;
const STARTUP_LOG_TAIL = 800;

export type SpawnFn = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: string[] },
) => ChildProcess;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
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

/**
 * Spawns and supervises the local @cursor/sdk HTTP server shipped with the plugin.
 * ponytail: single process per Obsidian session; killed on plugin unload.
 */
export class LocalSdkBridgeManager {
  private child: ChildProcess | null = null;
  private starting: Promise<void> | null = null;
  private managedByPlugin = false;

  constructor(
    private readonly getPluginDir: () => string,
    private readonly getPluginVersion: () => string,
    private readonly getSettings: () => CursorApiSettings,
    private readonly http?: HttpClient,
    private readonly spawnFn: SpawnFn = spawn as unknown as SpawnFn,
  ) {}

  async ensureRunning(): Promise<void> {
    const client = this.bridgeClient();
    if (await this.isHealthy(client)) {
      return;
    }

    if (!this.starting) {
      this.starting = this.startBridge().finally(() => {
        this.starting = null;
      });
    }
    await this.starting;

    if (!(await this.isHealthy(client))) {
      throw new Error("Local SDK server did not respond on /health.");
    }
  }

  stop(): void {
    if (this.managedByPlugin && this.child) {
      this.child.kill("SIGTERM");
    }
    this.child = null;
    this.managedByPlugin = false;
  }

  private bridgeClient(): BridgeApiClient {
    const settings = this.getSettings();
    return new BridgeApiClient(
      settings.bridgeUrl.replace(/\/$/, ""),
      settings.bridgeToken,
      settings.apiKey.trim(),
      this.http,
    );
  }

  private async isHealthy(client: BridgeApiClient): Promise<boolean> {
    try {
      const health = await client.health();
      return health.ok === true;
    } catch {
      return false;
    }
  }

  private async startBridge(): Promise<void> {
    const settings = this.getSettings();
    const pluginDir = this.getPluginDir();

    await ensureBridgeInstalled({
      pluginDir,
      version: this.getPluginVersion(),
      http: this.http,
      spawnFn: this.spawnFn,
    });

    const bridgeDir = path.join(pluginDir, "bridge");
    const serverScript = bridgeServerScript(pluginDir);

    if (!existsSync(serverScript)) {
      throw new Error(`Local SDK server script missing after install: ${serverScript}`);
    }

    await this.ensureDependencies(bridgeDir);
    const node = await resolveNodeExecutable(this.spawnFn);
    const { host, port } = parseBridgeUrl(settings.bridgeUrl);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      BRIDGE_HOST: host,
      BRIDGE_PORT: String(port),
    };
    if (settings.bridgeToken) {
      env.BRIDGE_TOKEN = settings.bridgeToken;
    }
    const apiKey = settings.apiKey.trim();
    if (apiKey) {
      env.CURSOR_API_KEY = apiKey;
    }

    await new Promise<void>((resolve, reject) => {
      const child = this.spawnFn(node, [serverScript], {
        cwd: bridgeDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      this.managedByPlugin = true;
      let stderr = "";

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString("utf8")).slice(-STARTUP_LOG_TAIL);
      });

      child.on("error", (err: Error) => {
        this.child = null;
        this.managedByPlugin = false;
        reject(new Error(`Failed to start local SDK: ${err.message}`));
      });

      child.on("exit", (code) => {
        if (this.child === child) {
          this.child = null;
          this.managedByPlugin = false;
        }
        if (code !== null && code !== 0) {
          reject(new Error(stderr.trim() || `Local SDK exited with code ${code}`));
        }
      });

      void this.waitForHealth(this.bridgeClient(), HEALTH_TIMEOUT_MS)
        .then(resolve)
        .catch((err: unknown) => {
          this.stop();
          const detail = stderr.trim();
          const msg = err instanceof Error ? err.message : String(err);
          reject(new Error(detail ? `${msg}\n${detail}` : msg));
        });
    });
  }

  private async waitForHealth(client: BridgeApiClient, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isHealthy(client)) {
        return;
      }
      await sleep(HEALTH_POLL_MS);
    }
    throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for local SDK /health`);
  }

  private async ensureDependencies(bridgeDir: string): Promise<void> {
    if (existsSync(path.join(bridgeDir, "node_modules", "@cursor", "sdk"))) {
      return;
    }
    await runCommand(this.spawnFn, "npm", ["install", "--omit=dev"], bridgeDir, 120_000);
  }
}
