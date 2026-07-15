import { App, Modal, Setting } from "obsidian";
import type CursorChatPlugin from "../main";
import type { ChatBackendId } from "../types/chat";
import { BACKEND_LABELS } from "../backends/backendIds";

type SetupStep = "choose" | "configure" | "done";

export class SetupWizardModal extends Modal {
  private step: SetupStep = "choose";
  private chosen: ChatBackendId = "cursor-sdk";

  constructor(
    app: App,
    private readonly plugin: CursorChatPlugin,
  ) {
    super(app);
    this.chosen = this.plugin.settings.backend;
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("cursor-chat-setup-wizard");

    if (this.step === "choose") {
      this.renderChoose();
    } else if (this.step === "configure") {
      void this.renderConfigure();
    } else {
      this.renderDone();
    }
  }

  private renderChoose(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Set up Cursor Chat" });
    contentEl.createEl("p", {
      text: "Pick how this plugin talks to AI. You can change this later in settings.",
    });

    const options: Array<{ id: ChatBackendId; desc: string }> = [
      {
        id: "cursor-sdk",
        desc: "Call Cursor agents via @cursor/sdk — local bridge (default) or cloud REST. Same crsr_… key.",
      },
      {
        id: "cursor-agent",
        desc: "Run the Cursor Agent CLI locally. Uses your Cursor API key or machine login.",
      },
      {
        id: "llm-gateway",
        desc: "Bring your own models via OpenRouter, LiteLLM, or any OpenAI-compatible API.",
      },
    ];

    for (const opt of options) {
      const row = contentEl.createDiv({ cls: "cursor-chat-setup-option" });
      const label = row.createEl("label");
      const radio = label.createEl("input", { type: "radio" });
      radio.name = "cursor-chat-backend";
      radio.checked = this.chosen === opt.id;
      radio.onchange = () => {
        this.chosen = opt.id;
      };
      label.createSpan({ text: ` ${BACKEND_LABELS[opt.id]}` });
      row.createEl("p", { cls: "setting-item-description", text: opt.desc });
    }

    const actions = contentEl.createDiv({ cls: "modal-button-container" });
    actions
      .createEl("button", { text: "Continue", cls: "mod-cta" })
      .addEventListener("click", () => {
        this.plugin.settings.backend = this.chosen;
        this.step = "configure";
        this.onOpen();
      });
  }

  private async renderConfigure(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: `Configure ${BACKEND_LABELS[this.chosen]}` });

    const status = contentEl.createDiv({ cls: "cursor-chat-setup-status" });

    if (this.chosen === "cursor-sdk") {
      contentEl.createEl("p", {
        text: "Get a key from Cursor Dashboard → Integrations. Format: crsr_…",
      });
      new Setting(contentEl)
        .setName("Cursor API key")
        .addText((text) =>
          text
            .setPlaceholder("crsr_…")
            .setValue(this.plugin.settings.cursor.apiKey)
            .onChange((value) => {
              this.plugin.settings.cursor.apiKey = value;
            }),
        );
    } else if (this.chosen === "cursor-agent") {
      contentEl.createEl("p", {
        text: "Install: curl https://cursor.com/install -fsS | bash. Use your Cursor API key (recommended) or run agent login.",
      });
      new Setting(contentEl)
        .setName("Cursor API key")
        .addText((text) =>
          text
            .setPlaceholder("crsr_…")
            .setValue(this.plugin.settings.cursor.apiKey)
            .onChange((value) => {
              this.plugin.settings.cursor.apiKey = value;
            }),
        );
      new Setting(contentEl)
        .setName("Agent command")
        .setDesc("Usually agent (or cursor-agent).")
        .addText((text) =>
          text
            .setValue(this.plugin.settings.cursorAgent.cliPath)
            .onChange((value) => {
              this.plugin.settings.cursorAgent.cliPath = value || "agent";
            }),
        );
    } else {
      contentEl.createEl("p", {
        text: "OpenRouter is the easiest BYOK path. LiteLLM works for self-hosted routing.",
      });
      this.plugin.settings.byok.provider = "openrouter";
      new Setting(contentEl)
        .setName("API key")
        .addText((text) =>
          text
            .setPlaceholder("sk-or-…")
            .setValue(this.plugin.settings.byok.apiKey)
            .onChange((value) => {
              this.plugin.settings.byok.apiKey = value;
            }),
        );
    }

    const actions = contentEl.createDiv({ cls: "modal-button-container" });
    const testBtn = actions.createEl("button", { text: "Test connection" });
    testBtn.addEventListener("click", () => {
      void (async () => {
        testBtn.setText("Testing…");
        testBtn.disabled = true;
        status.empty();
        try {
          await this.plugin.saveSettings();
          await this.plugin.validateBackend();
          status.createEl("p", { text: "Connection OK.", cls: "cursor-chat-setup-ok" });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          status.createEl("p", { text: msg, cls: "cursor-chat-settings-error" });
        } finally {
          testBtn.setText("Test connection");
          testBtn.disabled = false;
        }
      })();
    });

    actions
      .createEl("button", { text: "Finish", cls: "mod-cta" })
      .addEventListener("click", () => {
        void (async () => {
          this.plugin.settings.hasCompletedSetup = true;
          this.plugin.settings.hasAcknowledgedPrivacy = true;
          await this.plugin.saveSettings();
          this.step = "done";
          this.onOpen();
        })();
      });
  }

  private renderDone(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "You're set up" });
    contentEl.createEl("p", {
      text: `Backend: ${BACKEND_LABELS[this.plugin.settings.backend]}. Open the chat from the ribbon or command palette.`,
    });
    const actions = contentEl.createDiv({ cls: "modal-button-container" });
    actions
      .createEl("button", { text: "Open chat", cls: "mod-cta" })
      .addEventListener("click", () => {
        this.close();
        void this.plugin.activateChatView();
      });
    actions.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
