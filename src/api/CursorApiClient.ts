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

export class CursorApiClient {
  constructor(private readonly apiKey: string) {}

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

  async streamRun(agentId: string, runId: string, signal?: AbortSignal): Promise<Response> {
    const res = await fetch(`${CURSOR_API_BASE}/v1/agents/${agentId}/runs/${runId}/stream`, {
      method: "GET",
      headers: this.authHeaders({ Accept: "text/event-stream" }),
      signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new CursorApiError(res.status, text);
    }
    return res;
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${CURSOR_API_BASE}${path}`, {
      method,
      headers: this.authHeaders(
        body !== undefined ? { "Content-Type": "application/json" } : {},
      ),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new CursorApiError(res.status, text);
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }
}
