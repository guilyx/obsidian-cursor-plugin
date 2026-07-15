import type { App } from "obsidian";
import { MarkdownView, TFile, TFolder } from "obsidian";
import type { CursorChatSettings } from "../settings/CursorSettings";
import type { ChatAttachment } from "../views/chatAttachments";
import { FOLDER_ATTACHMENT_FILE_LIMIT, listMarkdownFilesInFolder } from "./vaultPaths";

export class VaultContextBuilder {
  constructor(
    private readonly app: App,
    private readonly settings: CursorChatSettings,
  ) {}

  async build(attachments: ChatAttachment[] = []): Promise<string> {
    const parts: string[] = [];

    if (this.settings.includeActiveNote) {
      const file = this.app.workspace.getActiveFile();
      if (file) {
        const body = await this.app.vault.read(file);
        const trimmed = this.truncate(body);
        parts.push(`## Active note: [[${file.basename}]]\n\n${trimmed}`);
      }
    }

    for (const att of attachments) {
      if (att.kind === "file") {
        const part = await this.buildFilePart(att.path);
        if (part) {
          parts.push(part);
        }
      } else {
        const part = await this.buildFolderPart(att.path);
        if (part) {
          parts.push(part);
        }
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

  getActiveNoteLabel(): string | null {
    const file = this.app.workspace.getActiveFile();
    return file ? file.basename : null;
  }

  getSelectionSummary(): { chars: number } | null {
    const selection = this.getSelection();
    return selection ? { chars: selection.length } : null;
  }

  private async buildFilePart(path: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return null;
    }
    const body = await this.app.vault.read(file);
    return `## Attached: [[${file.basename}]]\n\n${this.truncate(body)}`;
  }

  private async buildFolderPart(path: string): Promise<string | null> {
    const folder = this.app.vault.getAbstractFileByPath(path);
    if (!(folder instanceof TFolder)) {
      return null;
    }

    const files = listMarkdownFilesInFolder(folder);
    if (files.length === 0) {
      return `## Attached folder: ${folder.path}/\n\n(no markdown files)`;
    }

    const header = `## Attached folder: ${folder.path}/\n\nIncluding ${files.length} note(s)${
      files.length >= FOLDER_ATTACHMENT_FILE_LIMIT ? ` (first ${FOLDER_ATTACHMENT_FILE_LIMIT})` : ""
    }:\n${files.map((f) => `- ${f.path}`).join("\n")}`;

    const bodies: string[] = [];
    for (const file of files) {
      const body = await this.app.vault.read(file);
      bodies.push(`### ${file.basename}\n\n${this.truncate(body)}`);
    }

    return `${header}\n\n---\n\n${bodies.join("\n\n---\n\n")}`;
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
