import type { CursorChatSettings } from "../settings/CursorSettings";
import type { ChatBackend } from "./ChatBackend";
import { BACKEND_LABELS } from "./backendIds";

export type { ChatBackend } from "./ChatBackend";

export class BackendRouter {
  constructor(
    private readonly settings: CursorChatSettings,
    private readonly cursorSdk: ChatBackend,
    private readonly cursorAgent: ChatBackend,
    private readonly llmGateway: ChatBackend,
  ) {}

  getBackend(): ChatBackend {
    switch (this.settings.backend) {
      case "cursor-sdk":
        return this.cursorSdk;
      case "cursor-agent":
        return this.cursorAgent;
      case "llm-gateway":
        return this.llmGateway;
      default:
        return this.cursorSdk;
    }
  }

  getBackendLabel(): string {
    return BACKEND_LABELS[this.settings.backend];
  }
}
