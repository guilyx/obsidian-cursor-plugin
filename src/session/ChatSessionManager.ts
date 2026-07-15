import type { ChatBackendId, ChatSession, StoredMessage } from "../types/chat";
import { migrateBackendId } from "../backends/backendIds";
import { agentIdMatchesSdkRuntime } from "../backends/cursorAgentId";
import type { SdkRuntime } from "../settings/CursorSettings";

export class ChatSessionManager {
  private sessions: ChatSession[] = [];
  private activeId: string | null = null;

  load(data: { sessions?: ChatSession[]; activeId?: string | null } | null): void {
    this.sessions = (data?.sessions ?? []).map((s) => ({
      ...s,
      backend: migrateBackendId(s.backend),
    }));
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

  listSessions(): ChatSession[] {
    return [...this.sessions];
  }

  setActive(sessionId: string): boolean {
    if (!this.sessions.some((s) => s.id === sessionId)) {
      return false;
    }
    this.activeId = sessionId;
    return true;
  }

  deleteSession(sessionId: string): void {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    if (this.activeId === sessionId) {
      this.activeId = this.sessions[0]?.id ?? null;
    }
  }

  createSession(backend: ChatBackendId = "cursor-sdk"): ChatSession {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: "New chat",
      backend,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.unshift(session);
    this.activeId = session.id;
    return session;
  }

  ensureActive(backend: ChatBackendId = "cursor-sdk"): ChatSession {
    return this.getActive() ?? this.createSession(backend);
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

  setCursorAgentId(sessionId: string, agentId: string): void {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.cursorAgentId = agentId;
      session.updatedAt = new Date().toISOString();
    }
  }

  clearCursorAgentIdsForRuntime(runtime: SdkRuntime): void {
    for (const session of this.sessions) {
      if (session.cursorAgentId && !agentIdMatchesSdkRuntime(session.cursorAgentId, runtime)) {
        delete session.cursorAgentId;
        session.updatedAt = new Date().toISOString();
      }
    }
  }
}
