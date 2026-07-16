import type { ChatBackendId } from "../types/chat";

export interface ChatErrorPresentation {
  title: string;
  summary: string;
  hint?: string;
  technical?: string;
  showOpenSettings?: boolean;
  showSwitchBackend?: boolean;
}

function stripErrorPrefix(raw: string): string {
  return raw.replace(/^Error:\s*/i, "").trim();
}

function collapseCliNoise(text: string): string {
  return text
    .replace(/(?:Connection lost, reconnecting[^\n]*\n?)+/gi, "")
    .replace(/(?:Retry attempt \d+\.\.\.\s*)+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Turn a raw backend error string into user-facing copy and optional actions. */
export function presentChatError(raw: string, backend?: ChatBackendId): ChatErrorPresentation {
  const technical = stripErrorPrefix(raw);
  const collapsed = collapseCliNoise(technical);
  const text = collapsed || technical;

  if (/resource_exhausted/i.test(text)) {
    return {
      title: "Rate or usage limit",
      summary: "Cursor rejected the request (resource_exhausted).",
      hint: "Wait a few minutes, check Cursor billing, or switch backend in the header to Cursor SDK or LLM gateway.",
      technical: text,
      showSwitchBackend: true,
    };
  }

  if (
    /agentn\.global\.api\d*\.cursor\.sh/i.test(text) ||
    /Connection lost, reconnecting/i.test(text) ||
    /RetriableError/i.test(text)
  ) {
    return {
      title: "Cursor service unreachable",
      summary: "Could not stay connected to Cursor's cloud (agentn.global.api*.cursor.sh).",
      hint:
        backend === "cursor-agent"
          ? "Cursor's CLI cloud may be down or overloaded. Try Retry in a minute, or switch to Cursor SDK in the header. Confirm with `agent -p hi` in a terminal."
          : "This is often temporary. Try Retry in a minute, or switch backend in the header.",
      technical: text,
      showSwitchBackend: true,
    };
  }

  if (/401|unauthorized|invalid api key|authentication/i.test(text)) {
    return {
      title: "Authentication failed",
      summary: "API key missing or rejected.",
      hint: "Open settings and verify your Cursor API key (crsr_…) or LLM gateway credentials.",
      technical: text,
      showOpenSettings: true,
    };
  }

  if (/billing|payment|quota|limit exceeded/i.test(text)) {
    return {
      title: "Plan or billing limit",
      summary: "Cursor blocked the request due to billing or quota.",
      hint: "Check your Cursor plan, or switch to LLM gateway in the header.",
      technical: text,
      showSwitchBackend: true,
      showOpenSettings: true,
    };
  }

  if (/timed out|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|network/i.test(text)) {
    return {
      title: "Connection problem",
      summary: "The request did not complete — network or server issue.",
      hint: "Check your connection, then Retry. If using Cursor Agent CLI, try Cursor SDK instead.",
      technical: text,
      showSwitchBackend: backend === "cursor-agent",
    };
  }

  if (/local folder vault|folder vault/i.test(text)) {
    return {
      title: "Local vault required",
      summary: text,
      hint: "Cursor SDK (local) and Cursor Agent CLI need a folder-based vault on disk.",
      technical: text,
    };
  }

  if (/Configure Cursor API key|Configure LLM gateway/i.test(text)) {
    return {
      title: "Setup required",
      summary: text,
      hint: "Open settings to add your API key and model.",
      technical: text,
      showOpenSettings: true,
    };
  }

  const summary = text.length > 280 ? `${text.slice(0, 280)}…` : text;
  return {
    title: "Request failed",
    summary: summary || "Something went wrong.",
    hint: "Try Retry, switch backend in the header, or open settings.",
    technical: text.length > summary.length ? text : undefined,
    showSwitchBackend: true,
  };
}

/** Compact message stored on the assistant bubble (summary only). */
export function formatChatErrorStorage(presentation: ChatErrorPresentation): string {
  return `Error: ${presentation.summary}`;
}
