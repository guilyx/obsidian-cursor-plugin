import { ItemView, MarkdownRenderer, WorkspaceLeaf } from "obsidian";
import type CursorChatPlugin from "../main";
import { VIEW_TYPE } from "../constants";
import type { StoredMessage } from "../types/chat";

export class CursorChatView extends ItemView {
  private messagesEl!: HTMLElement;
  private composerEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private abortController: AbortController | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: CursorChatPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Cursor Chat";
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("cursor-chat-view");

    const header = root.createDiv({ cls: "cursor-chat-header" });
    header.createSpan({ text: "Cursor Chat", cls: "cursor-chat-title" });
    const newBtn = header.createEl("button", { text: "New", cls: "cursor-chat-new-btn" });
    newBtn.onclick = () => {
      this.plugin.sessions.createSession(this.plugin.settings.backend);
      void this.plugin.persistSessions();
      this.renderMessages();
      this.updateStatus();
    };

    this.messagesEl = root.createDiv({ cls: "cursor-chat-messages" });
    this.messagesEl.setAttr("role", "log");
    this.messagesEl.setAttr("aria-live", "polite");

    this.statusEl = root.createDiv({ cls: "cursor-chat-status" });
    this.updateStatus();

    const composerWrap = root.createDiv({ cls: "cursor-chat-composer-wrap" });
    this.composerEl = composerWrap.createEl("textarea", {
      cls: "cursor-chat-composer",
      attr: { placeholder: "Ask about your notes…", "aria-label": "Message" },
    });
    this.composerEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.sendMessage();
      }
    });

    const actions = composerWrap.createDiv({ cls: "cursor-chat-actions" });
    this.stopBtn = actions.createEl("button", { text: "Stop", cls: "cursor-chat-stop-btn" });
    this.stopBtn.style.display = "none";
    this.stopBtn.onclick = () => this.stopGeneration();

    this.sendBtn = actions.createEl("button", { text: "Send", cls: "cursor-chat-send-btn mod-cta" });
    this.sendBtn.onclick = () => void this.sendMessage();

    this.renderMessages();
  }

  async onClose(): Promise<void> {
    this.stopGeneration();
  }

  private updateStatus(): void {
    const { backend, byok, cursor } = this.plugin.settings;

    if (backend === "cursor-sdk-local") {
      this.statusEl.setText("SDK bridge not available — switch backend in settings.");
      return;
    }

    if (backend === "cursor-rest") {
      if (!cursor.apiKey.trim()) {
        this.statusEl.setText("Configure Cursor API key in settings.");
        return;
      }
      const model = cursor.defaultModelId || "default model";
      this.statusEl.setText(`Cursor REST · ${model} · ${cursor.defaultMode}`);
      return;
    }

    if (!byok.baseUrl || !byok.model) {
      this.statusEl.setText("Configure provider in settings.");
      return;
    }
    this.statusEl.setText(`BYOK · ${byok.model}`);
  }

  private renderMessages(): void {
    this.messagesEl.empty();
    const session = this.plugin.sessions.ensureActive(this.plugin.settings.backend);

    if (session.messages.length === 0) {
      this.messagesEl.createDiv({
        cls: "cursor-chat-empty",
        text: "Ask questions about your notes. The active file is included when enabled in settings.",
      });
      return;
    }

    for (const msg of session.messages) {
      this.appendMessageBubble(msg);
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private appendMessageBubble(msg: StoredMessage): HTMLElement {
    const bubble = this.messagesEl.createDiv({
      cls: `cursor-chat-bubble cursor-chat-bubble--${msg.role}`,
    });
    bubble.createDiv({ cls: "cursor-chat-bubble-label", text: msg.role === "user" ? "You" : "Assistant" });
    const body = bubble.createDiv({ cls: "cursor-chat-bubble-body" });
    if (msg.role === "assistant") {
      void MarkdownRenderer.render(this.app, msg.content, body, "", this);
    } else {
      body.setText(msg.content);
    }
    return body;
  }

  private setStreaming(streaming: boolean): void {
    this.sendBtn.disabled = streaming;
    this.composerEl.disabled = streaming;
    this.stopBtn.style.display = streaming ? "inline-block" : "none";
  }

  private stopGeneration(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.setStreaming(false);
  }

  private async sendMessage(): Promise<void> {
    const text = this.composerEl.value.trim();
    if (!text || this.abortController) {
      return;
    }

    if (this.plugin.settings.backend === "cursor-sdk-local") {
      this.statusEl.setText("SDK bridge is not implemented yet.");
      return;
    }

    const session = this.plugin.sessions.ensureActive(this.plugin.settings.backend);
    const userMsg: StoredMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    this.plugin.sessions.addMessage(session.id, userMsg);
    this.composerEl.value = "";
    this.renderMessages();

    const assistantMsg: StoredMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    this.plugin.sessions.addMessage(session.id, assistantMsg);
    const assistantBody = this.appendMessageBubble(assistantMsg);

    this.abortController = new AbortController();
    this.setStreaming(true);

    const contextPrefix = await this.plugin.contextBuilder.build();

    try {
      const backend = this.plugin.router.getBackend();
      let full = "";
      for await (const event of backend.send({
        session,
        userText: text,
        contextPrefix,
        signal: this.abortController.signal,
      })) {
        if (event.type === "run-started") {
          this.plugin.sessions.setCursorAgentId(session.id, event.agentId);
          this.statusEl.setText(`Cursor REST · run ${event.runId.slice(0, 8)}…`);
        } else if (event.type === "assistant-delta") {
          full += event.text;
          assistantBody.empty();
          await MarkdownRenderer.render(this.app, full, assistantBody, "", this);
          this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        } else if (event.type === "thinking-delta") {
          // ponytail: append thinking inline until dedicated UI in PR #3
          full += `\n\n> *Thinking:* ${event.text}`;
          assistantBody.empty();
          await MarkdownRenderer.render(this.app, full, assistantBody, "", this);
        } else if (event.type === "assistant-done") {
          full = event.text;
        } else if (event.type === "error") {
          assistantBody.setText(`Error: ${event.message}`);
          full = `Error: ${event.message}`;
        }
      }
      this.plugin.sessions.updateAssistantMessage(session.id, assistantMsg.id, full);
      await this.plugin.persistSessions();
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const msg = err instanceof Error ? err.message : String(err);
        assistantBody.setText(`Error: ${msg}`);
        this.plugin.sessions.updateAssistantMessage(session.id, assistantMsg.id, `Error: ${msg}`);
        await this.plugin.persistSessions();
      }
    } finally {
      this.abortController = null;
      this.setStreaming(false);
      this.updateStatus();
    }
  }
}
