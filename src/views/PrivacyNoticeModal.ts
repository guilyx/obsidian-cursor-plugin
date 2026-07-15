import { App, Modal } from "obsidian";

export class PrivacyNoticeModal extends Modal {
  constructor(
    app: App,
    private readonly onAcknowledge: () => void,
    private readonly onOpenSettings: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Privacy notice" });
    contentEl.createEl("p", {
      text: "Note content you include in messages is sent to your chosen AI provider (BYOK or Cursor) for processing. Review your team's privacy settings before sharing sensitive material.",
    });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "You can limit what is sent via settings (active note, @mentions, selection).",
    });

    const actions = contentEl.createDiv({ cls: "modal-button-container" });
    actions
      .createEl("button", { text: "Open settings", cls: "mod-warning" })
      .addEventListener("click", () => {
        this.onOpenSettings();
        this.close();
      });
    actions
      .createEl("button", { text: "I understand", cls: "mod-cta" })
      .addEventListener("click", () => {
        this.onAcknowledge();
        this.close();
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
