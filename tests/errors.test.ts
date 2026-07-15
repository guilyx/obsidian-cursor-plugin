import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CursorApiError, formatApiErrorField, isCursorBillingLimitError } from "../src/api/errors.ts";

describe("CursorApiError", () => {
  it("parses JSON message bodies", () => {
    const err = new CursorApiError(401, JSON.stringify({ message: "Invalid API key" }));
    assert.equal(err.status, 401);
    assert.equal(err.message, "Invalid API key");
    assert.equal(err.name, "CursorApiError");
  });

  it("parses nested object message bodies", () => {
    const body = JSON.stringify({
      code: "usage_limit_exceeded",
      message: {
        code: "usage_limit_exceeded",
        message: "Usage-based pricing required.",
      },
    });
    const err = new CursorApiError(400, body);
    assert.equal(err.message, "usage_limit_exceeded: Usage-based pricing required.");
    assert.equal(isCursorBillingLimitError(err), true);
  });

  it("falls back to raw body text", () => {
    const err = new CursorApiError(500, "internal failure");
    assert.match(err.message, /internal failure/);
  });
});

describe("formatApiErrorField", () => {
  it("stringifies nested error objects", () => {
    const msg = formatApiErrorField({ code: "x", message: "hello" });
    assert.equal(msg, "x: hello");
  });
});
