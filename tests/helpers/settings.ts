import type { CursorChatSettings } from "../../src/settings/CursorSettings.ts";
import { DEFAULT_SETTINGS } from "../../src/settings/CursorSettings.ts";
import type { ChatSession } from "../../src/types/chat.ts";

export function testSettings(overrides: Partial<CursorChatSettings> = {}): CursorChatSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    byok: { ...DEFAULT_SETTINGS.byok, ...overrides.byok },
    cursor: { ...DEFAULT_SETTINGS.cursor, ...overrides.cursor },
    cursorAgent: { ...DEFAULT_SETTINGS.cursorAgent, ...overrides.cursorAgent },
  };
}

export function testSession(overrides: Partial<ChatSession> = {}): ChatSession {
  const now = new Date().toISOString();
  return {
    id: "session-1",
    title: "Test chat",
    backend: "cursor-sdk",
    messages: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
