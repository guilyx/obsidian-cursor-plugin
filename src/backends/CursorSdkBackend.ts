import type { ChatBackend } from "./ChatBackend";
import type { SendMessageInput, StreamEvent } from "../types/chat";
import type { CursorChatSettings } from "../settings/CursorSettings";
import { CursorApiClient } from "../api/CursorApiClient";
import { CursorApiError, isCursorBillingLimitError } from "../api/errors";
import { readCursorSseStream } from "../api/SseReader";
import type { HttpClient } from "../api/httpClient";

const POLL_MS = 2000;
const TERMINAL_ERROR_STATUSES = new Set(["ERROR", "CANCELLED", "EXPIRED"]);

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
    private readonly http?: HttpClient,
  ) {}

  private client(): CursorApiClient {
    const key = this.settings.cursor.apiKey.trim();
    if (!key) {
      throw new Error("Cursor API key is required (crsr_…).");
    }
    return this.http ? new CursorApiClient(key, this.http) : new CursorApiClient(key);
  }

  async validate(): Promise<void> {
    await this.client().me();
  }

  async *send(input: SendMessageInput): AsyncGenerator<StreamEvent> {
    const { cursor } = this.settings;
    const promptText = input.contextPrefix
      ? `${input.contextPrefix}\n\n${input.userText}`
      : input.userText;

    let agentId = input.session.cursorAgentId;
    let runId: string;

    try {
      if (!agentId) {
        const created = await this.client().createAgent({
          name: input.session.title || "Obsidian chat",
          mode: cursor.defaultMode,
          model: cursor.defaultModelId ? { id: cursor.defaultModelId } : undefined,
          prompt: { text: promptText },
        });
        agentId = created.agent.id;
        runId = created.run.id;
      } else {
        const created = await this.client().createRun(agentId, {
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

    const cancelOnAbort = (): void => {
      void this.client()
        .cancelRun(agentId!, runId)
        .catch(() => {});
    };
    input.signal?.addEventListener("abort", cancelOnAbort, { once: true });

    let full = "";
    try {
      yield* this.streamOrPoll(agentId, runId, input.signal, (text) => {
        full += text;
      });
      if (full) {
        yield { type: "assistant-done", text: full };
      } else {
        yield {
          type: "error",
          message: "Cursor agent finished without a reply. Check your API key and model settings.",
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
    agentId: string,
    runId: string,
    signal: AbortSignal | undefined,
    onDelta: (text: string) => void,
  ): AsyncGenerator<StreamEvent> {
    const client = this.client();

    // Obsidian requestUrl cannot stream — poll GET /runs/:id directly.
    if (!client.supportsStreaming) {
      yield* this.pollRun(agentId, runId, signal, onDelta);
      return;
    }

    let receivedText = false;
    try {
      const res = await client.streamRun(agentId, runId, signal);
      if (!res.body) {
        yield* this.pollRun(agentId, runId, signal, onDelta);
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
        } else if (chunk.kind === "status" && chunk.status === "FINISHED") {
          // Stream may end after status without assistant deltas — poll for result.
          if (!receivedText) {
            yield* this.pollRun(agentId, runId, signal, onDelta);
            return;
          }
        }
      }

      if (!receivedText) {
        yield* this.pollRun(agentId, runId, signal, onDelta);
      }
    } catch (err: unknown) {
      if (shouldPollInstead(err)) {
        yield* this.pollRun(agentId, runId, signal, onDelta);
        return;
      }
      throw err;
    }
  }

  private async *pollRun(
    agentId: string,
    runId: string,
    signal: AbortSignal | undefined,
    onDelta: (text: string) => void,
  ): AsyncGenerator<StreamEvent> {
    while (!signal?.aborted) {
      const run = await this.client().getRun(agentId, runId);
      if (run.status === "FINISHED") {
        if (run.result) {
          onDelta(run.result);
          yield { type: "assistant-delta", text: run.result };
        }
        return;
      }
      if (TERMINAL_ERROR_STATUSES.has(run.status)) {
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
  // Network / CORS failures in Electron — fall back to polling REST.
  if (err instanceof TypeError) {
    return true;
  }
  return false;
}

function formatError(err: unknown): string {
  if (err instanceof CursorApiError) {
    if (isCursorBillingLimitError(err)) {
      return "Cursor Cloud Agents require usage-based pricing with spend headroom. Enable it in Cursor Dashboard → Settings.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
