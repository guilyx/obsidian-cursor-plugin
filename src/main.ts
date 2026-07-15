import { Plugin, WorkspaceLeaf, addIcon, FileSystemAdapter, requestUrl } from "obsidian";
import { DEFAULT_SETTINGS, type CursorChatSettings } from "./settings/CursorSettings";
import { inferByokProvider } from "./settings/byokProviders";
import { migrateBackendId } from "./backends/backendIds";
import { CursorSettingsTab } from "./settings/CursorSettingsTab";
import { CursorChatView } from "./views/CursorChatView";
import { SetupWizardModal } from "./views/SetupWizardModal";
import { VIEW_TYPE } from "./constants";
import { VaultContextBuilder } from "./context/VaultContextBuilder";
import { ChatSessionManager } from "./session/ChatSessionManager";
import { LlmGatewayBackend } from "./backends/LlmGatewayBackend";
import { CursorSdkBackend } from "./backends/CursorSdkBackend";
import { CursorAgentCliBackend } from "./backends/CursorAgentCliBackend";
import { BackendRouter } from "./backends/BackendRouter";
import { createObsidianHttpClient } from "./api/httpClient";

const MESSAGE_SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

export default class CursorChatPlugin extends Plugin {
  settings: CursorChatSettings = DEFAULT_SETTINGS;
  sessions = new ChatSessionManager();
  contextBuilder!: VaultContextBuilder;
  router!: BackendRouter;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.contextBuilder = new VaultContextBuilder(this.app, this.settings);
    this.rebuildRouter();

    const sessionData = await this.loadData();
    if (sessionData && typeof sessionData === "object") {
      const raw = sessionData as { sessions?: import("./types/chat").ChatSession[]; activeId?: string | null };
      this.sessions.load({ sessions: raw.sessions, activeId: raw.activeId ?? null });
    } else {
      this.sessions.load(null);
    }

    addIcon("cursor-chat-icon", MESSAGE_SQUARE_SVG);

    this.registerView(VIEW_TYPE, (leaf) => new CursorChatView(leaf, this));

    this.addRibbonIcon("cursor-chat-icon", "Open Cursor Chat", () => {
      void this.activateChatView();
    });

    this.addCommand({
      id: "open-cursor-chat",
      name: "Open Cursor Chat",
      callback: () => void this.activateChatView(),
    });

    this.addCommand({
      id: "setup-cursor-chat",
      name: "Set up Cursor Chat",
      callback: () => this.openSetupWizard(),
    });

    this.addSettingTab(new CursorSettingsTab(this.app, this));

    if (this.settings.openChatOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.activateChatView());
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  openSetupWizard(): void {
    new SetupWizardModal(this.app, this).open();
  }

  rebuildRouter(): void {
    const getVaultPath = (): string | null => {
      const adapter = this.app.vault.adapter;
      if (adapter instanceof FileSystemAdapter) {
        return adapter.getBasePath();
      }
      return null;
    };

    const llmGateway = new LlmGatewayBackend(this.settings);
    const cursorHttp = createObsidianHttpClient(requestUrl);
    const cursorSdk = new CursorSdkBackend(this.settings, cursorHttp);
    const cursorAgent = new CursorAgentCliBackend(this.settings, getVaultPath);
    this.router = new BackendRouter(this.settings, cursorSdk, cursorAgent, llmGateway);
    this.contextBuilder = new VaultContextBuilder(this.app, this.settings);
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    if (data?.settings) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
      this.settings.backend = migrateBackendId(data.settings.backend ?? DEFAULT_SETTINGS.backend);
      this.settings.byok = Object.assign({}, DEFAULT_SETTINGS.byok, data.settings.byok);
      this.settings.cursor = Object.assign({}, DEFAULT_SETTINGS.cursor, data.settings.cursor);
      this.settings.cursorAgent = Object.assign(
        {},
        DEFAULT_SETTINGS.cursorAgent,
        data.settings.cursorAgent,
      );
      if (!data.settings.byok?.provider) {
        this.settings.byok.provider = inferByokProvider(this.settings.byok.baseUrl);
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData({ ...(await this.loadData()), settings: this.settings });
    this.rebuildRouter();
  }

  async persistSessions(): Promise<void> {
    const existing = (await this.loadData()) ?? {};
    await this.saveData({ ...existing, settings: this.settings, ...this.sessions.save() });
  }

  async validateBackend(): Promise<void> {
    await this.router.getBackend().validate();
  }

  async activateChatView(): Promise<void> {
    if (!this.settings.hasCompletedSetup) {
      this.openSetupWizard();
      return;
    }

    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) {
        return;
      }
      await rightLeaf.setViewState({ type: VIEW_TYPE, active: true });
      leaf = rightLeaf;
    }
    workspace.revealLeaf(leaf);
  }
}
