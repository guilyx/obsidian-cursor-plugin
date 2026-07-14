import type { ChatBackendId } from "../types/chat";
import type { CursorConversationMode } from "../types/cursor-api";

export interface ByokSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface CursorApiSettings {
  apiKey: string;
  defaultModelId: string;
  defaultMode: CursorConversationMode;
  showThinking: boolean;
  bridgeUrl: string;
  bridgeToken: string;
}

export interface CursorChatSettings {
  backend: ChatBackendId;
  includeActiveNote: boolean;
  maxContextChars: number;
  openChatOnStartup: boolean;
  hasAcknowledgedPrivacy: boolean;
  byok: ByokSettings;
  cursor: CursorApiSettings;
}

export const DEFAULT_SETTINGS: CursorChatSettings = {
  backend: "openai-compatible",
  includeActiveNote: true,
  maxContextChars: 32000,
  openChatOnStartup: false,
  hasAcknowledgedPrivacy: false,
  byok: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 4096,
  },
  cursor: {
    apiKey: "",
    defaultModelId: "",
    defaultMode: "plan",
    showThinking: false,
    bridgeUrl: "http://127.0.0.1:8765",
    bridgeToken: "dev-bridge-token",
  },
};
