import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agentIdMatchesSdkRuntime,
  isCloudCursorAgentId,
  isLocalCursorAgentId,
} from "../src/backends/cursorAgentId.ts";

describe("cursorAgentId", () => {
  it("detects cloud and local id prefixes", () => {
    assert.equal(isCloudCursorAgentId("bc-550e8400-e29b-41d4-a716-446655440000"), true);
    assert.equal(isCloudCursorAgentId("agent-abc"), false);
    assert.equal(isLocalCursorAgentId("agent-550e8400-e29b-41d4-a716-446655440000"), true);
    assert.equal(isLocalCursorAgentId("bc-abc"), false);
  });

  it("matches runtime", () => {
    assert.equal(agentIdMatchesSdkRuntime("bc-1", "cloud"), true);
    assert.equal(agentIdMatchesSdkRuntime("agent-1", "cloud"), false);
    assert.equal(agentIdMatchesSdkRuntime("agent-1", "local"), true);
    assert.equal(agentIdMatchesSdkRuntime("bc-1", "local"), false);
  });
});
