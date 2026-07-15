#!/usr/bin/env node
/**
 * Local @cursor/sdk bridge — Agent.create({ local: { cwd } }) in Node.
 * ponytail: in-memory agents; SSE mirrors Cloud Agents event names for the plugin.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { Agent } from "@cursor/sdk";

const PORT = Number(process.env.BRIDGE_PORT ?? 8765);
const HOST = process.env.BRIDGE_HOST ?? "127.0.0.1";
const TOKEN = process.env.BRIDGE_TOKEN ?? "";

/** @type {Map<string, { agent: import("@cursor/sdk").SDKAgent; cwd: string }>} */
const agents = new Map();

/** @type {Map<string, { runId: string; chunks: object[]; done: boolean; error?: string }>} */
const runStreams = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authOk(req) {
  if (!TOKEN) {
    return true;
  }
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${TOKEN}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function assistantTextFromSdkMessage(msg) {
  if (msg?.type !== "assistant") {
    return "";
  }
  const blocks = msg.message?.content ?? [];
  return blocks
    .filter((b) => b?.type === "text")
    .map((b) => b.text)
    .join("");
}

function mapSdkMessageToSse(msg) {
  switch (msg?.type) {
    case "assistant": {
      const text = assistantTextFromSdkMessage(msg);
      return text ? [{ type: "assistant", data: { text } }] : [];
    }
    case "thinking":
      return [{ type: "thinking", data: { text: msg.text ?? "" } }];
    case "tool_call":
      return [
        {
          type: "tool_call",
          data: {
            callId: msg.call_id ?? "",
            name: msg.name ?? "tool",
            status: msg.status ?? "",
            args: msg.args,
            result: msg.result,
          },
        },
      ];
    case "status":
      return [{ type: "status", data: { runId: msg.run_id, status: msg.status } }];
    default:
      return [];
  }
}

async function pumpRunStream(agentId, runId, run) {
  const state = { runId, chunks: [], done: false, error: undefined };
  runStreams.set(`${agentId}:${runId}`, state);

  let fullText = "";
  try {
    for await (const msg of run.stream()) {
      for (const evt of mapSdkMessageToSse(msg)) {
        state.chunks.push(evt);
        if (evt.type === "assistant" && evt.data?.text) {
          fullText += evt.data.text;
        }
      }
    }
    const result = await run.wait().catch(() => null);
    const finalText = result?.result ?? fullText;
    state.chunks.push({
      type: "result",
      data: { runId, status: "FINISHED", text: finalText },
    });
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
    state.chunks.push({ type: "error", data: { message: state.error } });
  } finally {
    state.done = true;
    state.chunks.push({ type: "done", data: {} });
  }
}

function writeSseEvent(res, type, data) {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamRunToResponse(res, agentId, runId) {
  const key = `${agentId}:${runId}`;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let index = 0;
  while (true) {
    const state = runStreams.get(key);
    if (!state) {
      writeSseEvent(res, "error", { message: "run_not_found" });
      break;
    }

    while (index < state.chunks.length) {
      const chunk = state.chunks[index++];
      writeSseEvent(res, chunk.type, chunk.data);
      if (chunk.type === "done" || chunk.type === "error") {
        res.end();
        return;
      }
    }

    if (state.done) {
      if (index >= state.chunks.length) {
        res.end();
        return;
      }
    }

    await new Promise((r) => setTimeout(r, 50));
  }
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);

  if (url.pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      version: "0.1.0",
      sdk: "local",
      runtime: "local",
    });
    return;
  }

  if (!authOk(req)) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (url.pathname === "/agents" && req.method === "POST") {
    const raw = await readBody(req);
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    const apiKey = body.apiKey ?? process.env.CURSOR_API_KEY;
    if (!apiKey) {
      sendJson(res, 400, { error: "missing_api_key" });
      return;
    }
    if (!body.cwd) {
      sendJson(res, 400, { error: "missing_cwd" });
      return;
    }
    if (!body.prompt?.text) {
      sendJson(res, 400, { error: "missing_prompt" });
      return;
    }

    try {
      const agent = await Agent.create({
        apiKey,
        model: body.model?.id ? { id: body.model.id } : { id: "composer-2.5" },
        local: { cwd: body.cwd, settingSources: ["project", "user"] },
      });

      agents.set(agent.agentId, { agent, cwd: body.cwd });
      const run = await agent.send(body.prompt.text);
      void pumpRunStream(agent.agentId, run.id, run);

      sendJson(res, 200, {
        agent: { id: agent.agentId, status: "ACTIVE" },
        run: { id: run.id, agentId: agent.agentId, status: "RUNNING" },
      });
    } catch (err) {
      sendJson(res, 500, {
        error: "agent_create_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  const runMatch = url.pathname.match(/^\/agents\/([^/]+)\/runs$/);
  if (runMatch && req.method === "POST") {
    const agentId = runMatch[1];
    const entry = agents.get(agentId);
    if (!entry) {
      sendJson(res, 404, { error: "agent_not_found" });
      return;
    }

    const raw = await readBody(req);
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }
    if (!body.prompt?.text) {
      sendJson(res, 400, { error: "missing_prompt" });
      return;
    }

    try {
      const run = await entry.agent.send(body.prompt.text);
      void pumpRunStream(agentId, run.id, run);
      sendJson(res, 200, {
        run: { id: run.id, agentId, status: "RUNNING" },
      });
    } catch (err) {
      sendJson(res, 500, {
        error: "run_create_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  const streamMatch = url.pathname.match(/^\/agents\/([^/]+)\/runs\/([^/]+)\/stream$/);
  if (streamMatch && req.method === "GET") {
    const [, agentId, runId] = streamMatch;
    if (!agents.has(agentId)) {
      sendJson(res, 404, { error: "agent_not_found" });
      return;
    }
    await streamRunToResponse(res, agentId, runId);
    return;
  }

  const cancelMatch = url.pathname.match(/^\/agents\/([^/]+)\/runs\/([^/]+)\/cancel$/);
  if (cancelMatch && req.method === "POST") {
    const [, agentId, runId] = cancelMatch;
    const entry = agents.get(agentId);
    if (!entry) {
      sendJson(res, 404, { error: "agent_not_found" });
      return;
    }
    try {
      const run = await Agent.getRun(runId, { apiKey: process.env.CURSOR_API_KEY });
      await run.cancel();
      sendJson(res, 200, { id: runId });
    } catch {
      sendJson(res, 204, {});
    }
    return;
  }

  sendJson(res, 501, { error: "not_implemented", path: url.pathname });
});

server.listen(PORT, HOST, () => {
  console.log(`obsidian-cursor-bridge (local SDK) on http://${HOST}:${PORT}`);
});
