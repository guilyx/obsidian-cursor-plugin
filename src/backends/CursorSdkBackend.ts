import type { ChatBackend } from "./ChatBackend";
import type { SendMessageInput, StreamEvent } from "../types/chat";
import type { CursorChatSettings } from "../settings/CursorSettings";
import { BridgeApiClient } from "../api/BridgeApiClient";
import { CursorApiClient } from "../api/CursorApiClient";
import { CursorApiError, isCursorBillingLimitError } from "../api/errors";
import { readCursorSseStream } from "../api/SseReader";
import type { HttpClient } from "../api/httpClient";

const POLL_MS = 2000;
const TERMINAL_ERROR_STATUSES = new Set(["ERROR", "CANCELLED", "EXPIRED"]);

interface RunStreamClient {
  readonly supportsStreaming: boolean;
  streamRun(agentId: string, runId: string, signal?: AbortSignal): Promise<{ body: ReadableStream<Uint8Array> | null }>;
  cancelRun(agentId: string, runId: string): Promise<void>;
  getRun?(agentId: string, runId: string): Promise<{ status: string; result?: string }>;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = globalThis.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export class CursorSdkBackend implements ChatBackend {
  constructor(
    private readonly settings: CursorChatSettings,
    private readonly getVaultPath: () => string | null,
    private readonly http?: HttpClient,
  ) {}

  private isLocal(): boolean {
    return this.settings.cursor.sdkRuntime === "local";
  }

  private apiKey(): string {
    const key = this.settings.cursor.apiKey.trim();
    if (!key) {
      throw new Error("Cursor API key is required (crsr_…).");
    }
    return key;
  }

  private cloudClient(): CursorApiClient {
    const key = this.apiKey();
    return this.http ? new CursorApiClient(key, this.http) : new CursorApiClient(key);
  }

  private bridgeClient(): BridgeApiClient {
    const { bridgeUrl, bridgeToken } = this.settings.cursor;
    return new BridgeApiClient(bridgeUrl.replace(/\/$/, ""), bridgeToken, this.apiKey(), this.http);
  }

  private runClient(): RunStreamClient {
    if (this.isLocal()) {
      return this.bridgeClient();
    }
    return this.cloudClient();
  }

  async validate(): Promise<void> {
    if (this.isLocal()) {
      const vaultPath = this.getVaultPath();
      if (!vaultPath) {
        throw new Error("Local SDK requires a local folder vault.");
      }
      const health = await this.bridgeClient().health();
      if (!health.ok) {
        throw new Error("SDK bridge is not healthy. Start it: cd bridge && npm run start:sdk");
      }
      return;
    }
    await this.cloudClient().me();
  }

  async *send(input: SendMessageInput): AsyncGenerator<StreamEvent> {
    const { cursor } = this.settings;
    const promptText = input.contextPrefix
      ? `${input.contextPrefix}\n\n${input.userText}`
      : input.userText;

    let agentId = input.session.cursorAgentId;
    let runId: string;

    try {
      if (this.isLocal()) {
        const vaultPath = this.getVaultPath();
        if (!vaultPath) {
          yield { type: "error", message: "Local SDK requires a local folder vault." };
          return;
        }
        const bridge = this.bridgeClient();
        if (!agentId) {
          const created = await bridge.createAgent({
            name: input.session.title || "Obsidian chat",
            cwd: vaultPath,
            model: cursor.defaultModelId ? { id: cursor.defaultModelId } : undefined,
            prompt: { text: promptText },
          });
          agentId = created.agent.id;
          runId = created.run.id;
        } else {
          const created = await bridge.createRun(agentId, { prompt: { text: promptText } });
          runId = created.run.id;
        }
      } else if (!agentId) {
        const created = await this.cloudClient().createAgent({
          name: input.session.title || "Obsidian chat",
          mode: cursor.defaultMode,
          model: cursor.defaultModelId ? { id: cursor.defaultModelId } : undefined,
          prompt: { text: promptText },
        });
        agentId = created.agent.id;
        runId = created.run.id;
      } else {
        const created = await this.cloudClient().createRun(agentId, {
          prompt: { text: promptText },
          mode: cursor.defaultMode,
        });
        runId = created.run.id;
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      yield { type: "error", message: formatError(err) };
      return;
    }

    yield { type: "run-started", agentId, runId };

    const client = this.runClient();
    const cancelOnAbort = (): void => {
      void client.cancelRun(agentId!, runId).catch(() => {});
    };
    input.signal?.addEventListener("abort", cancelOnAbort, { once: true });

    let full = "";
    try {
      yield* this.streamOrPoll(client, agentId, runId, input.signal, (text) => {
        full += text;
      });
      if (full) {
        yield { type: "assistant-done", text: full };
      } else {
        yield {
          type: "error",
          message: this.isLocal()
            ? "Local SDK agent finished without a reply. Is the bridge running?"
            : "Cursor agent finished without a reply. Check your API key and model settings.",
        };
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (full) {
          yield { type: "assistant-done", text: full };
        }
        return;
      }
      yield { type: "error", message: formatError(err) };
    } finally {
      input.signal?.removeEventListener("abort", cancelOnAbort);
    }
  }

  private async *streamOrPoll(
    client: RunStreamClient,
    agentId: string,
    runId: string,
    signal: AbortSignal | undefined,
    onDelta: (text: string) => void,
  ): AsyncGenerator<StreamEvent> {
    if (!client.supportsStreaming && client.getRun) {
      yield* this.pollRun(client, agentId, runId, signal, onDelta);
      return;
    }

    let receivedText = false;
    try {
      const res = await client.streamRun(agentId, runId, signal);
      if (!res.body) {
        if (client.getRun) {
          yield* this.pollRun(client, agentId, runId, signal, onDelta);
        }
        return;
      }

      for await (const chunk of readCursorSseStream(res.body, signal)) {
        if (chunk.kind === "assistant") {
          receivedText = true;
          onDelta(chunk.text);
          yield { type: "assistant-delta", text: chunk.text };
        } else if (chunk.kind === "thinking" && this.settings.cursor.showThinking) {
          yield { type: "thinking-delta", text: chunk.text };
        } else if (chunk.kind === "tool_call") {
          yield {
            type: "tool-call",
            callId: chunk.callId,
            name: chunk.name,
            status: chunk.status,
            args: chunk.args,
            result: chunk.result,
          };
        } else if (chunk.kind === "result" && chunk.text) {
          receivedText = true;
          onDelta(chunk.text);
          yield { type: "assistant-delta", text: chunk.text };
        } else if (chunk.kind === "status" && chunk.status === "FINISHED" && !receivedText && client.getRun) {
          yield* this.pollRun(client, agentId, runId, signal, onDelta);
          return;
        }
      }

      if (!receivedText && client.getRun) {
        yield* this.pollRun(client, agentId, runId, signal, onDelta);
      }
    } catch (err: unknown) {
      if (client.getRun && shouldPollInstead(err)) {
        yield* this.pollRun(client, agentId, runId, signal, onDelta);
        return;
      }
      throw err;
    }
  }

  private async *pollRun(
    client: RunStreamClient,
    agentId: string,
    runId: string,
    signal: AbortSignal | undefined,
    onDelta: (text: string) => void,
  ): AsyncGenerator<StreamEvent> {
    if (!client.getRun) {
      return;
    }
    while (!signal?.aborted) {
      const run = await client.getRun(agentId, runId);
      if (run.status === "FINISHED") {
        if (run.result) {
          onDelta(run.result);
          yield { type: "assistant-delta", text: run.result };
        }
        return;
      }
      if (TERMINAL_ERROR_STATUSES.has(run.status as "ERROR" | "CANCELLED" | "EXPIRED")) {
        yield { type: "error", message: `Run ${run.status.toLowerCase()}.` };
        return;
      }
      await sleep(POLL_MS, signal);
    }
  }
}

function shouldPollInstead(err: unknown): boolean {
  if (err instanceof CursorApiError) {
    return err.status === 410 || err.message.includes("streaming_not_supported");
  }
  if (err instanceof TypeError) {
    return true;
  }
  return false;
}

function formatError(err: unknown): string {
  if (err instanceof CursorApiError) {
    if (isCursorBillingLimitError(err)) {
      return "Cursor Cloud Agents require usage-based pricing. Use SDK runtime: Local, or switch to Cursor Agent CLI.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
