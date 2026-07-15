import type { ChatBackendId } from "../types/chat";
import type { CursorConversationMode } from "../types/cursor-api";

/** BYOK gateway — all use OpenAI-compatible `/chat/completions`. */
export type ByokProviderId = "openrouter" | "litellm" | "openai" | "custom";

export interface ByokSettings {
  provider: ByokProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export type SdkRuntime = "local" | "cloud";

export interface CursorApiSettings {
  apiKey: string;
  defaultModelId: string;
  defaultMode: CursorConversationMode;
  showThinking: boolean;
  /** `local` = @cursor/sdk via bridge (default). `cloud` = Cloud Agents REST API. */
  sdkRuntime: SdkRuntime;
  bridgeUrl: string;
  bridgeToken: string;
}

export interface CursorAgentSettings {
  /** Executable name or path for the Cursor Agent CLI (default: agent). */
  cliPath: string;
  /** Auto-approve CLI tool runs (`--yolo` / `--trust`). */
  yoloMode: boolean;
}

export interface CursorChatSettings {
  backend: ChatBackendId;
  includeActiveNote: boolean;
  /** When true, "Send selection to chat" sends immediately instead of inserting into composer. */
  sendSelectionImmediately: boolean;
  maxContextChars: number;
  openChatOnStartup: boolean;
  hasAcknowledgedPrivacy: boolean;
  hasCompletedSetup: boolean;
  byok: ByokSettings;
  cursor: CursorApiSettings;
  cursorAgent: CursorAgentSettings;
}

export const DEFAULT_SETTINGS: CursorChatSettings = {
  backend: "cursor-sdk",
  includeActiveNote: true,
  sendSelectionImmediately: false,
  maxContextChars: 32000,
  openChatOnStartup: false,
  hasAcknowledgedPrivacy: false,
  hasCompletedSetup: false,
  byok: {
    provider: "openrouter",
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4",
    temperature: 0.7,
    maxTokens: 4096,
  },
  cursor: {
    apiKey: "",
    defaultModelId: "",
    defaultMode: "agent",
    showThinking: false,
    sdkRuntime: "local",
    bridgeUrl: "http://127.0.0.1:8765",
    bridgeToken: "",
  },
  cursorAgent: {
    cliPath: "agent",
    yoloMode: true,
  },
};
