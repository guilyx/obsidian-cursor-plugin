import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bridgeDownloadRefs, bridgeRawUrl } from "../src/localSdk/bootstrapBridge.ts";

describe("bootstrapBridge", () => {
  it("builds download refs with version tag fallback", () => {
    assert.deepEqual(bridgeDownloadRefs("0.5.0"), ["v0.5.0", "0.5.0", "main"]);
  });

  it("builds raw GitHub URLs", () => {
    assert.equal(
      bridgeRawUrl("v0.5.0", "sdk-server.mjs"),
      "https://raw.githubusercontent.com/guilyx/obsidian-cursor-plugin/v0.5.0/bridge/sdk-server.mjs",
    );
  });
});
