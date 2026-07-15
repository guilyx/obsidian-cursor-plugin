import type { ChatBackendId } from "../types/chat";

/** User-facing backend identifiers (v0.5+). */
export const BACKEND_LABELS: Record<ChatBackendId, string> = {
  "cursor-sdk": "Cursor (SDK / API key)",
  "cursor-agent": "Cursor Agent (CLI)",
  "llm-gateway": "Other models (LiteLLM / OpenRouter)",
};

/** Migrate persisted settings/sessions from pre-v0.5 IDs. */
export function migrateBackendId(raw: string): ChatBackendId {
  switch (raw) {
    case "cursor-rest":
      return "cursor-sdk";
    case "cursor-sdk-local":
      return "cursor-agent";
    case "openai-compatible":
      return "llm-gateway";
    case "cursor-sdk":
    case "cursor-agent":
    case "llm-gateway":
      return raw;
    default:
      return "cursor-sdk";
  }
}
