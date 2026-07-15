import type { SendMessageInput, StreamEvent } from "../types/chat";

export interface ChatBackend {
  validate(): Promise<void>;
  send(input: SendMessageInput): AsyncGenerator<StreamEvent>;
}
