import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChildProcess } from "node:child_process";
import { LocalSdkBridgeManager, type SpawnFn } from "../src/localSdk/LocalSdkBridgeManager.ts";
import { testSettings } from "./helpers/settings.ts";
import path from "node:path";

const repoRoot = process.cwd();

function mockSpawn(
  onSpawn: (command: string, args: string[], options: { cwd: string }) => ChildProcess,
): SpawnFn {
  return ((command, args, options) => onSpawn(command, args, options)) as SpawnFn;
}

describe("LocalSdkBridgeManager", () => {
  it("reuses an already-healthy local SDK without spawning", async () => {
    let spawnCount = 0;
    const http = {
      supportsStreaming: true,
      async request({ url, method }: { url: string; method: string }) {
        if (url.endsWith("/health") && method === "GET") {
          return {
            status: 200,
            headers: {},
            text: async () => JSON.stringify({ ok: true, runtime: "local" }),
            body: null,
          };
        }
        throw new Error(`unexpected ${method} ${url}`);
      },
    };

    const manager = new LocalSdkBridgeManager(
      () => repoRoot,
      () => testSettings().cursor,
      http,
      ((..._args) => {
        spawnCount++;
        throw new Error("should not spawn");
      }) as SpawnFn,
    );

    await manager.ensureRunning();
    assert.equal(spawnCount, 0);
  });

  it("spawns sdk-server when health check fails", async () => {
    let healthChecks = 0;
    let spawned = false;

    const http = {
      supportsStreaming: true,
      async request({ url, method }: { url: string; method: string }) {
        if (url.endsWith("/health") && method === "GET") {
          healthChecks++;
          if (healthChecks < 3) {
            throw new TypeError("connection refused");
          }
          return {
            status: 200,
            headers: {},
            text: async () => JSON.stringify({ ok: true, runtime: "local" }),
            body: null,
          };
        }
        throw new Error(`unexpected ${method} ${url}`);
      },
    };

    const spawnFn = mockSpawn((_command, args, options) => {
      if (args[0] === "--version") {
        return {
          stdout: {
            on(_event: string, cb: (chunk: Buffer) => void) {
              cb(Buffer.from("v22.13.0\n"));
            },
          },
          stderr: { on: () => {} },
          on(event: string, cb: (...args: unknown[]) => void) {
            if (event === "close") {
              cb(0);
            }
            return this;
          },
          kill: () => {},
        } as unknown as ChildProcess;
      }

      if (args.includes("install")) {
        return {
          stderr: { on: () => {} },
          on(event: string, cb: (...args: unknown[]) => void) {
            if (event === "close") {
              cb(0);
            }
            return this;
          },
          kill: () => {},
        } as unknown as ChildProcess;
      }

      const serverArg = args.find((arg) => arg.endsWith("sdk-server.mjs"));
      assert.ok(serverArg, `expected sdk-server.mjs spawn, got: ${args.join(" ")}`);
      spawned = true;
      assert.equal(options.cwd, path.join(repoRoot, "bridge"));
      return {
        stderr: { on: () => {} },
        on() {
          return this;
        },
        kill: () => {},
      } as unknown as ChildProcess;
    });

    const manager = new LocalSdkBridgeManager(
      () => repoRoot,
      () => testSettings({ cursor: { apiKey: "crsr_test" } }).cursor,
      http,
      spawnFn,
    );

    await manager.ensureRunning();
    assert.equal(spawned, true);
    manager.stop();
  });
});
