import { App, FuzzySuggestModal, TFile, TFolder } from "obsidian";

export type VaultPathChoice = TFile | TFolder;

/** Fuzzy picker for vault notes, attachments, and folders. */
export class VaultPathSuggestModal extends FuzzySuggestModal<VaultPathChoice> {
  constructor(
    app: App,
    private readonly onChoose: (item: VaultPathChoice) => void,
  ) {
    super(app);
    this.setPlaceholder("Attach a note, file, or folder…");
  }

  getItems(): VaultPathChoice[] {
    const folders: TFolder[] = [];
    const collectFolders = (folder: TFolder): void => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          folders.push(child);
          collectFolders(child);
        }
      }
    };
    collectFolders(this.app.vault.getRoot());

    // Folders first so they are easy to find in long vaults.
    const files = this.app.vault.getFiles();
    return [...folders, ...files];
  }

  getItemText(item: VaultPathChoice): string {
    return item instanceof TFolder ? `📁 ${item.path}/` : item.path;
  }

  onChooseItem(item: VaultPathChoice): void {
    this.onChoose(item);
  }
}
