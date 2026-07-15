import type { ChatBackend } from "./ChatBackend";
import type { SendMessageInput, StreamEvent } from "../types/chat";
import type { CursorChatSettings } from "../settings/CursorSettings";
import { BYOK_PROVIDER_PRESETS } from "../settings/byokProviders";
import { SYSTEM_PROMPT } from "../constants";
import { readOpenAiSseStream } from "../api/SseReader";

export class LlmGatewayBackend implements ChatBackend {
  constructor(private readonly settings: CursorChatSettings) {}

  private requestHeaders(): Record<string, string> {
    const { byok } = this.settings;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (byok.apiKey) {
      headers.Authorization = `Bearer ${byok.apiKey}`;
    }
    const extra = BYOK_PROVIDER_PRESETS[byok.provider]?.extraHeaders;
    if (extra) {
      Object.assign(headers, extra);
    }
    return headers;
  }

  async validate(): Promise<void> {
    const { baseUrl, apiKey } = this.settings.byok;
    if (!baseUrl.trim()) {
      throw new Error("Base URL is required.");
    }
    const url = `${baseUrl.replace(/\/$/, "")}/models`;
    const headers = { ...this.requestHeaders() };
    delete headers["Content-Type"];
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Connection failed (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  async *send(input: SendMessageInput): AsyncGenerator<StreamEvent> {
    const { byok } = this.settings;
    if (!byok.model.trim()) {
      yield { type: "error", message: "Model name is required in settings." };
      return;
    }

    const messages = this.buildMessages(input);
    const url = `${byok.baseUrl.replace(/\/$/, "")}/chat/completions`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: this.requestHeaders(),
        body: JSON.stringify({
          model: byok.model,
          messages,
          stream: true,
          temperature: byok.temperature,
          max_tokens: byok.maxTokens,
        }),
        signal: input.signal,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
      return;
    }

    if (!res.ok) {
      const text = await res.text();
      yield { type: "error", message: `API error (${res.status}): ${text.slice(0, 300)}` };
      return;
    }

    if (!res.body) {
      yield { type: "error", message: "Empty response body." };
      return;
    }

    let full = "";
    try {
      for await (const chunk of readOpenAiSseStream(res.body, input.signal)) {
        full += chunk;
        yield { type: "assistant-delta", text: chunk };
      }
      yield { type: "assistant-done", text: full };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (full) {
          yield { type: "assistant-done", text: full };
        }
        return;
      }
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }

  private buildMessages(input: SendMessageInput): Array<{ role: string; content: string }> {
    const out: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    for (const msg of input.session.messages) {
      if (msg.role === "assistant" && !msg.content.trim()) {
        continue;
      }
      if (msg.role === "user" || msg.role === "assistant") {
        out.push({ role: msg.role, content: msg.content });
      }
    }

    if (input.contextPrefix) {
      const lastUserIdx = out.map((m) => m.role).lastIndexOf("user");
      if (lastUserIdx >= 0) {
        out[lastUserIdx] = {
          role: "user",
          content: `${input.contextPrefix}${out[lastUserIdx].content}`,
        };
      }
    }

    return out;
  }
}
