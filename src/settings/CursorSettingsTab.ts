import { App, PluginSettingTab, Setting } from "obsidian";
import type CursorChatPlugin from "../main";
import type { CursorChatSettings } from "./CursorSettings";
import { CursorApiClient } from "../api/CursorApiClient";
import { BYOK_PROVIDER_PRESETS, applyByokProviderPreset } from "./byokProviders";
import { BACKEND_LABELS } from "../backends/backendIds";

export class CursorSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CursorChatPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Cursor Chat" });

    new Setting(containerEl)
      .setName("Run setup wizard")
      .setDesc("Re-run first-time configuration for backend and credentials.")
      .addButton((btn) =>
        btn.setButtonText("Set up").onClick(() => {
          this.plugin.openSetupWizard();
        }),
      );

    containerEl.createEl("p", {
      text: "Three backends: Cursor agent (API key), Cursor Agent CLI (API key or login), or other models via LiteLLM/OpenRouter.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Backend")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("cursor-sdk", BACKEND_LABELS["cursor-sdk"])
          .addOption("cursor-agent", BACKEND_LABELS["cursor-agent"])
          .addOption("llm-gateway", BACKEND_LABELS["llm-gateway"])
          .setValue(this.plugin.settings.backend)
          .onChange(async (value) => {
            this.plugin.settings.backend = value as CursorChatSettings["backend"];
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.backend === "cursor-sdk") {
      this.displayCursorSdkSettings(containerEl);
    } else if (this.plugin.settings.backend === "cursor-agent") {
      this.displayCursorAgentSettings(containerEl);
    } else {
      this.displayLlmGatewaySettings(containerEl);
    }

    this.displaySharedSettings(containerEl);
    this.displayTestConnection(containerEl);
  }

  private displayLlmGatewaySettings(containerEl: HTMLElement): void {
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

    containerEl.createEl("p", { cls: "setting-item-description", text: `Get a key: ${preset.helpUrl}` });

    new Setting(containerEl)
      .setName("API key")
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
      .addText((text) =>
        text
          .setPlaceholder(preset.baseUrl || "https://…/v1")
          .setValue(byok.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.byok.baseUrl = value;
            await this.plugin.saveSettings();
          }),
      );

    const modelSetting = new Setting(containerEl).setName("Model");
    if (byok.provider === "openrouter") {
      modelSetting.setDesc("OpenRouter model id, e.g. anthropic/claude-sonnet-4");
    } else if (byok.provider === "litellm") {
      modelSetting.setDesc("Model name configured in your LiteLLM proxy");
    }
    modelSetting.addText((text) =>
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

  private displayCursorSdkSettings(containerEl: HTMLElement): void {
    const cursor = this.plugin.settings.cursor;

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Cursor SDK — local mode runs @cursor/sdk on your vault folder (server starts automatically). Cloud mode uses the remote Cloud Agents REST API.",
    });

    new Setting(containerEl)
      .setName("SDK runtime")
      .setDesc("Local runs agents on your vault. Cloud runs agents in Cursor's infrastructure (needs usage-based pricing).")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("local", "Local (vault folder)")
          .addOption("cloud", "Cloud (REST API)")
          .setValue(cursor.sdkRuntime)
          .onChange(async (value) => {
            this.plugin.settings.cursor.sdkRuntime = value as typeof cursor.sdkRuntime;
            this.plugin.sessions.clearCursorAgentIdsForRuntime(this.plugin.settings.cursor.sdkRuntime);
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (cursor.sdkRuntime === "local") {
      new Setting(containerEl)
        .setName("Local SDK URL")
        .setDesc("Advanced — leave default unless you run your own server.")
        .addText((text) =>
          text
            .setPlaceholder("http://127.0.0.1:8765")
            .setValue(cursor.bridgeUrl)
            .onChange(async (value) => {
              this.plugin.settings.cursor.bridgeUrl = value.trim() || "http://127.0.0.1:8765";
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Local SDK token")
        .setDesc("Optional — only if you set BRIDGE_TOKEN on a custom server.")
        .addText((text) =>
          text
            .setValue(cursor.bridgeToken)
            .onChange(async (value) => {
              this.plugin.settings.cursor.bridgeToken = value;
              await this.plugin.saveSettings();
            }),
        );
    }

    new Setting(containerEl)
      .setName("Cursor API key")
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
      .setDesc("Leave empty for account default.")
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
      .addToggle((toggle) =>
        toggle
          .setValue(cursor.showThinking)
          .onChange(async (value) => {
            this.plugin.settings.cursor.showThinking = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private displayCursorAgentSettings(containerEl: HTMLElement): void {
    const agent = this.plugin.settings.cursorAgent;
    const cursor = this.plugin.settings.cursor;

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Runs `agent -p` in your vault folder. Set a Cursor API key (recommended) or use `agent login` on this machine.",
    });

    new Setting(containerEl)
      .setName("Cursor API key")
      .setDesc("Passed to the CLI as CURSOR_API_KEY. Same key as Cursor agent (API) backend.")
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
      .setName("Agent command")
      .setDesc("Install: curl https://cursor.com/install -fsS | bash")
      .addText((text) =>
        text
          .setPlaceholder("agent")
          .setValue(agent.cliPath)
          .onChange(async (value) => {
            this.plugin.settings.cursorAgent.cliPath = value.trim() || "agent";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Auto-approve (yolo)")
      .setDesc("Pass --yolo and --trust to skip CLI confirmation prompts.")
      .addToggle((toggle) =>
        toggle
          .setValue(agent.yoloMode)
          .onChange(async (value) => {
            this.plugin.settings.cursorAgent.yoloMode = value;
            await this.plugin.saveSettings();
          }),
      );
  }

  private displaySharedSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Include active note")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeActiveNote)
          .onChange(async (value) => {
            this.plugin.settings.includeActiveNote = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Send selection immediately")
      .setDesc("When using the send-selection command, send at once instead of inserting into the composer.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.sendSelectionImmediately)
          .onChange(async (value) => {
            this.plugin.settings.sendSelectionImmediately = value;
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
    const backend = this.plugin.settings.backend;
    const desc =
      backend === "cursor-agent"
        ? "Runs agent --version in your vault directory."
        : backend === "cursor-sdk"
          ? this.plugin.settings.cursor.sdkRuntime === "local"
            ? "Starts local SDK if needed, then checks /health and vault path."
            : "Calls GET /v1/me on api.cursor.com."
          : "Calls GET /models on your LLM gateway URL.";

    new Setting(containerEl)
      .setName("Test connection")
      .setDesc(desc)
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
