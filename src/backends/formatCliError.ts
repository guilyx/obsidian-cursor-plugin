/** Collapse noisy CLI stderr (connection retries) into a short user-facing message. */
export function formatCliErrorMessage(raw: string): string {
  const text = raw.trim();
  if (!text) {
    return "Cursor Agent failed with an unknown error.";
  }

  if (/resource_exhausted/i.test(text)) {
    return [
      "Cursor Agent hit a rate or usage limit (resource_exhausted).",
      "Wait a few minutes, check Cursor billing/usage, or switch backend to Cursor SDK (API key) or LLM gateway in the chat header.",
    ].join(" ");
  }

  if (
    /agentn\.global\.api\d*\.cursor\.sh/i.test(text) ||
    /Connection lost, reconnecting/i.test(text) ||
    /RetriableError/i.test(text)
  ) {
    return [
      "Cursor Agent lost connection to Cursor's cloud service (agentn.global.api*.cursor.sh).",
      "This is often temporary — use Retry after a minute.",
      "If it keeps failing, switch to Cursor SDK in the header or run `agent --version` in a terminal outside Obsidian.",
    ].join(" ");
  }

  const collapsed = text
    .replace(/(?:Connection lost, reconnecting[^\n]*\n?)+/gi, "")
    .replace(/(?:Retry attempt \d+\.\.\.\s*)+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (collapsed.length > 600) {
    return `${collapsed.slice(0, 600)}…`;
  }
  return collapsed || text;
}
