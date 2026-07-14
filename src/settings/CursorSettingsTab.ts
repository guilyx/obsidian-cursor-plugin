import { App, PluginSettingTab, Setting } from "obsidian";
import type CursorChatPlugin from "../main";
import type { CursorChatSettings } from "./CursorSettings";

export class CursorSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CursorChatPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Cursor Chat" });

    containerEl.createEl("p", {
      text: "BYOK mode sends note context to your chosen provider. Keys are stored locally in plugin data.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Backend")
      .setDesc("cursor-rest and SDK bridge arrive in later PRs.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("openai-compatible", "BYOK (OpenAI-compatible)")
          .addOption("cursor-rest", "Cursor REST (coming soon)")
          .addOption("cursor-sdk-local", "Cursor SDK bridge (coming soon)")
          .setValue(this.plugin.settings.backend)
          .onChange(async (value) => {
            this.plugin.settings.backend = value as CursorChatSettings["backend"];
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.backend !== "openai-compatible") {
      containerEl.createEl("p", {
        text: "Selected backend is not available yet. Switch to BYOK to chat.",
        cls: "cursor-chat-settings-warn",
      });
      return;
    }

    const byok = this.plugin.settings.byok;

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Provider secret (leave empty for local Ollama without auth).")
      .addText((text) =>
        text
          .setPlaceholder("sk-…")
          .setValue(byok.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.byok.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Base URL")
      .setDesc("OpenAI-compatible API root, e.g. https://api.openai.com/v1")
      .addText((text) =>
        text
          .setValue(byok.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.byok.baseUrl = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Model")
      .addText((text) =>
        text
          .setValue(byok.model)
          .onChange(async (value) => {
            this.plugin.settings.byok.model = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Temperature")
      .addSlider((slider) =>
        slider
          .setLimits(0, 2, 0.1)
          .setValue(byok.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.byok.temperature = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max tokens")
      .addText((text) =>
        text
          .setValue(String(byok.maxTokens))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!Number.isNaN(n)) {
              this.plugin.settings.byok.maxTokens = n;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Include active note")
      .setDesc("Inject the open note into each message.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeActiveNote)
          .onChange(async (value) => {
            this.plugin.settings.includeActiveNote = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max context characters")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.maxContextChars))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!Number.isNaN(n)) {
              this.plugin.settings.maxContextChars = n;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Test connection")
      .setDesc("Calls GET /models on your base URL.")
      .addButton((btn) =>
        btn.setButtonText("Test").onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText("Testing…");
          try {
            await this.plugin.validateBackend();
            btn.setButtonText("OK");
          } catch (err: unknown) {
            btn.setButtonText("Failed");
            const msg = err instanceof Error ? err.message : String(err);
            containerEl.createEl("p", { text: msg, cls: "cursor-chat-settings-error" });
          } finally {
            window.setTimeout(() => {
              btn.setDisabled(false);
              btn.setButtonText("Test");
            }, 2000);
          }
        }),
      );
  }
}
