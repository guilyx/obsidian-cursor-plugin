import { ItemView, MarkdownRenderer, Menu, Notice, TFile, TFolder, WorkspaceLeaf, setIcon } from "obsidian";
import type CursorChatPlugin from "../main";
import { VIEW_TYPE } from "../constants";
import type { ChatSession } from "../types/chat";
import type { StoredMessage } from "../types/chat";
import { vaultPathsFromDragEvent, attachmentFromAbstractFile } from "../context/vaultDragPath";
import { BACKEND_LABELS } from "../backends/backendIds";
import type { ChatBackendId } from "../types/chat";
import type { CursorConversationMode } from "../types/cursor-api";
import { BYOK_PROVIDER_PRESETS } from "../settings/byokProviders";
import { VaultPathSuggestModal } from "./VaultPathSuggestModal";
import { PrivacyNoticeModal } from "./PrivacyNoticeModal";
import {
  attachmentChipLabel,
  attachmentKey,
  mergeAttachments,
  type ChatAttachment,
} from "./chatAttachments";
import { formatChatErrorStorage, presentChatError } from "./chatErrorPresentation";

interface FailedTurn {
  sessionId: string;
  userText: string;
  attachments: ChatAttachment[];
  assistantMsgId: string;
}

export class CursorChatView extends ItemView {
  private messagesEl!: HTMLElement;
  private chipsEl!: HTMLElement;
  private composerWrapEl!: HTMLElement;
  private sessionSelectEl!: HTMLSelectElement;
  private backendSelectEl!: HTMLSelectElement;
  private modelInputEl!: HTMLInputElement;
  private modeSelectEl!: HTMLSelectElement;
  private quickSwitcherEl!: HTMLElement;
  private modelFieldEl!: HTMLElement;
  private modeFieldEl!: HTMLElement;
  private composerEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private abortController: AbortController | null = null;
  private attachments: ChatAttachment[] = [];
  private lastFailedTurn: FailedTurn | null = null;

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

    this.createIconButton(headerActions, "paperclip", "Attach note or folder", () => this.openAttachPicker());
    this.createIconButton(headerActions, "settings", "Open settings", () => this.plugin.openSettings());

    this.createIconButton(headerActions, "plus", "New chat", () => {
      this.plugin.sessions.createSession(this.plugin.settings.backend);
      void this.plugin.persistSessions();
      this.refreshSessionSelect();
      this.renderMessages();
      this.updateStatus();
    });

    this.createIconButton(headerActions, "more-horizontal", "More actions", (evt) => this.openHeaderMenu(evt));

    this.quickSwitcherEl = root.createDiv({ cls: "cursor-chat-quick-switcher" });
    this.buildQuickSwitcher(this.quickSwitcherEl);

    this.messagesEl = root.createDiv({ cls: "cursor-chat-messages" });
    this.messagesEl.setAttr("role", "log");
    this.messagesEl.setAttr("aria-live", "polite");
    this.registerDropTarget(this.messagesEl);

    this.statusEl = root.createDiv({ cls: "cursor-chat-status" });
    this.updateStatus();

    this.chipsEl = root.createDiv({ cls: "cursor-chat-chips" });
    this.renderContextChips();

    this.composerWrapEl = root.createDiv({ cls: "cursor-chat-composer-wrap" });
    this.composerEl = this.composerWrapEl.createEl("textarea", {
      cls: "cursor-chat-composer",
      attr: {
        placeholder: "Ask about your notes… (@ to attach, drag notes or folders here)",
        "aria-label": "Message",
      },
    });
    this.composerEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.sendMessage();
      }
      if (e.key === "@") {
        window.setTimeout(() => this.openAttachPicker(), 0);
      }
    });

    this.registerDropTarget(this.composerWrapEl);
    this.registerDropTarget(this.chipsEl);

    const actions = this.composerWrapEl.createDiv({ cls: "cursor-chat-actions" });
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

  /** Insert text into the composer and focus it. */
  insertComposerText(text: string): void {
    this.composerEl.value = this.composerEl.value ? `${this.composerEl.value}\n\n${text}` : text;
    this.composerEl.focus();
    this.renderContextChips();
  }

  /** Set composer text and send (used by send-selection command). */
  async sendComposerText(text: string): Promise<void> {
    this.composerEl.value = text;
    await this.sendMessage();
  }

  private buildQuickSwitcher(parent: HTMLElement): void {
    const backendField = parent.createDiv({ cls: "cursor-chat-quick-field" });
    backendField.createSpan({ text: "Backend", cls: "cursor-chat-quick-label" });
    this.backendSelectEl = backendField.createEl("select", { cls: "cursor-chat-quick-select" });
    for (const [id, label] of Object.entries(BACKEND_LABELS) as [ChatBackendId, string][]) {
      this.backendSelectEl.createEl("option", { text: label, value: id });
    }
    this.backendSelectEl.addEventListener("change", () => void this.onBackendQuickChange());

    this.modelFieldEl = parent.createDiv({ cls: "cursor-chat-quick-field" });
    this.modelFieldEl.createSpan({ text: "Model", cls: "cursor-chat-quick-label" });
    this.modelInputEl = this.modelFieldEl.createEl("input", {
      cls: "cursor-chat-quick-input",
      attr: { type: "text", placeholder: "account default" },
    });
    this.modelInputEl.addEventListener("change", () => void this.onModelQuickChange());

    this.modeFieldEl = parent.createDiv({ cls: "cursor-chat-quick-field" });
    this.modeFieldEl.createSpan({ text: "Mode", cls: "cursor-chat-quick-label" });
    this.modeSelectEl = this.modeFieldEl.createEl("select", { cls: "cursor-chat-quick-select" });
    for (const mode of ["agent", "plan"] as CursorConversationMode[]) {
      this.modeSelectEl.createEl("option", { text: mode, value: mode });
    }
    this.modeSelectEl.addEventListener("change", () => void this.onModeQuickChange());

    this.refreshQuickSwitcher();
  }

  private refreshQuickSwitcher(): void {
    const { backend, cursor, byok } = this.plugin.settings;
    this.backendSelectEl.value = backend;

    const showModel = backend !== "cursor-agent";
    const showMode = backend === "cursor-sdk";
    this.modelFieldEl.style.display = showModel ? "" : "none";
    this.modeFieldEl.style.display = showMode ? "" : "none";

    if (backend === "cursor-sdk") {
      this.modelInputEl.value = cursor.defaultModelId;
      this.modelInputEl.placeholder = "account default";
      this.modeSelectEl.value = cursor.defaultMode;
    } else if (backend === "llm-gateway") {
      this.modelInputEl.value = byok.model;
      this.modelInputEl.placeholder = "model id";
    }
  }

  private async onBackendQuickChange(): Promise<void> {
    const next = this.backendSelectEl.value as ChatBackendId;
    if (next === this.plugin.settings.backend) {
      return;
    }
    this.plugin.settings.backend = next;
    await this.plugin.saveSettings();
    this.refreshQuickSwitcher();
    this.updateStatus();
  }

  private async onModelQuickChange(): Promise<void> {
    const value = this.modelInputEl.value.trim();
    if (this.plugin.settings.backend === "cursor-sdk") {
      this.plugin.settings.cursor.defaultModelId = value;
    } else if (this.plugin.settings.backend === "llm-gateway") {
      this.plugin.settings.byok.model = value;
    }
    await this.plugin.saveSettings();
    this.updateStatus();
  }

  private async onModeQuickChange(): Promise<void> {
    this.plugin.settings.cursor.defaultMode = this.modeSelectEl.value as CursorConversationMode;
    await this.plugin.saveSettings();
    this.updateStatus();
  }

  private createIconButton(
    parent: HTMLElement,
    icon: string,
    label: string,
    onClick: (evt: MouseEvent) => void,
  ): HTMLButtonElement {
    const btn = parent.createEl("button", { cls: "cursor-chat-icon-btn clickable-icon", attr: { "aria-label": label } });
    setIcon(btn, icon);
    btn.addEventListener("click", onClick);
    return btn;
  }

  private registerDropTarget(el: HTMLElement): void {
    this.registerDomEvent(el, "dragover", (evt) => {
      evt.preventDefault();
      el.addClass("cursor-chat-drop-target");
    });
    this.registerDomEvent(el, "dragleave", () => {
      el.removeClass("cursor-chat-drop-target");
    });
    this.registerDomEvent(el, "drop", (evt) => {
      evt.preventDefault();
      el.removeClass("cursor-chat-drop-target");
      this.handleDrop(evt);
    });
  }

  private handleDrop(evt: DragEvent): void {
    const paths = vaultPathsFromDragEvent(this.app, evt);
    if (paths.length === 0) {
      return;
    }
    for (const path of paths) {
      this.attachFromVaultPath(path);
    }
  }

  private attachFromVaultPath(path: string): void {
    const file = this.app.vault.getAbstractFileByPath(path);
    const att = file ? attachmentFromAbstractFile(file) : null;
    if (att) {
      this.addAttachment(att);
      return;
    }
    new Notice(`Could not attach: ${path}`);
  }

  private openHeaderMenu(evt: MouseEvent): void {
    const session = this.plugin.sessions.getActive();
    const menu = new Menu();

    menu.addItem((item) => {
      item.setTitle("Attach note or folder").setIcon("paperclip").onClick(() => this.openAttachPicker());
    });
    menu.addItem((item) => {
      item
        .setTitle("Include active note")
        .setIcon("file-text")
        .setChecked(this.plugin.settings.includeActiveNote)
        .onClick(async () => {
          this.plugin.settings.includeActiveNote = !this.plugin.settings.includeActiveNote;
          await this.plugin.saveSettings();
          this.renderContextChips();
        });
    });
    menu.addItem((item) => {
      item.setTitle("Settings").setIcon("settings").onClick(() => this.plugin.openSettings());
    });
    menu.addItem((item) => {
      item.setTitle("Set up Cursor Chat").setIcon("wand").onClick(() => this.plugin.openSetupWizard());
    });

    if (session) {
      menu.addSeparator();
      menu.addItem((item) => {
        item
          .setTitle("Delete chat")
          .setIcon("trash")
          .onClick(() => {
            this.plugin.sessions.deleteSession(session.id);
            void this.plugin.persistSessions();
            this.refreshSessionSelect();
            this.renderMessages();
            this.updateStatus();
          });
      });
    }

    menu.showAtMouseEvent(evt);
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
      () => this.plugin.openSettings(),
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

  private openAttachPicker(): void {
    new VaultPathSuggestModal(this.app, (item) => {
      const att = attachmentFromAbstractFile(item);
      if (!att) {
        return;
      }
      this.addAttachment(att);
      if (item instanceof TFile) {
        const mention = `[[${item.basename}]] `;
        this.composerEl.value = `${this.composerEl.value}${mention}`;
      }
      this.composerEl.focus();
    }).open();
  }

  private addAttachment(att: ChatAttachment): void {
    this.attachments = mergeAttachments(this.attachments, [att]);
    this.renderContextChips();
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
        label: attachmentChipLabel(att),
        onRemove: () => {
          const key = attachmentKey(att);
          this.attachments = this.attachments.filter((a) => attachmentKey(a) !== key);
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
    this.statusEl.removeClass("cursor-chat-status--action");
    this.statusEl.removeClass("cursor-chat-status--error");

    if (backend === "cursor-agent") {
      const keyHint = cursor.apiKey.trim() ? "API key set" : "login or API key";
      this.statusEl.setText(`Cursor Agent · ${this.plugin.settings.cursorAgent.cliPath} · ${keyHint}`);
      return;
    }

    if (backend === "cursor-sdk") {
      if (!cursor.apiKey.trim()) {
        this.statusEl.setText("Configure Cursor API key — click to open settings.");
        this.statusEl.addClass("cursor-chat-status--action");
        this.statusEl.onclick = () => this.plugin.openSettings();
        return;
      }
      const model = cursor.defaultModelId || "default model";
      this.statusEl.setText(`Cursor SDK · ${model} · ${cursor.defaultMode}`);
      this.statusEl.onclick = null;
      return;
    }

    if (!byok.baseUrl || !byok.model) {
      this.statusEl.setText("Configure LLM gateway — click to open settings.");
      this.statusEl.addClass("cursor-chat-status--action");
      this.statusEl.onclick = () => this.plugin.openSettings();
      return;
    }
    const label = BYOK_PROVIDER_PRESETS[byok.provider]?.label ?? "LLM gateway";
    this.statusEl.setText(`${label} · ${byok.model}`);
    this.statusEl.onclick = null;
  }

  private renderMessages(): void {
    this.messagesEl.empty();
    const session = this.plugin.sessions.ensureActive(this.plugin.settings.backend);

    if (session.messages.length === 0) {
      this.messagesEl.createDiv({
        cls: "cursor-chat-empty",
        text: "Ask questions about your notes. Drag a note or folder here, type @ to attach, or use the toolbar.",
      });
      return;
    }

    for (const msg of session.messages) {
      this.appendMessageBubble(msg);
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private appendMessageBubble(msg: StoredMessage): HTMLElement {
    const isError = msg.role === "assistant" && msg.content.startsWith("Error:");
    const bubble = this.messagesEl.createDiv({
      cls: `cursor-chat-bubble cursor-chat-bubble--${msg.role}${isError ? " cursor-chat-bubble--error" : ""}`,
    });
    bubble.createDiv({ cls: "cursor-chat-bubble-label", text: msg.role === "user" ? "You" : "Assistant" });
    const body = bubble.createDiv({ cls: "cursor-chat-bubble-body" });
    if (msg.role === "assistant") {
      if (isError) {
        this.renderErrorBubble(bubble, body, msg.content, msg.id);
      } else {
        void MarkdownRenderer.render(this.app, msg.content, body, "", this);
      }
    } else {
      body.setText(msg.content);
    }
    return body;
  }

  private getRetryContext(
    session: ChatSession,
    assistantMsgId: string,
  ): { userText: string; attachments: ChatAttachment[] } | null {
    const assistantIdx = session.messages.findIndex((m) => m.id === assistantMsgId);
    if (assistantIdx <= 0) {
      return null;
    }
    const userMsg = session.messages[assistantIdx - 1];
    if (userMsg.role !== "user") {
      return null;
    }
    if (this.lastFailedTurn?.assistantMsgId === assistantMsgId) {
      return {
        userText: this.lastFailedTurn.userText,
        attachments: [...this.lastFailedTurn.attachments],
      };
    }
    return { userText: userMsg.content, attachments: [] };
  }

  private async retryTurn(assistantMsgId: string): Promise<void> {
    if (this.abortController) {
      return;
    }
    const session = this.plugin.sessions.getActive();
    if (!session) {
      return;
    }
    const ctx = this.getRetryContext(session, assistantMsgId);
    if (!ctx) {
      return;
    }

    const assistantIdx = session.messages.findIndex((m) => m.id === assistantMsgId);
    if (assistantIdx < 0) {
      return;
    }
    session.messages.splice(assistantIdx, 1);
    if (this.lastFailedTurn?.assistantMsgId === assistantMsgId) {
      this.lastFailedTurn = null;
    }
    await this.plugin.persistSessions();
    this.renderMessages();

    await this.runAssistantTurn(session, ctx.userText, ctx.attachments);
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
    const attachments = [...this.attachments];

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

    await this.runAssistantTurn(session, text, attachments);
  }

  private async runAssistantTurn(
    session: ChatSession,
    userText: string,
    attachments: ChatAttachment[],
  ): Promise<void> {
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

    const contextPrefix = await this.plugin.contextBuilder.build(attachments);
    let hadError = false;

    try {
      const backend = this.plugin.router.getBackend();
      let full = "";
      for await (const event of backend.send({
        session,
        userText,
        contextPrefix,
        signal: this.abortController.signal,
      })) {
        if (event.type === "run-started") {
          this.plugin.sessions.setCursorAgentId(session.id, event.agentId);
          this.statusEl.setText(`Cursor SDK · run ${event.runId.slice(0, 8)}…`);
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
          hadError = true;
          const stored = formatChatErrorStorage(presentChatError(event.message, this.plugin.settings.backend));
          this.renderErrorBubble(assistantBubble, assistantBody, event.message, assistantMsg.id);
          full = stored;
        }
      }
      this.plugin.sessions.updateAssistantMessage(session.id, assistantMsg.id, full);
      await this.plugin.persistSessions();
      if (hadError || full.startsWith("Error:")) {
        this.lastFailedTurn = {
          sessionId: session.id,
          userText,
          attachments: [...attachments],
          assistantMsgId: assistantMsg.id,
        };
        this.renderMessages();
      } else if (this.lastFailedTurn?.assistantMsgId === assistantMsg.id) {
        this.lastFailedTurn = null;
      }
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const msg = err instanceof Error ? err.message : String(err);
        const stored = formatChatErrorStorage(presentChatError(msg, this.plugin.settings.backend));
        this.renderErrorBubble(assistantBubble, assistantBody, msg, assistantMsg.id);
        this.plugin.sessions.updateAssistantMessage(session.id, assistantMsg.id, stored);
        await this.plugin.persistSessions();
        this.lastFailedTurn = {
          sessionId: session.id,
          userText,
          attachments: [...attachments],
          assistantMsgId: assistantMsg.id,
        };
        this.renderMessages();
      }
    } finally {
      this.abortController = null;
      this.setStreaming(false);
      this.updateStatus();
      this.renderContextChips();
    }
  }

  private renderErrorBubble(
    bubble: HTMLElement,
    body: HTMLElement,
    rawMessage: string,
    assistantMsgId: string,
  ): void {
    const presentation = presentChatError(rawMessage, this.plugin.settings.backend);
    bubble.addClass("cursor-chat-bubble--error");

    const label = bubble.querySelector(".cursor-chat-bubble-label");
    if (label) {
      label.setText("Error");
    }

    body.empty();
    const card = body.createDiv({ cls: "cursor-chat-error-card" });

    const titleRow = card.createDiv({ cls: "cursor-chat-error-title-row" });
    const icon = titleRow.createSpan({ cls: "cursor-chat-error-icon" });
    setIcon(icon, "alert-triangle");
    titleRow.createSpan({ cls: "cursor-chat-error-title", text: presentation.title });

    card.createDiv({ cls: "cursor-chat-error-summary", text: presentation.summary });

    if (presentation.hint) {
      card.createDiv({ cls: "cursor-chat-error-hint", text: presentation.hint });
    }

    if (presentation.technical && presentation.technical !== presentation.summary) {
      const details = card.createEl("details", { cls: "cursor-chat-error-details" });
      details.createEl("summary", { text: "Technical details" });
      details.createEl("pre", { cls: "cursor-chat-error-technical" }).setText(presentation.technical);
    }

    const actions = card.createDiv({ cls: "cursor-chat-error-actions" });
    const retryBtn = actions.createEl("button", {
      text: "Retry",
      cls: "cursor-chat-retry-btn mod-cta",
    });
    retryBtn.onclick = () => void this.retryTurn(assistantMsgId);

    if (presentation.showOpenSettings) {
      const settingsBtn = actions.createEl("button", {
        text: "Settings",
        cls: "cursor-chat-error-btn",
      });
      settingsBtn.onclick = () => this.plugin.openSettings();
    }

    if (presentation.showSwitchBackend) {
      const switchBtn = actions.createEl("button", {
        text: "Switch backend",
        cls: "cursor-chat-error-btn",
      });
      switchBtn.onclick = () => {
        this.backendSelectEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        this.backendSelectEl.focus();
      };
    }

    this.statusEl.setText(presentation.summary);
    this.statusEl.addClass("cursor-chat-status--error");
  }
}
