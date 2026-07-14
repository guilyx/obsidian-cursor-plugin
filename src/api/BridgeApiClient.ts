import type { CursorChatSettings } from "../settings/CursorSettings";

export interface BridgeHealthResponse {
  ok: boolean;
  version: string;
  sdk?: string;
}

export interface BridgeCreateAgentResponse {
  agentId: string;
  runId: string;
}

export class BridgeApiError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Bridge error (${status}): ${body.slice(0, 200)}`);
    this.name = "BridgeApiError";
  }
}

export class BridgeApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      ...extra,
    };
  }

  async health(): Promise<BridgeHealthResponse> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/health`);
    if (!res.ok) {
      throw new BridgeApiError(res.status, await res.text());
    }
    return (await res.json()) as BridgeHealthResponse;
  }

  async createAgent(cwd: string, model?: string): Promise<BridgeCreateAgentResponse> {
    return this.json<BridgeCreateAgentResponse>("POST", "/agents", { cwd, model });
  }

  async streamRun(agentId: string, runId: string, signal?: AbortSignal): Promise<Response> {
    const res = await fetch(
      `${this.baseUrl.replace(/\/$/, "")}/agents/${agentId}/runs/${runId}/stream`,
      {
        method: "GET",
        headers: this.headers({ Accept: "text/event-stream" }),
        signal,
      },
    );
    if (!res.ok) {
      throw new BridgeApiError(res.status, await res.text());
    }
    return res;
  }

  async cancelRun(agentId: string, runId: string): Promise<void> {
    await this.json<unknown>("POST", `/agents/${agentId}/runs/${runId}/cancel`);
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: this.headers(body !== undefined ? { "Content-Type": "application/json" } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new BridgeApiError(res.status, await res.text());
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }
}

export function bridgeClientFromSettings(settings: CursorChatSettings): BridgeApiClient {
  return new BridgeApiClient(settings.cursor.bridgeUrl, settings.cursor.bridgeToken);
}
