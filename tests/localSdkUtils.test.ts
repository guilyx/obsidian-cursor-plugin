import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBridgeUrl } from "../src/localSdk/bridgeUrl.ts";
import { parseNodeMajor } from "../src/localSdk/resolveNode.ts";

describe("bridgeUrl", () => {
  it("parses host and port", () => {
    assert.deepEqual(parseBridgeUrl("http://127.0.0.1:8765"), { host: "127.0.0.1", port: 8765 });
    assert.deepEqual(parseBridgeUrl("http://localhost"), { host: "localhost", port: 80 });
  });
});

describe("parseNodeMajor", () => {
  it("reads semver majors", () => {
    assert.equal(parseNodeMajor("v22.13.0"), 22);
    assert.equal(parseNodeMajor("20.11.1"), 20);
  });
});
