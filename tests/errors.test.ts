import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CursorApiError } from "../src/api/errors.ts";

describe("CursorApiError", () => {
  it("parses JSON message bodies", () => {
    const err = new CursorApiError(401, JSON.stringify({ message: "Invalid API key" }));
    assert.equal(err.status, 401);
    assert.equal(err.message, "Invalid API key");
    assert.equal(err.name, "CursorApiError");
  });

  it("falls back to raw body text", () => {
    const err = new CursorApiError(500, "internal failure");
    assert.match(err.message, /internal failure/);
  });
});
