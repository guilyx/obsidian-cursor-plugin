import { CURSOR_API_BASE } from "../constants";
import type { CreateAgentRequest, CreateAgentResponse, CreateRunRequest, CreateRunResponse, CursorRun } from "../types/cursor-api";
import { CursorApiError } from "./errors";
import type { HttpClient } from "./httpClient";
import { createFetchHttpClient } from "./httpClient";

export interface RunStreamClientLike {
  readonly supportsStreaming: boolean;
  streamRun(agentId: string, runId: string, signal?: AbortSignal): Promise<{ body: ReadableStream<Uint8Array> | null }>;
  cancelRun(agentId: string, runId: string): Promise<void>;
}

/**
 * HTTP client for the local @cursor/sdk bridge (localhost).
 * Same route shapes as Cloud Agents API so CursorSdkBackend can share flow.
 */
export class BridgeApiClient implements RunStreamClientLike {
  readonly supportsStreaming = true;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly apiKey: string,
    private readonly http: HttpClient = createFetchHttpClient(),
  ) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (this.token) {
      h.Authorization = `Bearer ${this.token}`;
    }
    return h;
  }

  async health(): Promise<{ ok: boolean; runtime?: string }> {
    return this.json("GET", "/health");
  }

  async createAgent(
    body: CreateAgentRequest & { cwd: string; model?: { id: string; fast?: boolean } },
  ): Promise<CreateAgentResponse> {
    return this.json<CreateAgentResponse>("POST", "/agents", {
      ...body,
      apiKey: this.apiKey,
    });
  }

  async createRun(agentId: string, body: CreateRunRequest): Promise<CreateRunResponse> {
    return this.json<CreateRunResponse>("POST", `/agents/${agentId}/runs`, body);
  }

  async streamRun(agentId: string, runId: string, signal?: AbortSignal): Promise<{ body: ReadableStream<Uint8Array> | null }> {
    const res = await this.http.request({
      method: "GET",
      url: `${this.baseUrl}/agents/${agentId}/runs/${runId}/stream`,
      headers: this.headers({ Accept: "text/event-stream" }),
      signal,
    });
    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new CursorApiError(res.status, text);
    }
    return { body: res.body };
  }

  async cancelRun(agentId: string, runId: string): Promise<void> {
    await this.json("POST", `/agents/${agentId}/runs/${runId}/cancel`);
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.http.request({
      method,
      url: `${this.baseUrl}${path}`,
      headers: this.headers(body !== undefined ? { "Content-Type": "application/json" } : {}),
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

/** Cloud REST client — re-export base for clarity in backend router. */
export { CURSOR_API_BASE };
