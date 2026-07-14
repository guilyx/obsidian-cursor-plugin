import type { ChatSession, StoredMessage } from "../types/chat";

export class ChatSessionManager {
  private sessions: ChatSession[] = [];
  private activeId: string | null = null;

  load(data: { sessions?: ChatSession[]; activeId?: string | null } | null): void {
    this.sessions = data?.sessions ?? [];
    this.activeId = data?.activeId ?? this.sessions[0]?.id ?? null;
  }

  save(): { sessions: ChatSession[]; activeId: string | null } {
    return { sessions: this.sessions, activeId: this.activeId };
  }

  getActive(): ChatSession | null {
    if (!this.activeId) {
      return null;
    }
    return this.sessions.find((s) => s.id === this.activeId) ?? null;
  }

  createSession(): ChatSession {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: "New chat",
      backend: "openai-compatible",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.unshift(session);
    this.activeId = session.id;
    return session;
  }

  ensureActive(): ChatSession {
    return this.getActive() ?? this.createSession();
  }

  addMessage(sessionId: string, message: StoredMessage): void {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return;
    }
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    if (message.role === "user" && session.title === "New chat") {
      session.title = message.content.slice(0, 48) || "New chat";
    }
  }

  updateAssistantMessage(sessionId: string, messageId: string, content: string): void {
    const session = this.sessions.find((s) => s.id === sessionId);
    const msg = session?.messages.find((m) => m.id === messageId);
    if (msg) {
      msg.content = content;
      if (session) {
        session.updatedAt = new Date().toISOString();
      }
    }
  }
}
