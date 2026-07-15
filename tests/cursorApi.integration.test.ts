import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CursorApiClient } from "../src/api/CursorApiClient.ts";
import { CursorApiError } from "../src/api/errors.ts";

const apiKey = process.env.CURSOR_API_KEY?.trim();
const live = apiKey ? describe : describe.skip;

live("Cursor API integration (auth smoke)", () => {
  it("GET /v1/me validates the repo secret", async () => {
    const me = await new CursorApiClient(apiKey!).me();
    assert.ok(me.apiKeyName, "expected apiKeyName from /v1/me");
  });

  it("GET /v1/models returns models", async () => {
    const models = await new CursorApiClient(apiKey!).listModels();
    assert.ok(models.length > 0, "expected at least one model");
    assert.ok(models[0]?.id, "expected model id");
  });

  it("POST /v1/agents cloud — documents billing gate", async (t) => {
    const client = new CursorApiClient(apiKey!);
    try {
      await client.createAgent({
        name: "ci-cloud-smoke",
        mode: "plan",
        prompt: { text: "ping" },
      });
    } catch (err: unknown) {
      if (err instanceof CursorApiError && err.status === 400) {
        t.skip(`Cloud Agents not available on this account: ${err.message}`);
        return;
      }
      throw err;
    }
  });
});
