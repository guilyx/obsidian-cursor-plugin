import type { ByokProviderId } from "../settings/CursorSettings";

export interface ByokProviderPreset {
  label: string;
  baseUrl: string;
  model: string;
  apiKeyPlaceholder: string;
  helpUrl: string;
  /** Optional extra request headers (e.g. OpenRouter rankings). */
  extraHeaders?: Record<string, string>;
}

export const BYOK_PROVIDER_PRESETS: Record<ByokProviderId, ByokProviderPreset> = {
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4",
    apiKeyPlaceholder: "sk-or-…",
    helpUrl: "https://openrouter.ai/keys",
    extraHeaders: {
      Referer: "https://github.com/guilyx/obsidian-cursor-plugin",
      "X-Title": "Obsidian Cursor Chat",
    },
  },
  litellm: {
    label: "LiteLLM proxy",
    baseUrl: "http://127.0.0.1:4000/v1",
    model: "gpt-4o-mini",
    apiKeyPlaceholder: "sk-… (proxy master key)",
    helpUrl: "https://docs.litellm.ai/docs/proxy/quick_start",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKeyPlaceholder: "sk-…",
    helpUrl: "https://platform.openai.com/api-keys",
  },
  custom: {
    label: "Custom",
    baseUrl: "",
    model: "",
    apiKeyPlaceholder: "sk-…",
    helpUrl: "https://platform.openai.com/docs/api-reference",
  },
};

export function applyByokProviderPreset(
  byok: { provider: ByokProviderId; baseUrl: string; model: string },
  provider: ByokProviderId,
): void {
  byok.provider = provider;
  if (provider === "custom") {
    return;
  }
  const preset = BYOK_PROVIDER_PRESETS[provider];
  byok.baseUrl = preset.baseUrl;
  byok.model = preset.model;
}

export function inferByokProvider(baseUrl: string): ByokProviderId {
  const normalized = baseUrl.trim().toLowerCase().replace(/\/$/, "");
  if (normalized.includes("openrouter.ai")) {
    return "openrouter";
  }
  if (normalized.includes("127.0.0.1:4000") || normalized.includes("localhost:4000")) {
    return "litellm";
  }
  if (normalized === "https://api.openai.com/v1") {
    return "openai";
  }
  return "custom";
}
