/** HTTP abstraction so Cursor API works in Obsidian (requestUrl) and Node tests (fetch). */

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  text(): Promise<string>;
  /** Null when the transport cannot stream (e.g. Obsidian requestUrl). */
  body: ReadableStream<Uint8Array> | null;
}

export interface HttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface HttpClient {
  readonly supportsStreaming: boolean;
  request(input: HttpRequest): Promise<HttpResponse>;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Node / test runtime — full fetch with ReadableStream body. */
export function createFetchHttpClient(): HttpClient {
  return {
    supportsStreaming: true,
    async request({ method, url, headers, body, signal }) {
      const res = await fetch(url, { method, headers, body, signal });
      return {
        status: res.status,
        headers: headersToRecord(res.headers),
        text: () => res.text(),
        body: res.body,
      };
    },
  };
}

/** Obsidian plugin runtime — requestUrl bypasses CORS; no SSE streaming. */
export function createObsidianHttpClient(
  requestUrl: (req: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
    throw: boolean;
  }) => Promise<{ status: number; headers?: Record<string, string>; text: string }>,
): HttpClient {
  return {
    supportsStreaming: false,
    async request({ method, url, headers, body, signal }) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const abortPromise = signal
        ? new Promise<never>((_, reject) => {
            signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
              once: true,
            });
          })
        : null;

      const res = await (abortPromise
        ? Promise.race([
            requestUrl({ url, method, headers, body, throw: false }),
            abortPromise,
          ])
        : requestUrl({ url, method, headers, body, throw: false }));

      return {
        status: res.status,
        headers: res.headers ?? {},
        text: async () => res.text,
        body: null,
      };
    },
  };
}
