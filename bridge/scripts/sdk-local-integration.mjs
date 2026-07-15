#!/usr/bin/env node
/**
 * Live integration: @cursor/sdk local agent (not Cloud Agents REST).
 * Requires CURSOR_API_KEY and Node 22+.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Agent } from "@cursor/sdk";
import { buildLocalAgentOptions } from "../local-agent-options.mjs";

const apiKey = process.env.CURSOR_API_KEY?.trim();
const live = apiKey ? describe : describe.skip;

live("Cursor SDK local integration", () => {
  it("GET /v1/me via Cursor.me", async () => {
    const { Cursor } = await import("@cursor/sdk");
    const me = await Cursor.me({ apiKey: apiKey! });
    assert.ok(me, "expected user from Cursor.me");
  });

  it(
    "Agent.create local runs against cwd",
    { timeout: 180_000 },
    async (t) => {
      try {
        const agent = await Agent.create(
          buildLocalAgentOptions({
            apiKey: apiKey!,
            cwd: process.cwd(),
          }),
        );

        const run = await agent.send("Reply with exactly the word: pong. Nothing else.");
        let text = "";
        for await (const event of run.stream()) {
          if (event.type === "assistant") {
            const blocks = event.message?.content ?? [];
            for (const block of blocks) {
              if (block?.type === "text") {
                text += block.text;
              }
            }
          }
        }
        const result = await run.wait();
        const finalText = result.result ?? text;
        assert.ok(finalText.toLowerCase().includes("pong"), `expected pong in: ${finalText}`);
        agent.close();
      } catch (err) {
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
