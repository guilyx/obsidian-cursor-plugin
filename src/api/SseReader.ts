import { createParser, type EventSourceMessage } from "eventsource-parser";

/** Parse one SSE chunk; ponytail: minimal helper for self-check script. */
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
