import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { presentChatError } from "../src/views/chatErrorPresentation.ts";

describe("presentChatError", () => {
  it("maps resource_exhausted with switch hint", () => {
    const err = presentChatError("RetriableError: [resource_exhausted] Error", "cursor-agent");
    assert.equal(err.title, "Rate or usage limit");
    assert.match(err.hint ?? "", /switch backend/i);
    assert.equal(err.showSwitchBackend, true);
  });

  it("collapses CLI connection spam in technical details", () => {
    const raw = [
      "Connection lost, reconnecting to https://agentn.global.api5.cursor.sh (attempt 1)...",
      "Retry attempt 1...",
      "RetriableError: [resource_exhausted] Error",
    ].join("\n");
    const err = presentChatError(raw, "cursor-agent");
    assert.equal(err.title, "Rate or usage limit");
    assert.doesNotMatch(err.summary, /attempt 1/);
  });

  it("maps connection loss for SDK backend", () => {
    const err = presentChatError("Connection lost to agentn.global.api5.cursor.sh", "cursor-sdk");
    assert.equal(err.title, "Cursor service unreachable");
    assert.match(err.hint ?? "", /Retry/i);
  });

  it("maps auth errors to settings action", () => {
    const err = presentChatError("Error: 401 Unauthorized");
    assert.equal(err.showOpenSettings, true);
    assert.match(err.title, /Authentication/i);
  });
});
