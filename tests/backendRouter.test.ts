import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { BackendRouter } from "../src/backends/BackendRouter.ts";
import { CursorSdkBackend } from "../src/backends/CursorSdkBackend.ts";
import { CursorAgentCliBackend } from "../src/backends/CursorAgentCliBackend.ts";
import { LlmGatewayBackend } from "../src/backends/LlmGatewayBackend.ts";
import { BACKEND_LABELS } from "../src/backends/backendIds.ts";
import { testSettings } from "./helpers/settings.ts";

describe("BackendRouter", () => {
  const sdk = new CursorSdkBackend(testSettings({ cursor: { apiKey: "crsr_test" } }), () => "/vault");
  const agent = new CursorAgentCliBackend(testSettings(), () => "/vault");
  const llm = new LlmGatewayBackend(testSettings({ backend: "llm-gateway" }));

  it("routes cursor-sdk", () => {
    const router = new BackendRouter(testSettings({ backend: "cursor-sdk" }), sdk, agent, llm);
    assert.equal(router.getBackend(), sdk);
    assert.equal(router.getBackendLabel(), BACKEND_LABELS["cursor-sdk"]);
  });

  it("routes cursor-agent", () => {
    const router = new BackendRouter(testSettings({ backend: "cursor-agent" }), sdk, agent, llm);
    assert.equal(router.getBackend(), agent);
  });

  it("routes llm-gateway", () => {
    const router = new BackendRouter(testSettings({ backend: "llm-gateway" }), sdk, agent, llm);
    assert.equal(router.getBackend(), llm);
  });
});

describe("backend smoke", () => {
  it("default settings use cursor-sdk backend", () => {
    const settings = testSettings();
    assert.equal(settings.backend, "cursor-sdk");
  });

  it("all backends expose validate and send", () => {
    for (const backend of [
      new CursorSdkBackend(testSettings({ cursor: { apiKey: "crsr_x" } }), () => "/vault"),
      new CursorAgentCliBackend(testSettings(), () => "/tmp"),
      new LlmGatewayBackend(testSettings({ backend: "llm-gateway" })),
    ]) {
      assert.equal(typeof backend.validate, "function");
      assert.equal(typeof backend.send, "function");
    }
  });
});
