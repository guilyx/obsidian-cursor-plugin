export type ChatBackendId = "openai-compatible" | "cursor-rest" | "cursor-sdk-local";

export type MessageRole = "user" | "assistant" | "system";

export interface StoredMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  backend: ChatBackendId;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

export type StreamEvent =
  | { type: "assistant-delta"; text: string }
  | { type: "assistant-done"; text: string }
  | { type: "error"; message: string };

export interface SendMessageInput {
  session: ChatSession;
  userText: string;
  contextPrefix: string;
  signal?: AbortSignal;
}
