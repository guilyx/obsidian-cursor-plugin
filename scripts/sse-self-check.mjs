/** ponytail: standalone check — mirrors parseSseDataLine in src/api/SseReader.ts */
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

const parsed = parseSseDataLine('{"choices":[{"delta":{"content":"hi"}}]}');
if (parsed.text !== "hi") {
  console.error("SSE self-check failed:", parsed);
  process.exit(1);
}
console.log("SSE self-check OK");
