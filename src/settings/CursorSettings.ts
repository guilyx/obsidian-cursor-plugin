import type { ChatBackendId } from "../types/chat";

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
  bridgeUrl: string;
}

export interface CursorChatSettings {
  backend: ChatBackendId;
  includeActiveNote: boolean;
  maxContextChars: number;
  openChatOnStartup: boolean;
  byok: ByokSettings;
  cursor: CursorApiSettings;
}

export const DEFAULT_SETTINGS: CursorChatSettings = {
  backend: "openai-compatible",
  includeActiveNote: true,
  maxContextChars: 32000,
  openChatOnStartup: false,
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
    bridgeUrl: "http://127.0.0.1:8765",
  },
};
