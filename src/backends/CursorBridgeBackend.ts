import type { ChatBackend } from "./ChatBackend";
import type { SendMessageInput, StreamEvent } from "../types/chat";
import type { CursorChatSettings } from "../settings/CursorSettings";
import { bridgeClientFromSettings } from "../api/BridgeApiClient";
import { readCursorSseStream } from "../api/SseReader";

export class CursorBridgeBackend implements ChatBackend {
  constructor(
    private readonly settings: CursorChatSettings,
    private readonly getVaultPath: () => string | null,
  ) {}

  async validate(): Promise<void> {
    const health = await bridgeClientFromSettings(this.settings).health();
    if (!health.ok) {
      throw new Error("Bridge health check failed.");
    }
  }

  async *send(input: SendMessageInput): AsyncGenerator<StreamEvent> {
    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      yield { type: "error", message: "SDK bridge requires a local folder vault." };
      return;
    }

    const client = bridgeClientFromSettings(this.settings);
    let agentId = input.session.cursorAgentId;
    let runId: string;

    try {
      if (!agentId) {
        const created = await client.createAgent(
          vaultPath,
          this.settings.cursor.defaultModelId || undefined,
        );
        agentId = created.agentId;
        runId = created.runId;
      } else {
        yield {
          type: "error",
          message: "Bridge follow-up runs not implemented in stub — start a new chat.",
        };
        return;
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
      return;
    }

    yield { type: "run-started", agentId, runId };

    const cancelOnAbort = (): void => {
      void client.cancelRun(agentId!, runId).catch(() => {});
    };
    input.signal?.addEventListener("abort", cancelOnAbort, { once: true });

    let full = "";
    try {
      const res = await client.streamRun(agentId, runId, input.signal);
      if (!res.body) {
        yield { type: "error", message: "Empty bridge stream." };
        return;
      }
      for await (const chunk of readCursorSseStream(res.body, input.signal)) {
        if (chunk.kind === "assistant") {
          full += chunk.text;
          yield { type: "assistant-delta", text: chunk.text };
        } else if (chunk.kind === "result" && chunk.text) {
          full += chunk.text;
          yield { type: "assistant-delta", text: chunk.text };
        } else if (chunk.kind === "tool_call") {
          yield {
            type: "tool-call",
            callId: chunk.callId,
            name: chunk.name,
            status: chunk.status,
            args: chunk.args,
            result: chunk.result,
          };
        }
      }
      if (full) {
        yield { type: "assistant-done", text: full };
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (full) {
          yield { type: "assistant-done", text: full };
        }
        return;
      }
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    } finally {
      input.signal?.removeEventListener("abort", cancelOnAbort);
    }
  }
}
