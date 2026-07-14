/** ponytail: standalone check — mirrors parseSseDataLine + parseCursorSseEvent in src/api/SseReader.ts */

function parseSseDataLine(data) {
  if (data === "[DONE]") return { done: true };
  try {
    const json = JSON.parse(data);
    const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
    if (delta) return { text: delta };
    if (json.error?.message) return { error: json.error.message };
  } catch {
    // ignore
  }
  return {};
}

function parseCursorSseEvent(eventType, data) {
  if (eventType === "heartbeat") return null;
  if (eventType === "done" || data === "{}") return { kind: "done" };
  try {
    const json = JSON.parse(data);
    switch (eventType) {
      case "assistant":
        return { kind: "assistant", text: String(json.text ?? "") };
      case "result":
        return { kind: "result", text: json.text != null ? String(json.text) : undefined };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

const openAi = parseSseDataLine('{"choices":[{"delta":{"content":"hi"}}]}');
if (openAi.text !== "hi") {
  console.error("OpenAI SSE self-check failed:", openAi);
  process.exit(1);
}

const cursor = parseCursorSseEvent("assistant", '{"text":"hello"}');
if (!cursor || cursor.kind !== "assistant" || cursor.text !== "hello") {
  console.error("Cursor SSE self-check failed:", cursor);
  process.exit(1);
}

console.log("SSE self-check OK");
