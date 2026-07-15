import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { CursorSdkBackend } from "../src/backends/CursorSdkBackend.ts";
import { CURSOR_API_BASE } from "../src/constants.ts";
import { collectStreamEvents } from "./helpers/collectEvents.ts";
import { testSession, testSettings } from "./helpers/settings.ts";

function sseResponse(events: Array<{ type: string; data: object }>): Response {
  const body = events
    .map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("CursorSdkBackend", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("validate requires API key", async () => {
    const backend = new CursorSdkBackend(testSettings({ cursor: { apiKey: "" } }), () => "/vault");
    await assert.rejects(() => backend.validate(), /API key is required/);
  });

  it("validate calls /v1/me", async () => {
    let called = false;
    mock.method(globalThis, "fetch", async (input: string | URL) => {
      if (String(input).endsWith("/v1/me")) {
        called = true;
        return new Response(JSON.stringify({ apiKeyName: "ok" }), { status: 200 });
      }
      throw new Error("unexpected");
    });

    await new CursorSdkBackend(
      testSettings({ cursor: { apiKey: "crsr_test", sdkRuntime: "cloud" } }),
      () => "/vault",
    ).validate();
    assert.equal(called, true);
  });

  it("send creates agent and streams assistant reply via Cursor API", async () => {
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `${CURSOR_API_BASE}/v1/agents` && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            agent: { id: "bc-1" },
            run: { id: "run-1", agentId: "bc-1", status: "CREATING" },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/stream")) {
        return sseResponse([
          { type: "assistant", data: { text: "Hello " } },
          { type: "assistant", data: { text: "vault" } },
          { type: "done", data: {} },
        ]);
      }
      throw new Error(`unexpected: ${url}`);
    });

    const backend = new CursorSdkBackend(
      testSettings({ cursor: { apiKey: "crsr_test", sdkRuntime: "cloud" } }),
      () => "/vault",
    );
    const events = await collectStreamEvents(
      backend.send({
        session: testSession(),
        userText: "Summarize my note",
        contextPrefix: "",
      }),
    );

    assert.ok(events.some((e) => e.type === "run-started" && e.agentId === "bc-1"));
    assert.ok(events.some((e) => e.type === "assistant-delta" && e.text === "Hello "));
    assert.ok(events.some((e) => e.type === "assistant-done" && e.text === "Hello vault"));
  });

  it("polls GET run when http client does not support streaming", async () => {
    let pollCount = 0;
    const http = {
      supportsStreaming: false,
      async request({ method, url }: { method: string; url: string }) {
        if (url.endsWith("/v1/agents") && method === "POST") {
          return {
            status: 200,
            headers: {},
            text: async () =>
              JSON.stringify({
                agent: { id: "bc-1" },
                run: { id: "run-1", agentId: "bc-1", status: "CREATING" },
              }),
            body: null,
          };
        }
        if (url.includes("/runs/run-1") && method === "GET" && !url.endsWith("/stream")) {
          pollCount++;
          if (pollCount < 2) {
            return {
              status: 200,
              headers: {},
              text: async () =>
                JSON.stringify({ id: "run-1", agentId: "bc-1", status: "RUNNING" }),
              body: null,
            };
          }
          return {
            status: 200,
            headers: {},
            text: async () =>
              JSON.stringify({
                id: "run-1",
                agentId: "bc-1",
                status: "FINISHED",
                result: "Polled reply",
              }),
            body: null,
          };
        }
        throw new Error(`unexpected ${method} ${url}`);
      },
    };

    const backend = new CursorSdkBackend(
      testSettings({ cursor: { apiKey: "crsr_test", sdkRuntime: "cloud" } }),
      () => "/vault",
      http,
    );
    const events = await collectStreamEvents(
      backend.send({
        session: testSession(),
        userText: "hello",
        contextPrefix: "",
      }),
    );

    assert.ok(pollCount >= 2);
    assert.ok(events.some((e) => e.type === "assistant-done" && e.text === "Polled reply"));
  });

  it("send creates follow-up run when session has cursorAgentId", async () => {
    const calls: string[] = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/runs") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ run: { id: "run-2", agentId: "bc-existing", status: "CREATING" } }),
          { status: 200 },
        );
      }
      if (url.endsWith("/stream")) {
        return sseResponse([{ type: "assistant", data: { text: "follow-up" } }, { type: "done", data: {} }]);
      }
      throw new Error(`unexpected: ${url}`);
    });

    const backend = new CursorSdkBackend(
      testSettings({ cursor: { apiKey: "crsr_test", sdkRuntime: "cloud" } }),
      () => "/vault",
    );
    await collectStreamEvents(
      backend.send({
        session: testSession({ cursorAgentId: "bc-existing" }),
        userText: "next",
        contextPrefix: "",
      }),
    );

    assert.ok(calls.some((c) => c.includes("POST") && c.includes("/agents/bc-existing/runs")));
    assert.ok(!calls.some((c) => c.includes("POST") && c.endsWith("/agents")));
  });

  it("ignores local agent id when cloud runtime is selected", async () => {
    const calls: string[] = [];
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url === `${CURSOR_API_BASE}/v1/agents` && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            agent: { id: "bc-new" },
            run: { id: "run-new", agentId: "bc-new", status: "CREATING" },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/stream")) {
        return sseResponse([{ type: "assistant", data: { text: "fresh cloud" } }, { type: "done", data: {} }]);
      }
      throw new Error(`unexpected: ${url}`);
    });

    const backend = new CursorSdkBackend(
      testSettings({ cursor: { apiKey: "crsr_test", sdkRuntime: "cloud" } }),
      () => "/vault",
    );
    const events = await collectStreamEvents(
      backend.send({
        session: testSession({ cursorAgentId: "agent-local-stale" }),
        userText: "hello",
        contextPrefix: "",
      }),
    );

    assert.ok(calls.some((c) => c === `POST ${CURSOR_API_BASE}/v1/agents`));
    assert.ok(!calls.some((c) => c.includes("agent-local-stale")));
    assert.ok(events.some((e) => e.type === "run-started" && e.agentId === "bc-new"));
  });
});
