import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CursorApiClient } from "../src/api/CursorApiClient.ts";
import { CursorSdkBackend } from "../src/backends/CursorSdkBackend.ts";
import { CursorApiError } from "../src/api/errors.ts";
import { collectStreamEvents } from "./helpers/collectEvents.ts";
import { testSession, testSettings } from "./helpers/settings.ts";

const apiKey = process.env.CURSOR_API_KEY?.trim();
const live = apiKey ? describe : describe.skip;

function formatEventError(err: { type: "error"; message: string }): string {
  return err.message;
}

live("Cursor API integration", () => {
  it("GET /v1/me validates the repo secret", async () => {
    const me = await new CursorApiClient(apiKey!).me();
    assert.ok(me.apiKeyName, "expected apiKeyName from /v1/me");
  });

  it("GET /v1/models returns models", async () => {
    const models = await new CursorApiClient(apiKey!).listModels();
    assert.ok(models.length > 0, "expected at least one model");
    assert.ok(models[0]?.id, "expected model id");
  });

  it("POST /v1/agents creates a no-repo agent", async () => {
    const client = new CursorApiClient(apiKey!);
    try {
      const res = await client.createAgent({
        name: "ci-smoke",
        mode: "plan",
        prompt: { text: "Reply with exactly: pong" },
      });
      assert.match(res.agent.id, /^bc-/);
      assert.match(res.run.id, /^run-/);
    } catch (err: unknown) {
      if (err instanceof CursorApiError) {
        assert.fail(`createAgent failed (${err.status}): ${err.message}`);
      }
      throw err;
    }
  });

  it(
    "SDK backend completes a short no-repo agent run",
    { timeout: 180_000 },
    async () => {
      const backend = new CursorSdkBackend(
        testSettings({
          cursor: { apiKey: apiKey!, defaultMode: "plan", defaultModelId: "" },
        }),
      );

      const events = await collectStreamEvents(
        backend.send({
          session: testSession({ title: "ci-integration", cursorAgentId: undefined }),
          userText: "Reply with exactly the word: pong. Nothing else.",
          contextPrefix: "",
        }),
      );

      const done = events.find((e) => e.type === "assistant-done");
      const err = events.find((e) => e.type === "error");
      if (err?.type === "error") {
        assert.fail(`SDK run failed: ${formatEventError(err)}`);
      }
      assert.ok(done?.text?.toLowerCase().includes("pong"), `expected pong in: ${done?.text}`);
    },
  );
});
