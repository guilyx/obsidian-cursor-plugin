import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migrateBackendId, BACKEND_LABELS } from "../src/backends/backendIds.ts";

describe("migrateBackendId", () => {
  it("maps legacy cursor-rest to cursor-sdk", () => {
    assert.equal(migrateBackendId("cursor-rest"), "cursor-sdk");
  });

  it("maps legacy cursor-sdk-local to cursor-agent", () => {
    assert.equal(migrateBackendId("cursor-sdk-local"), "cursor-agent");
  });

  it("maps legacy openai-compatible to llm-gateway", () => {
    assert.equal(migrateBackendId("openai-compatible"), "llm-gateway");
  });

  it("passes through current ids", () => {
    assert.equal(migrateBackendId("cursor-sdk"), "cursor-sdk");
    assert.equal(migrateBackendId("cursor-agent"), "cursor-agent");
    assert.equal(migrateBackendId("llm-gateway"), "llm-gateway");
  });
});

describe("BACKEND_LABELS", () => {
  it("has a label for each backend", () => {
    assert.equal(Object.keys(BACKEND_LABELS).length, 3);
  });
});
