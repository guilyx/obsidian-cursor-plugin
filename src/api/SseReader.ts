import { createParser, type EventSourceMessage } from "eventsource-parser";
import { formatApiErrorField } from "./errors";

/** Parse one OpenAI SSE data line; ponytail: minimal helper for self-check script. */
export function parseSseDataLine(data: string): { text?: string; done?: boolean; error?: string } {
  if (data === "[DONE]") {
    return { done: true };
  }
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (json.error?.message) {
      return { error: json.error.message };
    }
    const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
    if (delta) {
      return { text: delta };
    }
  } catch {
    // ignore malformed chunks
  }
  return {};
}

export type CursorSseChunk =
  | { kind: "assistant"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool_call"; callId: string; name: string; status: string; args?: string; result?: string }
  | { kind: "result"; text?: string }
  | { kind: "error"; message: string }
  | { kind: "done" }
  | { kind: "status"; status: string };

/** Parse Cursor Cloud Agents SSE event payload. */
export function parseCursorSseEvent(eventType: string, data: string): CursorSseChunk | null {
  if (eventType === "heartbeat") {
    return null;
  }
  if (eventType === "done" || data === "{}") {
    return { kind: "done" };
  }
  try {
    const json = JSON.parse(data) as Record<string, unknown>;
    switch (eventType) {
      case "assistant":
        return { kind: "assistant", text: String(json.text ?? "") };
      case "thinking":
        return { kind: "thinking", text: String(json.text ?? "") };
      case "tool_call":
        return {
          kind: "tool_call",
          callId: String(json.callId ?? ""),
          name: String(json.name ?? "tool"),
          status: String(json.status ?? ""),
          args: json.args != null ? JSON.stringify(json.args) : undefined,
          result: json.result != null ? JSON.stringify(json.result) : undefined,
        };
      case "result":
        return { kind: "result", text: json.text != null ? String(json.text) : undefined };
      case "error":
        return {
          kind: "error",
          message: formatApiErrorField(json.message) ?? formatApiErrorField(json.code) ?? "Stream error",
        };
      case "status":
        return { kind: "status", status: String(json.status ?? "") };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function* readOpenAiSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const queue: string[] = [];
  let resolve: (() => void) | null = null;
  let done = false;
  let streamError: string | null = null;

  const parser = createParser({
    onEvent(event: EventSourceMessage) {
      const parsed = parseSseDataLine(event.data);
      if (parsed.error) {
        streamError = parsed.error;
        done = true;
      } else if (parsed.text) {
        queue.push(parsed.text);
      } else if (parsed.done) {
        done = true;
      }
      resolve?.();
      resolve = null;
    },
  });

  const pump = async (): Promise<void> => {
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) {
        done = true;
        resolve?.();
        break;
      }
      parser.feed(decoder.decode(value, { stream: true }));
    }
  };

  void pump().catch((err: unknown) => {
    streamError = err instanceof Error ? err.message : String(err);
    done = true;
    resolve?.();
  });

  while (!done || queue.length > 0) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
    if (queue.length > 0) {
      yield queue.shift()!;
      continue;
    }
    if (streamError) {
      throw new Error(streamError);
    }
    if (!done) {
      await new Promise<void>((r) => {
        resolve = r;
      });
    }
  }
}

export async function* readCursorSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<CursorSseChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const queue: CursorSseChunk[] = [];
  let resolve: (() => void) | null = null;
  let done = false;
  let streamError: string | null = null;

  const parser = createParser({
    onEvent(event: EventSourceMessage) {
      const eventType = event.event || "message";
      const parsed = parseCursorSseEvent(eventType, event.data);
      if (parsed) {
        if (parsed.kind === "error") {
          streamError = parsed.message;
          done = true;
        } else if (parsed.kind === "done") {
          done = true;
        } else {
          queue.push(parsed);
        }
      }
      resolve?.();
      resolve = null;
    },
  });

  const pump = async (): Promise<void> => {
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) {
        done = true;
        resolve?.();
        break;
      }
      parser.feed(decoder.decode(value, { stream: true }));
    }
  };

  void pump().catch((err: unknown) => {
    streamError = err instanceof Error ? err.message : String(err);
    done = true;
    resolve?.();
  });

  while (!done || queue.length > 0) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
    if (queue.length > 0) {
      yield queue.shift()!;
      continue;
    }
    if (streamError) {
      throw new Error(streamError);
    }
    if (!done) {
      await new Promise<void>((r) => {
        resolve = r;
      });
    }
  }
}
