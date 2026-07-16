import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCliErrorMessage } from "../src/backends/formatCliError.ts";

describe("formatCliErrorMessage", () => {
  it("maps resource_exhausted to actionable guidance", () => {
    const msg = formatCliErrorMessage("RetriableError: [resource_exhausted] Error");
    assert.match(msg, /rate or usage limit/i);
    assert.match(msg, /Cursor SDK/i);
  });

  it("maps connection loss spam to a short message", () => {
    const raw = [
      "Connection lost, reconnecting to https://agentn.global.api5.cursor.sh (attempt 1)...",
      "Retry attempt 1...",
      "Connection lost, reconnecting to https://agentn.global.api5.cursor.sh (attempt 2)...",
      "Retry attempt 2...",
      "RetriableError: [resource_exhausted] Error",
    ].join("\n");
    const msg = formatCliErrorMessage(raw);
    assert.doesNotMatch(msg, /attempt 1/);
    assert.match(msg, /rate or usage limit|lost connection/i);
  });

  it("collapses retry noise for generic stderr", () => {
    const raw = "Retry attempt 1...\nRetry attempt 2...\nSomething else failed";
    assert.equal(formatCliErrorMessage(raw), "Something else failed");
  });
});
