import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCursorSseEvent, parseSseDataLine } from "../src/api/SseReader.ts";

describe("parseSseDataLine", () => {
  it("parses OpenAI delta chunks", () => {
    const result = parseSseDataLine('{"choices":[{"delta":{"content":"hi"}}]}');
    assert.equal(result.text, "hi");
  });

  it("detects stream done", () => {
    assert.deepEqual(parseSseDataLine("[DONE]"), { done: true });
  });

  it("parses API errors", () => {
    const result = parseSseDataLine('{"error":{"message":"rate limited"}}');
    assert.equal(result.error, "rate limited");
  });
});

describe("parseCursorSseEvent", () => {
  it("parses assistant events", () => {
    const result = parseCursorSseEvent("assistant", '{"text":"hello"}');
    assert.deepEqual(result, { kind: "assistant", text: "hello" });
  });

  it("parses tool_call events", () => {
    const result = parseCursorSseEvent("tool_call", '{"callId":"c1","name":"grep","status":"done"}');
    assert.equal(result?.kind, "tool_call");
    if (result?.kind === "tool_call") {
      assert.equal(result.name, "grep");
      assert.equal(result.status, "done");
    }
  });

  it("ignores heartbeats", () => {
    assert.equal(parseCursorSseEvent("heartbeat", "{}"), null);
  });

  it("marks done events", () => {
    assert.deepEqual(parseCursorSseEvent("done", "{}"), { kind: "done" });
  });
});
