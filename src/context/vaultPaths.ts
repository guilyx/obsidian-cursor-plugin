import { TFile, TFolder } from "obsidian";

/** ponytail: cap folder context size; raise if users hit the ceiling often. */
export const FOLDER_ATTACHMENT_FILE_LIMIT = 20;

export function listMarkdownFilesInFolder(
  folder: TFolder,
  limit = FOLDER_ATTACHMENT_FILE_LIMIT,
): TFile[] {
  const files: TFile[] = [];

  const walk = (dir: TFolder): void => {
    for (const child of dir.children) {
      if (files.length >= limit) {
        return;
      }
      if (child instanceof TFile && child.extension === "md") {
        files.push(child);
      } else if (child instanceof TFolder) {
        walk(child);
      }
    }
  };

  walk(folder);
  return files;
}
