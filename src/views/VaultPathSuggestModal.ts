import { App, FuzzySuggestModal, TFile, TFolder } from "obsidian";

export type VaultPathChoice = TFile | TFolder;

/** Fuzzy picker for markdown notes and folders (@ attach). */
export class VaultPathSuggestModal extends FuzzySuggestModal<VaultPathChoice> {
  constructor(
    app: App,
    private readonly onChoose: (item: VaultPathChoice) => void,
  ) {
    super(app);
    this.setPlaceholder("Attach a note or folder…");
  }

  getItems(): VaultPathChoice[] {
    const items: VaultPathChoice[] = [...this.app.vault.getMarkdownFiles()];
    const addFolders = (folder: TFolder): void => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          items.push(child);
          addFolders(child);
        }
      }
    };
    addFolders(this.app.vault.getRoot());
    return items;
  }

  getItemText(item: VaultPathChoice): string {
    return item instanceof TFolder ? `📁 ${item.path}` : item.path;
  }

  onChooseItem(item: VaultPathChoice): void {
    this.onChoose(item);
  }
}
