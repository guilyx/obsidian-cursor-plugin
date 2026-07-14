import { ItemView, MarkdownRenderer, WorkspaceLeaf } from "obsidian";
import type CursorChatPlugin from "../main";
import { VIEW_TYPE } from "../constants";
import type { StoredMessage } from "../types/chat";
import { BYOK_PROVIDER_PRESETS } from "../settings/byokProviders";
import { VaultFileSuggestModal } from "./VaultFileSuggestModal";
import { PrivacyNoticeModal } from "./PrivacyNoticeModal";

interface AttachmentChip {
  path: string;
  label: string;
}

export class CursorChatView extends ItemView {
  private messagesEl!: HTMLElement;
  private chipsEl!: HTMLElement;
  private sessionSelectEl!: HTMLSelectElement;
  private composerEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private abortController: AbortController | null = null;
  private attachments: AttachmentChip[] = [];

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

    const headerActions = header.createDiv({ cls: "cursor-chat-header-actions" });
    this.sessionSelectEl = headerActions.createEl("select", { cls: "cursor-chat-session-select" });
    this.sessionSelectEl.addEventListener("change", () => {
      const id = this.sessionSelectEl.value;
      if (this.plugin.sessions.setActive(id)) {
        void this.plugin.persistSessions();
        this.renderMessages();
        this.updateStatus();
      }
    });

    const newBtn = headerActions.createEl("button", { text: "+", cls: "cursor-chat-new-btn", attr: { title: "New chat" } });
    newBtn.onclick = () => {
      this.plugin.sessions.createSession(this.plugin.settings.backend);
      void this.plugin.persistSessions();
      this.refreshSessionSelect();
      this.renderMessages();
      this.updateStatus();
    };

    this.messagesEl = root.createDiv({ cls: "cursor-chat-messages" });
    this.messagesEl.setAttr("role", "log");
    this.messagesEl.setAttr("aria-live", "polite");

    this.statusEl = root.createDiv({ cls: "cursor-chat-status" });
    this.updateStatus();

    this.chipsEl = root.createDiv({ cls: "cursor-chat-chips" });
    this.renderContextChips();

    const composerWrap = root.createDiv({ cls: "cursor-chat-composer-wrap" });
    this.composerEl = composerWrap.createEl("textarea", {
      cls: "cursor-chat-composer",
      attr: { placeholder: "Ask about your notes… (@ to attach)", "aria-label": "Message" },
    });
    this.composerEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.sendMessage();
      }
      if (e.key === "@") {
        window.setTimeout(() => this.openMentionPicker(), 0);
      }
    });

    const actions = composerWrap.createDiv({ cls: "cursor-chat-actions" });
    this.stopBtn = actions.createEl("button", { text: "Stop", cls: "cursor-chat-stop-btn", attr: { "aria-label": "Stop generation" } });
    this.stopBtn.style.display = "none";
    this.stopBtn.onclick = () => this.stopGeneration();

    this.sendBtn = actions.createEl("button", { text: "Send", cls: "cursor-chat-send-btn mod-cta" });
    this.sendBtn.onclick = () => void this.sendMessage();

    this.refreshSessionSelect();
    this.renderMessages();
    this.maybeShowPrivacyNotice();
  }

  async onClose(): Promise<void> {
    this.stopGeneration();
  }

  private maybeShowPrivacyNotice(): void {
    if (this.plugin.settings.hasAcknowledgedPrivacy) {
      return;
    }
    new PrivacyNoticeModal(
      this.app,
      () => {
        this.plugin.settings.hasAcknowledgedPrivacy = true;
        void this.plugin.saveSettings();
      },
      () => {
        this.app.setting.open();
        this.app.setting.openTabById(this.plugin.manifest.id);
      },
    ).open();
  }

  private refreshSessionSelect(): void {
    const sessions = this.plugin.sessions.listSessions();
    const active = this.plugin.sessions.getActive();
    this.sessionSelectEl.empty();
    for (const session of sessions) {
      const opt = this.sessionSelectEl.createEl("option", { text: session.title, value: session.id });
      if (session.id === active?.id) {
        opt.selected = true;
      }
    }
    if (sessions.length === 0) {
      this.sessionSelectEl.createEl("option", { text: "New chat", value: "" });
    }
  }

  private openMentionPicker(): void {
    new VaultFileSuggestModal(this.app, (file) => {
      if (this.attachments.some((a) => a.path === file.path)) {
        return;
      }
      this.attachments.push({ path: file.path, label: file.basename });
      this.renderContextChips();
      const mention = `[[${file.basename}]] `;
      this.composerEl.value = `${this.composerEl.value}${mention}`;
      this.composerEl.focus();
    }).open();
  }

  private renderContextChips(): void {
    this.chipsEl.empty();
    const chips: Array<{ label: string; onRemove?: () => void }> = [];

    const activeNote = this.plugin.contextBuilder.getActiveNoteLabel();
    if (activeNote && this.plugin.settings.includeActiveNote) {
      chips.push({ label: `📄 ${activeNote}` });
    }

    const selection = this.plugin.contextBuilder.getSelectionSummary();
    if (selection) {
      chips.push({ label: `✂️ selection (${selection.chars} chars)` });
    }

    for (const att of this.attachments) {
      chips.push({
        label: `📎 ${att.label}`,
        onRemove: () => {
          this.attachments = this.attachments.filter((a) => a.path !== att.path);
          this.renderContextChips();
        },
      });
    }

    if (chips.length === 0) {
      this.chipsEl.style.display = "none";
      return;
    }

    this.chipsEl.style.display = "flex";
    for (const chip of chips) {
      const el = this.chipsEl.createSpan({ cls: "cursor-chat-chip", text: chip.label });
      if (chip.onRemove) {
        const remove = el.createSpan({ cls: "cursor-chat-chip-remove", text: "×" });
        remove.onclick = chip.onRemove;
      }
    }
  }

  private updateStatus(): void {
    const { backend, byok, cursor } = this.plugin.settings;

    if (backend === "cursor-sdk-local") {
      const { bridgeUrl } = cursor;
      if (!bridgeUrl.trim()) {
        this.statusEl.setText("Configure bridge URL in settings.");
        return;
      }
      this.statusEl.setText(`SDK bridge · ${bridgeUrl}`);
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
      this.statusEl.setText("Configure LLM provider in settings.");
      return;
    }
    const label = BYOK_PROVIDER_PRESETS[byok.provider]?.label ?? "BYOK";
    this.statusEl.setText(`${label} · ${byok.model}`);
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

  private appendToolCard(
    parent: HTMLElement,
    name: string,
    status: string,
    args?: string,
    result?: string,
  ): HTMLElement {
    const card = parent.createDiv({ cls: "cursor-chat-tool-card" });
    card.createDiv({ cls: "cursor-chat-tool-card-header", text: `tool: ${name} · ${status}` });
    if (args || result) {
      const details = card.createEl("details");
      details.createEl("summary", { text: "Details" });
      const pre = details.createEl("pre", { cls: "cursor-chat-tool-card-body" });
      pre.setText([args ? `args: ${args}` : "", result ? `result: ${result}` : ""].filter(Boolean).join("\n"));
    }
    return card;
  }

  private setStreaming(streaming: boolean): void {
    this.sendBtn.disabled = streaming;
    this.composerEl.disabled = streaming;
    this.stopBtn.style.display = streaming ? "inline-block" : "none";
    if (streaming) {
      this.messagesEl.addClass("cursor-chat-streaming");
    } else {
      this.messagesEl.removeClass("cursor-chat-streaming");
    }
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

    const session = this.plugin.sessions.ensureActive(this.plugin.settings.backend);
    const attachmentPaths = this.attachments.map((a) => a.path);

    const userMsg: StoredMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    this.plugin.sessions.addMessage(session.id, userMsg);
    this.composerEl.value = "";
    this.attachments = [];
    this.renderContextChips();
    this.refreshSessionSelect();
    this.renderMessages();

    const assistantMsg: StoredMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    this.plugin.sessions.addMessage(session.id, assistantMsg);
    const assistantBubble = this.messagesEl.createDiv({
      cls: "cursor-chat-bubble cursor-chat-bubble--assistant",
    });
    assistantBubble.createDiv({ cls: "cursor-chat-bubble-label", text: "Assistant" });
    const assistantBody = assistantBubble.createDiv({ cls: "cursor-chat-bubble-body" });
    const toolContainer = assistantBubble.createDiv({ cls: "cursor-chat-tool-cards" });

    this.abortController = new AbortController();
    this.setStreaming(true);

    const contextPrefix = await this.plugin.contextBuilder.build(attachmentPaths);

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
          full += `\n\n<details><summary>Thinking</summary>\n\n${event.text}\n\n</details>`;
          assistantBody.empty();
          await MarkdownRenderer.render(this.app, full, assistantBody, "", this);
        } else if (event.type === "tool-call") {
          this.appendToolCard(toolContainer, event.name, event.status, event.args, event.result);
          this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
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
      this.renderContextChips();
    }
  }
}
