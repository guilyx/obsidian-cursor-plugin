import type { CursorChatSettings } from "../settings/CursorSettings";
import type { ChatBackend } from "./ChatBackend";

export type { ChatBackend } from "./ChatBackend";

export class BackendRouter {
  constructor(
    private readonly settings: CursorChatSettings,
    private readonly byok: ChatBackend,
    private readonly cursorRest: ChatBackend,
    private readonly cursorBridge: ChatBackend,
  ) {}

  getBackend(): ChatBackend {
    switch (this.settings.backend) {
      case "openai-compatible":
        return this.byok;
      case "cursor-rest":
        return this.cursorRest;
      case "cursor-sdk-local":
        return this.cursorBridge;
      default:
        return this.cursorRest;
    }
  }
}
