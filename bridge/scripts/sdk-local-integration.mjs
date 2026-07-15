#!/usr/bin/env node
/**
 * Live integration: @cursor/sdk local agent (not Cloud Agents REST).
 * Requires CURSOR_API_KEY and Node 22+.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Agent } from "@cursor/sdk";

const apiKey = process.env.CURSOR_API_KEY?.trim();
const live = apiKey ? describe : describe.skip;

live("Cursor SDK local integration", () => {
  it("GET /v1/me via Cursor.me", async () => {
    const { Cursor } = await import("@cursor/sdk");
    const me = await Cursor.me({ apiKey: apiKey! });
    assert.ok(me, "expected user from Cursor.me");
  });

  it(
    "Agent.prompt runs local agent against cwd",
    { timeout: 180_000 },
    async (t) => {
      try {
        const result = await Agent.prompt("Reply with exactly the word: pong. Nothing else.", {
          apiKey: apiKey!,
          model: { id: "composer-2.5" },
          local: { cwd: process.cwd() },
        });
        const text = result.result ?? "";
        assert.ok(text.toLowerCase().includes("pong"), `expected pong in: ${text}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("usage_limit") || msg.includes("Usage-based pricing")) {
          t.skip(`Billing limit: ${msg}`);
          return;
        }
        throw err;
      }
    },
  );
});
