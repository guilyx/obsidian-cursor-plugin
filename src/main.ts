import { Plugin, WorkspaceLeaf, addIcon, FileSystemAdapter } from "obsidian";
import { DEFAULT_SETTINGS, type CursorChatSettings } from "./settings/CursorSettings";
import { CursorSettingsTab } from "./settings/CursorSettingsTab";
import { CursorChatView } from "./views/CursorChatView";
import { VIEW_TYPE } from "./constants";
import { VaultContextBuilder } from "./context/VaultContextBuilder";
import { ChatSessionManager } from "./session/ChatSessionManager";
import { ByokBackend } from "./backends/ByokBackend";
import { CursorRestBackend } from "./backends/CursorRestBackend";
import { CursorBridgeBackend } from "./backends/CursorBridgeBackend";
import { BackendRouter } from "./backends/BackendRouter";

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

    this.addSettingTab(new CursorSettingsTab(this.app, this));

    if (this.settings.openChatOnStartup) {
      this.app.workspace.onLayoutReady(() => void this.activateChatView());
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  rebuildRouter(): void {
    const byok = new ByokBackend(this.settings);
    const cursorRest = new CursorRestBackend(this.settings);
    const cursorBridge = new CursorBridgeBackend(this.settings, () => {
      const adapter = this.app.vault.adapter;
      if (adapter instanceof FileSystemAdapter) {
        return adapter.getBasePath();
      }
      return null;
    });
    this.router = new BackendRouter(this.settings, byok, cursorRest, cursorBridge);
    this.contextBuilder = new VaultContextBuilder(this.app, this.settings);
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    if (data?.settings) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
      this.settings.byok = Object.assign({}, DEFAULT_SETTINGS.byok, data.settings.byok);
      this.settings.cursor = Object.assign({}, DEFAULT_SETTINGS.cursor, data.settings.cursor);
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
