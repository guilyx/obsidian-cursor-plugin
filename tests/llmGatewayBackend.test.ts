import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { LlmGatewayBackend } from "../src/backends/LlmGatewayBackend.ts";
import { collectStreamEvents } from "./helpers/collectEvents.ts";
import { testSession, testSettings } from "./helpers/settings.ts";

describe("LlmGatewayBackend", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("validate calls GET /models on configured base URL", async () => {
    let url = "";
    mock.method(globalThis, "fetch", async (input: string | URL) => {
      url = String(input);
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    await new LlmGatewayBackend(
      testSettings({
        backend: "llm-gateway",
        byok: {
          provider: "openrouter",
          apiKey: "sk-or-test",
          baseUrl: "https://openrouter.ai/api/v1",
          model: "anthropic/claude-sonnet-4",
          temperature: 0.7,
          maxTokens: 100,
        },
      }),
    ).validate();

    assert.equal(url, "https://openrouter.ai/api/v1/models");
  });

  it("send streams OpenAI-compatible SSE chunks", async () => {
    mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/chat/completions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { model: string; messages: unknown[] };
        assert.equal(body.model, "gpt-4o-mini");
        assert.ok(Array.isArray(body.messages));
        const sse =
          'data: {"choices":[{"delta":{"content":"Lite"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"LLM"}}]}\n\n' +
          "data: [DONE]\n\n";
        return new Response(sse, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      throw new Error(`unexpected: ${url}`);
    });

    const backend = new LlmGatewayBackend(
      testSettings({
        backend: "llm-gateway",
        byok: {
          provider: "litellm",
          apiKey: "sk-test",
          baseUrl: "http://127.0.0.1:4000/v1",
          model: "gpt-4o-mini",
          temperature: 0.7,
          maxTokens: 100,
        },
      }),
    );

    const events = await collectStreamEvents(
      backend.send({
        session: testSession({ backend: "llm-gateway" }),
        userText: "hello",
        contextPrefix: "",
      }),
    );

    assert.ok(events.some((e) => e.type === "assistant-delta" && e.text === "Lite"));
    assert.ok(events.some((e) => e.type === "assistant-done" && e.text === "LiteLLM"));
  });

  it("includes OpenRouter ranking headers when provider is openrouter", async () => {
    let headers: Record<string, string> = {};
    mock.method(globalThis, "fetch", async (_input: string | URL, init?: RequestInit) => {
      headers = init?.headers as Record<string, string>;
      return new Response("data: [DONE]\n\n", { status: 200 });
    });

    const backend = new LlmGatewayBackend(
      testSettings({
        backend: "llm-gateway",
        byok: {
          provider: "openrouter",
          apiKey: "sk-or-test",
          baseUrl: "https://openrouter.ai/api/v1",
          model: "m",
          temperature: 0.7,
          maxTokens: 10,
        },
      }),
    );

    await collectStreamEvents(
      backend.send({ session: testSession(), userText: "x", contextPrefix: "" }),
    );

    assert.equal(headers.Referer, "https://github.com/guilyx/obsidian-cursor-plugin");
    assert.equal(headers["X-Title"], "Obsidian Cursor Chat");
  });
});
