import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { type ChildProcess, spawn } from "node:child_process";

const BRIDGE_PORT = 18765;
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;

describe("bridge stub server", () => {
  let proc: ChildProcess;

  before(async () => {
    proc = spawn(process.execPath, ["bridge/server.mjs"], {
      env: {
        ...process.env,
        BRIDGE_PORT: String(BRIDGE_PORT),
        BRIDGE_HOST: "127.0.0.1",
        BRIDGE_TOKEN: "ci-test-token",
      },
      stdio: "ignore",
    });

    // ponytail: poll /health until ready (max ~5s)
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${BRIDGE_URL}/health`);
        if (res.ok) {
          return;
        }
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Bridge stub failed to start");
  });

  after(() => {
    proc.kill("SIGTERM");
  });

  it("responds to GET /health", async () => {
    const res = await fetch(`${BRIDGE_URL}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; version: string };
    assert.equal(body.ok, true);
    assert.match(body.version, /stub/);
  });

  it("creates a mock agent with auth", async () => {
    const res = await fetch(`${BRIDGE_URL}/agents`, {
      method: "POST",
      headers: {
        Authorization: "Bearer ci-test-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cwd: "/tmp/vault" }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { agentId: string; runId: string };
    assert.match(body.agentId, /^bc-stub-/);
    assert.match(body.runId, /^run-stub-/);
  });
});
