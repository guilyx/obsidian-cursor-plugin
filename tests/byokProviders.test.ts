import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyByokProviderPreset,
  inferByokProvider,
} from "../src/settings/byokProviders.ts";

describe("applyByokProviderPreset", () => {
  it("applies OpenRouter defaults", () => {
    const byok = { provider: "custom" as const, baseUrl: "", model: "" };
    applyByokProviderPreset(byok, "openrouter");
    assert.equal(byok.provider, "openrouter");
    assert.equal(byok.baseUrl, "https://openrouter.ai/api/v1");
    assert.match(byok.model, /claude|gpt|composer/i);
  });

  it("applies LiteLLM defaults", () => {
    const byok = { provider: "custom" as const, baseUrl: "", model: "" };
    applyByokProviderPreset(byok, "litellm");
    assert.equal(byok.baseUrl, "http://127.0.0.1:4000/v1");
  });

  it("leaves custom URLs untouched", () => {
    const byok = { provider: "openai" as const, baseUrl: "https://example.com/v1", model: "m" };
    applyByokProviderPreset(byok, "custom");
    assert.equal(byok.baseUrl, "https://example.com/v1");
    assert.equal(byok.model, "m");
  });
});

describe("inferByokProvider", () => {
  it("detects OpenRouter", () => {
    assert.equal(inferByokProvider("https://openrouter.ai/api/v1/"), "openrouter");
  });

  it("detects LiteLLM localhost", () => {
    assert.equal(inferByokProvider("http://127.0.0.1:4000/v1"), "litellm");
  });

  it("falls back to custom", () => {
    assert.equal(inferByokProvider("https://my.proxy.example/v1"), "custom");
  });
});
