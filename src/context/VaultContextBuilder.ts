import type { App } from "obsidian";
import { MarkdownView } from "obsidian";
import type { CursorChatSettings } from "../settings/CursorSettings";

export class VaultContextBuilder {
  constructor(
    private readonly app: App,
    private readonly settings: CursorChatSettings,
  ) {}

  async build(): Promise<string> {
    const parts: string[] = [];

    if (this.settings.includeActiveNote) {
      const file = this.app.workspace.getActiveFile();
      if (file) {
        const body = await this.app.vault.read(file);
        const trimmed = this.truncate(body);
        parts.push(`## Active note: [[${file.basename}]]\n\n${trimmed}`);
      }
    }

    const selection = this.getSelection();
    if (selection) {
      parts.push(`## Selection\n\n${this.truncate(selection)}`);
    }

    if (parts.length === 0) {
      return "";
    }

    return `## Vault context\n\n${parts.join("\n\n---\n\n")}\n\n---\n\n`;
  }

  private getSelection(): string {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.getMode() !== "source") {
      return "";
    }
    return view.editor.getSelection().trim();
  }

  private truncate(text: string): string {
    const max = this.settings.maxContextChars;
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, max)}\n\n… [truncated]`;
  }
}
