import type { SendMessageInput, StreamEvent } from "../types/chat";
import type { CursorChatSettings } from "../settings/CursorSettings";

export interface ChatBackend {
  validate(): Promise<void>;
  send(input: SendMessageInput): AsyncGenerator<StreamEvent>;
}

export class BackendRouter {
  constructor(
    private readonly settings: CursorChatSettings,
    private readonly byok: ChatBackend,
  ) {}

  getBackend(): ChatBackend {
    switch (this.settings.backend) {
      case "openai-compatible":
        return this.byok;
      case "cursor-rest":
      case "cursor-sdk-local":
        throw new Error(`${this.settings.backend} is not implemented yet. Use BYOK or wait for the next release.`);
      default:
        return this.byok;
    }
  }
}
