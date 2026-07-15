import { CURSOR_API_BASE } from "../constants";
import type {
  CreateAgentRequest,
  CreateAgentResponse,
  CreateRunRequest,
  CreateRunResponse,
  CursorMeResponse,
  CursorModel,
  CursorRun,
} from "../types/cursor-api";
import { CursorApiError } from "./errors";
import { createFetchHttpClient, type HttpClient, type HttpResponse } from "./httpClient";

export class CursorApiClient {
  readonly supportsStreaming: boolean;

  constructor(
    private readonly apiKey: string,
    private readonly http: HttpClient = createFetchHttpClient(),
  ) {
    this.supportsStreaming = http.supportsStreaming;
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...extra,
    };
  }

  async me(): Promise<CursorMeResponse> {
    return this.json<CursorMeResponse>("GET", "/v1/me");
  }

  async listModels(): Promise<CursorModel[]> {
    const data = await this.json<{ items?: CursorModel[] } | CursorModel[]>("GET", "/v1/models");
    return Array.isArray(data) ? data : (data.items ?? []);
  }

  async createAgent(body: CreateAgentRequest): Promise<CreateAgentResponse> {
    return this.json<CreateAgentResponse>("POST", "/v1/agents", body);
  }

  async createRun(agentId: string, body: CreateRunRequest): Promise<CreateRunResponse> {
    return this.json<CreateRunResponse>("POST", `/v1/agents/${agentId}/runs`, body);
  }

  async getRun(agentId: string, runId: string): Promise<CursorRun> {
    return this.json<CursorRun>("GET", `/v1/agents/${agentId}/runs/${runId}`);
  }

  async cancelRun(agentId: string, runId: string): Promise<void> {
    await this.json<unknown>("POST", `/v1/agents/${agentId}/runs/${runId}/cancel`);
  }

  async streamRun(agentId: string, runId: string, signal?: AbortSignal): Promise<HttpStreamResponse> {
    const res = await this.http.request({
      method: "GET",
      url: `${CURSOR_API_BASE}/v1/agents/${agentId}/runs/${runId}/stream`,
      headers: this.authHeaders({ Accept: "text/event-stream" }),
      signal,
    });
    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new CursorApiError(res.status, text);
    }
    if (!res.body) {
      throw new CursorApiError(410, "streaming_not_supported");
    }
    return wrapStreamResponse(res);
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.http.request({
      method,
      url: `${CURSOR_API_BASE}${path}`,
      headers: this.authHeaders(body !== undefined ? { "Content-Type": "application/json" } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new CursorApiError(res.status, text);
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return JSON.parse(await res.text()) as T;
  }
}

/** Minimal stream response shape used by SSE reader. */
export interface HttpStreamResponse {
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

function wrapStreamResponse(res: HttpResponse): HttpStreamResponse {
  return {
    body: res.body,
    text: () => res.text(),
  };
}
