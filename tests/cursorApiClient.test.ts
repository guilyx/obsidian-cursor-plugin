import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { CursorApiClient } from "../src/api/CursorApiClient.ts";
import { CURSOR_API_BASE } from "../src/constants.ts";

describe("CursorApiClient", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("GET /v1/me sends Bearer auth", async () => {
    let seenAuth = "";
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      assert.equal(url, `${CURSOR_API_BASE}/v1/me`);
      seenAuth = (init?.headers as Record<string, string>)?.Authorization ?? "";
      return new Response(JSON.stringify({ apiKeyName: "test" }), { status: 200 });
    });

    const me = await new CursorApiClient("crsr_test").me();
    assert.equal(me.apiKeyName, "test");
    assert.equal(seenAuth, "Bearer crsr_test");
  });

  it("POST /v1/agents creates agent and run", async () => {
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/agents") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { prompt: { text: string } };
        assert.match(body.prompt.text, /hello/);
        return new Response(
          JSON.stringify({
            agent: { id: "bc-test" },
            run: { id: "run-test", agentId: "bc-test", status: "CREATING" },
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const res = await new CursorApiClient("crsr_test").createAgent({
      prompt: { text: "hello" },
    });
    assert.equal(res.agent.id, "bc-test");
    assert.equal(res.run.id, "run-test");
  });

  it("throws CursorApiError on 401", async () => {
    mock.method(globalThis, "fetch", async () => {
      return new Response(JSON.stringify({ message: "Invalid API key" }), { status: 401 });
    });

    await assert.rejects(
      () => new CursorApiClient("bad").me(),
      (err: Error) => {
        assert.match(err.message, /Invalid API key/);
        return true;
      },
    );
  });
});
