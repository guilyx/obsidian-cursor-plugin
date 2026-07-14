import { App, PluginSettingTab, Setting } from "obsidian";
import type CursorChatPlugin from "../main";
import type { CursorChatSettings } from "./CursorSettings";
import { CursorApiClient } from "../api/CursorApiClient";
import { BYOK_PROVIDER_PRESETS, applyByokProviderPreset } from "./byokProviders";

export class CursorSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CursorChatPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Cursor Chat" });

    containerEl.createEl("p", {
      text: "Cursor is the default backend. Use BYOK for OpenRouter, LiteLLM, or other OpenAI-compatible providers.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Backend")
      .setDesc("Cursor REST uses Cloud Agents API v1. BYOK routes to your chosen LLM gateway.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("cursor-rest", "Cursor (default)")
          .addOption("openai-compatible", "BYOK — OpenRouter / LiteLLM / …")
          .addOption("cursor-sdk-local", "Cursor SDK bridge (local)")
          .setValue(this.plugin.settings.backend)
          .onChange(async (value) => {
            this.plugin.settings.backend = value as CursorChatSettings["backend"];
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.backend === "cursor-sdk-local") {
      this.displayBridgeSettings(containerEl);
    } else if (this.plugin.settings.backend === "cursor-rest") {
      this.displayCursorRestSettings(containerEl);
    } else {
      this.displayByokSettings(containerEl);
    }

    this.displaySharedSettings(containerEl);
    this.displayTestConnection(containerEl);
  }

  private displayByokSettings(containerEl: HTMLElement): void {
    const byok = this.plugin.settings.byok;
    const preset = BYOK_PROVIDER_PRESETS[byok.provider];

    new Setting(containerEl)
      .setName("LLM provider")
      .setDesc("OpenRouter and LiteLLM both speak OpenAI-compatible APIs.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("openrouter", "OpenRouter")
          .addOption("litellm", "LiteLLM proxy")
          .addOption("openai", "OpenAI")
          .addOption("custom", "Custom base URL")
          .setValue(byok.provider)
          .onChange(async (value) => {
            applyByokProviderPreset(this.plugin.settings.byok, value as CursorChatSettings["byok"]["provider"]);
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: `Get a key: ${preset.helpUrl}`,
    });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Provider secret (leave empty for local LiteLLM/Ollama without auth).")
      .addText((text) =>
        text
          .setPlaceholder(preset.apiKeyPlaceholder)
          .setValue(byok.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.byok.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Base URL")
      .setDesc("OpenAI-compatible API root.")
      .addText((text) =>
        text
          .setPlaceholder(preset.baseUrl || "https://…/v1")
          .setValue(byok.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.byok.baseUrl = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc(byok.provider === "openrouter" ? "OpenRouter model id, e.g. anthropic/claude-sonnet-4" : undefined)
      .addText((text) =>
        text
          .setPlaceholder(preset.model || "model-id")
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
  }

  private displayCursorRestSettings(containerEl: HTMLElement): void {
    const cursor = this.plugin.settings.cursor;

    new Setting(containerEl)
      .setName("Cursor API key")
      .setDesc("From Cursor Dashboard → API Keys (format crsr_…).")
      .addText((text) =>
        text
          .setPlaceholder("crsr_…")
          .setValue(cursor.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.cursor.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default model")
      .setDesc("Leave empty to use Cursor account default. Use Fetch models to list options.")
      .addText((text) =>
        text
          .setPlaceholder("composer-2.5")
          .setValue(cursor.defaultModelId)
          .onChange(async (value) => {
            this.plugin.settings.cursor.defaultModelId = value;
            await this.plugin.saveSettings();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Fetch models").onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText("Fetching…");
          try {
            const key = this.plugin.settings.cursor.apiKey.trim();
            if (!key) {
              throw new Error("Enter a Cursor API key first.");
            }
            const models = await new CursorApiClient(key).listModels();
            const ids = models.map((m) => m.id).join(", ");
            containerEl.createEl("p", {
              text: ids ? `Available: ${ids}` : "No models returned.",
              cls: "setting-item-description",
            });
            btn.setButtonText("Done");
          } catch (err: unknown) {
            btn.setButtonText("Failed");
            const msg = err instanceof Error ? err.message : String(err);
            containerEl.createEl("p", { text: msg, cls: "cursor-chat-settings-error" });
          } finally {
            window.setTimeout(() => {
              btn.setDisabled(false);
              btn.setButtonText("Fetch models");
            }, 2000);
          }
        }),
      );

    new Setting(containerEl)
      .setName("Conversation mode")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("plan", "Plan")
          .addOption("agent", "Agent")
          .setValue(cursor.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.cursor.defaultMode = value as CursorChatSettings["cursor"]["defaultMode"];
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Show thinking")
      .setDesc("Stream thinking events when the API sends them.")
      .addToggle((toggle) =>
        toggle
          .setValue(cursor.showThinking)
          .onChange(async (value) => {
            this.plugin.settings.cursor.showThinking = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private displayBridgeSettings(containerEl: HTMLElement): void {
    const cursor = this.plugin.settings.cursor;

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Run the local bridge: cd bridge && BRIDGE_TOKEN=… npm start",
    });

    new Setting(containerEl)
      .setName("Bridge URL")
      .addText((text) =>
        text
          .setValue(cursor.bridgeUrl)
          .onChange(async (value) => {
            this.plugin.settings.cursor.bridgeUrl = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Bridge token")
      .setDesc("Must match BRIDGE_TOKEN on the bridge process.")
      .addText((text) =>
        text
          .setPlaceholder("dev-bridge-token")
          .setValue(cursor.bridgeToken)
          .onChange(async (value) => {
            this.plugin.settings.cursor.bridgeToken = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default model")
      .setDesc("Passed to bridge on agent create (stub ignores until full SDK).")
      .addText((text) =>
        text
          .setPlaceholder("composer-2.5")
          .setValue(cursor.defaultModelId)
          .onChange(async (value) => {
            this.plugin.settings.cursor.defaultModelId = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private displaySharedSettings(containerEl: HTMLElement): void {
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
  }

  private displayTestConnection(containerEl: HTMLElement): void {
    const isCursor = this.plugin.settings.backend === "cursor-rest";
    const isBridge = this.plugin.settings.backend === "cursor-sdk-local";
    new Setting(containerEl)
      .setName("Test connection")
      .setDesc(
        isBridge
          ? "Calls GET /health on the local bridge."
          : isCursor
            ? "Calls GET /v1/me on api.cursor.com."
            : "Calls GET /models on your base URL.",
      )
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
